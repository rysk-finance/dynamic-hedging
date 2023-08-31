import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"
import {
	AlphaPortfolioValuesFeed,
	BeyondPricer,
	LiquidityPool,
	MintableERC20,
	MockChainlinkAggregator,
	NewController,
	OptionCatalogue,
	OptionExchange,
	OptionRegistry,
	Oracle,
	Otoken,
	PriceFeed,
	Protocol,
	UniswapV3HedgingReactor,
	VolatilityFeed,
	WETH,
	DeltaSettlerMulticall,
	DeltaSettlerResolver
} from "../types"
import {
	CALL_FLAVOR,
	emptySeries,
	fromOpyn,
	fromWei,
	percentDiff,
	PUT_FLAVOR,
	tFormatEth,
	tFormatUSDC,
	toOpyn,
	toUSDC,
	toWei,
	toWeiFromUSDC,
	truncate,
	ZERO_ADDRESS
} from "../utils/conversion-helper"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { deployOpyn } from "../utils/opyn-deployer"
import { OptionsCompute } from "../types/OptionsCompute"
import {
	CHAINLINK_WETH_PRICER,
	CONTROLLER_OWNER,
	UNISWAP_V3_SWAP_ROUTER,
	USDC_ADDRESS,
	WETH_ADDRESS
} from "./constants"
import {
	applySlippageLocally,
	calculateOptionDeltaLocally,
	calculateOptionQuoteLocally,
	compareQuotes,
	getNetDhvExposure,
	getSeriesWithe18Strike,
	localQuoteOptionPrice,
	setOpynOracleExpiryPrice,
	setupOracle,
	setupTestOracle
} from "./helpers"
import exp from "constants"

dayjs.extend(utc)

let usd: MintableERC20
let weth: WETH
let wethERC20: MintableERC20
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let volFeed: VolatilityFeed
let priceFeed: PriceFeed
let portfolioValuesFeed: AlphaPortfolioValuesFeed
let pricer: BeyondPricer
let uniswapV3HedgingReactor: UniswapV3HedgingReactor
let controller: NewController
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let putOptionToken: Otoken
let putOptionToken2: Otoken
let proposedSeries: any
let exchange: OptionExchange
let authority: string
let optionCompute: OptionsCompute
let catalogue: OptionCatalogue

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-03-07"

const invalidExpiryDateLong: string = "2023-04-22"
const invalidExpiryDateShort: string = "2022-03-01"

// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
const collatDecimalShift = BigNumber.from(1000000000000)
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = "20"

// hardcoded value for strike price that is outside of accepted bounds
const invalidStrikeHigh = utils.parseEther("12500")
const invalidStrikeLow = utils.parseEther("200")

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "500000"

const slippageGradient = toWei("0.001") // 0.1% slippage per contract

/* --- end variables to change --- */

const expiration = dayjs.utc(expiryDate).add(8, "hours").unix()
const expiration2 = dayjs.utc(expiryDate).add(1, "weeks").add(8, "hours").unix() // have another batch of options expire 1 week after the first
const expiration3 = dayjs.utc(expiryDate).add(2, "weeks").add(8, "hours").unix()
const expiration4 = dayjs.utc(expiryDate).add(3, "weeks").add(8, "hours").unix()

let seriesAddress1
let seriesAddress2
let seriesAddress3
let seriesAddress4

const strikePrice = utils.parseEther("2000")

const proposedSeries1 = {
	expiration: expiration,
	isPut: PUT_FLAVOR,
	strike: BigNumber.from(strikePrice),
	isBuyable: true,
	isSellable: true
}
const proposedSeries2 = {
	expiration: expiration2,
	isPut: PUT_FLAVOR,
	strike: BigNumber.from(strikePrice),
	isBuyable: true,
	isSellable: true
}
const proposedSeries3 = {
	expiration: expiration3,
	isPut: CALL_FLAVOR,
	strike: BigNumber.from(strikePrice),
	isBuyable: true,
	isSellable: true
}
const proposedSeries4 = {
	expiration: expiration4,
	isPut: CALL_FLAVOR,
	strike: BigNumber.from(strikePrice),
	isBuyable: true,
	isSellable: true
}

function hexToUtf8(hexEncodedMessage: any) {
	return decodeURIComponent(
		hexEncodedMessage
			.slice(2) // remove 0x
			.replace(/\s+/g, "")
			.replace(/[0-9a-f]{2}/g, "%$&")
	)
}

describe("Gelato Delta settler", async () => {
	before(async function () {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						chainId: 1,
						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
						blockNumber: 14290000
					}
				}
			]
		})

		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [CHAINLINK_WETH_PRICER[chainId]]
		})
		signers = await ethers.getSigners()
		let opynParams = await deployOpyn(signers)
		controller = opynParams.controller
		oracle = opynParams.oracle
		const [sender] = signers

		const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
		await sender.sendTransaction({
			to: signer.address,
			value: ethers.utils.parseEther("10.0") // Sends exactly 10.0 ether
		})
		const customErrorsFactory = await ethers.getContractFactory("OptionsCompute")
		optionCompute = (await customErrorsFactory.deploy()) as OptionsCompute
		const forceSendContract = await ethers.getContractFactory("ForceSend")
		const forceSend = await forceSendContract.deploy() // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
		await forceSend
			.connect(signer)
			.go(CHAINLINK_WETH_PRICER[chainId], { value: utils.parseEther("0.5") })
		// get the oracle
		const res = await setupTestOracle(await sender.getAddress())
		oracle = res[0] as Oracle
		opynAggregator = res[1] as MockChainlinkAggregator
		let deployParams = await deploySystem(signers, opynAggregator)
		weth = deployParams.weth
		wethERC20 = deployParams.wethERC20
		usd = deployParams.usd
		optionRegistry = deployParams.optionRegistry
		priceFeed = deployParams.priceFeed
		volFeed = deployParams.volFeed
		portfolioValuesFeed = deployParams.portfolioValuesFeed
		optionProtocol = deployParams.optionProtocol
		authority = deployParams.authority.address
		let lpParams = await deployLiquidityPool(
			signers,
			optionProtocol,
			usd,
			wethERC20,
			optionRegistry,
			portfolioValuesFeed,
			volFeed,
			authority
		)
		liquidityPool = lpParams.liquidityPool
		exchange = lpParams.exchange
		pricer = lpParams.pricer
		catalogue = lpParams.catalogue
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_WHALE]
		})
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		await usdWhaleConnect.transfer(senderAddress, toUSDC("10000000"))
		await usdWhaleConnect.transfer(receiverAddress, toUSDC("10000000"))
	})
	it("SETUP: set sabrParams", async () => {
		const proposedSabrParams = {
			callAlpha: 250000,
			callBeta: 1_000000,
			callRho: -300000,
			callVolvol: 1_500000,
			putAlpha: 250000,
			putBeta: 1_000000,
			putRho: -300000,
			putVolvol: 1_500000,
			interestRate: utils.parseEther("-0.001")
		}
		await exchange.pause()
		const tx = await volFeed.setSabrParameters(proposedSabrParams, expiration)
		await tx.wait()
		await volFeed.setSabrParameters(proposedSabrParams, expiration2)
		await volFeed.setSabrParameters(proposedSabrParams, expiration3)
		await volFeed.setSabrParameters(proposedSabrParams, expiration4)
		await exchange.unpause()
		const volFeedSabrParams = await volFeed.sabrParams(expiration)
		expect(proposedSabrParams.callAlpha).to.equal(volFeedSabrParams.callAlpha)
		expect(proposedSabrParams.callBeta).to.equal(volFeedSabrParams.callBeta)
		expect(proposedSabrParams.callRho).to.equal(volFeedSabrParams.callRho)
		expect(proposedSabrParams.callVolvol).to.equal(volFeedSabrParams.callVolvol)
		expect(proposedSabrParams.putAlpha).to.equal(volFeedSabrParams.putAlpha)
		expect(proposedSabrParams.putBeta).to.equal(volFeedSabrParams.putBeta)
		expect(proposedSabrParams.putRho).to.equal(volFeedSabrParams.putRho)
		expect(proposedSabrParams.putVolvol).to.equal(volFeedSabrParams.putVolvol)
		expect(proposedSabrParams.interestRate).to.equal(volFeedSabrParams.interestRate)
	})
	it("SETUP: approve series", async () => {
		const tx = await catalogue.issueNewSeries([
			proposedSeries1,
			proposedSeries2,
			proposedSeries3,
			proposedSeries4
		])
		const formattedStrikePrice = strikePrice
			.div(ethers.utils.parseUnits("1", 12))
			.mul(ethers.utils.parseUnits("1", 12))

		const oHash1 = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration, formattedStrikePrice, PUT_FLAVOR]
		)
		const isApproved1 = await catalogue.approvedOptions(oHash1)
		const expirationList1 = await catalogue.getExpirations()
		const chainStrike1 = await catalogue.getOptionDetails(expiration, true)
		const isSellable1 = await catalogue.isSellable(oHash1)
		const isBuyable1 = await catalogue.isBuyable(oHash1)
		expect(isApproved1).to.be.true
		expect(isSellable1).to.be.true
		expect(isBuyable1).to.be.true
		expect(chainStrike1[0]).to.equal(formattedStrikePrice)
		expect(expirationList1[0]).to.equal(expiration)

		const oHash2 = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration2, formattedStrikePrice, PUT_FLAVOR]
		)
		const isApproved2 = await catalogue.approvedOptions(oHash2)
		const expirationList2 = await catalogue.getExpirations()
		const chainStrike2 = await catalogue.getOptionDetails(expiration, true)
		const isSellable2 = await catalogue.isSellable(oHash2)
		const isBuyable2 = await catalogue.isBuyable(oHash2)
		expect(isApproved2).to.be.true
		expect(isSellable2).to.be.true
		expect(isBuyable2).to.be.true
		expect(chainStrike2[0]).to.equal(formattedStrikePrice)
		expect(expirationList2[0]).to.equal(expiration)

		const oHash3 = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration3, formattedStrikePrice, CALL_FLAVOR]
		)
		const isApproved3 = await catalogue.approvedOptions(oHash3)
		const expirationList3 = await catalogue.getExpirations()
		const chainStrike3 = await catalogue.getOptionDetails(expiration, true)
		const isSellable3 = await catalogue.isSellable(oHash3)
		const isBuyable3 = await catalogue.isBuyable(oHash3)
		expect(isApproved3).to.be.true
		expect(isSellable3).to.be.true
		expect(isBuyable3).to.be.true
		expect(chainStrike3[0]).to.equal(formattedStrikePrice)
		expect(expirationList3[0]).to.equal(expiration)

		const oHash4 = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration3, formattedStrikePrice, CALL_FLAVOR]
		)
		const isApproved4 = await catalogue.approvedOptions(oHash4)
		const expirationList4 = await catalogue.getExpirations()
		const chainStrike4 = await catalogue.getOptionDetails(expiration, true)
		const isSellable4 = await catalogue.isSellable(oHash4)
		const isBuyable4 = await catalogue.isBuyable(oHash4)
		expect(isApproved4).to.be.true
		expect(isSellable4).to.be.true
		expect(isBuyable4).to.be.true
		expect(chainStrike4[0]).to.equal(formattedStrikePrice)
		expect(expirationList4[0]).to.equal(expiration)
	})
	it("Succeeds: User 1: Deposit to the liquidityPool", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.depositEpoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(await liquidityPool.callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))).to.be.true
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.depositEpoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[0].args
		expect(depositEvent.recipient).to.equal(user)
		expect(depositEvent.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceBefore.sub(usdBalanceAfter)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(0)
		expect(lpusdBalanceAfter.sub(lpusdBalanceBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(epochAfter).to.equal(epochBefore)
		expect(pendingDepositAfter.sub(pendingDepositBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositReceiptBefore.epoch).to.equal(0)
		expect(depositReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(depositReceiptAfter.amount.sub(depositReceiptBefore.amount)).to.equal(
			toUSDC(liquidityPoolUsdcDeposit)
		)
		expect(depositReceiptAfter.unredeemedShares.sub(depositReceiptBefore.unredeemedShares)).to.equal(
			0
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(0)
	})
	it("Succeeds: pauses trading", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
	})
	it("Succeeds: execute epoch", async () => {
		const depositEpochBefore = await liquidityPool.depositEpoch()
		const withdrawalEpochBefore = await liquidityPool.withdrawalEpoch()
		const pendingDepositBefore = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await liquidityPool.totalSupply()
		const partitionedFundsBefore = await liquidityPool.partitionedFunds()
		await liquidityPool.executeEpochCalculation()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const pendingDepositAfter = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const partitionedFundsAfter = await liquidityPool.partitionedFunds()
		const partitionedFundsDiffe18 = toWeiFromUSDC(
			partitionedFundsAfter.sub(partitionedFundsBefore).toString()
		)
		// check partitioned funds increased by pendingWithdrawals * price per share
		expect(
			parseFloat(fromWei(partitionedFundsDiffe18)) -
				parseFloat(fromWei(pendingWithdrawBefore)) *
					parseFloat(fromWei(await liquidityPool.withdrawalEpochPricePerShare(withdrawalEpochBefore)))
		).to.be.within(-0.0001, 0.0001)
		expect(await liquidityPool.depositEpochPricePerShare(depositEpochBefore)).to.equal(
			totalSupplyBefore.eq(0)
				? toWei("1")
				: toWei("1")
						.mul((await liquidityPool.getNAV()).add(partitionedFundsDiffe18).sub(pendingDepositBefore))
						.div(totalSupplyBefore)
		)
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(pendingDepositBefore).to.not.eq(0)
		expect(pendingWithdrawAfter).to.eq(0)
		expect(pendingDepositAfter).to.eq(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.depositEpoch()).to.equal(depositEpochBefore.add(1))
		expect(
			pendingDepositBefore
				.mul(toWei("1"))
				.div(await liquidityPool.depositEpochPricePerShare(depositEpochBefore))
		).to.equal(lplpBalanceAfter.sub(lplpBalanceBefore))
	})
	it("user buys option 1", async () => {
		const [sender] = signers
		const amount = toWei("25")

		const netDhvExposure = await getNetDhvExposure(
			strikePrice,
			usd.address,
			catalogue,
			portfolioValuesFeed,
			expiration,
			PUT_FLAVOR
		)
		expect(netDhvExposure).to.eq(0)

		proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		let quote = quoteResponse[0].add(quoteResponse[2])
		compareQuotes(
			quoteResponse,
			liquidityPool,
			optionProtocol,
			volFeed,
			priceFeed,
			proposedSeries,
			amount,
			false,
			exchange,
			optionRegistry,
			usd,
			pricer
		)

		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const expectedCollateralAllocated = await optionRegistry.getCollateral(
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: strikePrice.div(10 ** 10), // convert to 1e8 for getCollateral
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			},
			amount
		)

		await usd.approve(exchange.address, quote)
		await exchange.operate([
			{
				operation: 1,
				operationQueue: [
					{
						actionType: 0,
						owner: ZERO_ADDRESS,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: 0,
						optionSeries: proposedSeries,
						indexOrAcceptablePremium: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						indexOrAcceptablePremium: amount,
						data: "0x"
					}
				]
			}
		])
		seriesAddress1 = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
		putOptionToken = (await ethers.getContractAt("Otoken", seriesAddress1)) as Otoken
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const senderPutBalance = await putOptionToken.balanceOf(senderAddress)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = collateralAllocatedAfter.sub(collateralAllocatedBefore)
		const senderUSDBalanceAfter = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		// check buyer's OToken balance is correct
		expect(senderPutBalance).to.eq(opynAmount)
		// ensure correct amount of USDC has been taken from buyer
		expect(
			tFormatUSDC(senderUSDBalanceBefore.sub(senderUSDBalanceAfter)) - tFormatUSDC(quote)
		).to.be.within(-0.1, 0.1)

		const poolUSDBalanceDiff = tFormatUSDC(poolBalanceAfter.sub(poolBalanceBefore))
		const expectedUSDBalanceDiff = tFormatUSDC(quote) - tFormatUSDC(collateralAllocatedDiff)
		// check LP USDC balance is changed
		expect(poolUSDBalanceDiff - expectedUSDBalanceDiff).to.be.within(-0.0015, 0.0015)
		// check collateral allocated is increased
		expect(
			tFormatUSDC(collateralAllocatedDiff) - tFormatUSDC(expectedCollateralAllocated)
		).to.be.within(-0.001, 0.001)
		// check ephemeral values update correctly
		expect(tFormatEth(await liquidityPool.ephemeralDelta())).to.equal(-tFormatEth(quoteResponse[1]))
		expect(
			tFormatEth(await liquidityPool.ephemeralLiabilities()) - tFormatUSDC(quote.sub(quoteResponse[2]))
		).to.be.within(-0.01, 0.01)
	})
	it("user buys option 2", async () => {
		const [sender] = signers
		const amount = toWei("25")

		const netDhvExposure = await getNetDhvExposure(
			strikePrice,
			usd.address,
			catalogue,
			portfolioValuesFeed,
			expiration2,
			PUT_FLAVOR
		)
		expect(netDhvExposure).to.eq(0)

		proposedSeries = {
			expiration: expiration2,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		let quote = quoteResponse[0].add(quoteResponse[2])
		compareQuotes(
			quoteResponse,
			liquidityPool,
			optionProtocol,
			volFeed,
			priceFeed,
			proposedSeries,
			amount,
			false,
			exchange,
			optionRegistry,
			usd,
			pricer
		)

		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const expectedCollateralAllocated = await optionRegistry.getCollateral(
			{
				expiration: expiration2,
				isPut: PUT_FLAVOR,
				strike: strikePrice.div(10 ** 10), // convert to 1e8 for getCollateral
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			},
			amount
		)

		await usd.approve(exchange.address, quote)
		await exchange.operate([
			{
				operation: 1,
				operationQueue: [
					{
						actionType: 0,
						owner: ZERO_ADDRESS,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: 0,
						optionSeries: proposedSeries,
						indexOrAcceptablePremium: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						indexOrAcceptablePremium: amount,
						data: "0x"
					}
				]
			}
		])
		seriesAddress2 = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
		putOptionToken = (await ethers.getContractAt("Otoken", seriesAddress2)) as Otoken
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const senderPutBalance = await putOptionToken.balanceOf(senderAddress)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = collateralAllocatedAfter.sub(collateralAllocatedBefore)
		const senderUSDBalanceAfter = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		// check buyer's OToken balance is correct
		expect(senderPutBalance).to.eq(opynAmount)
		// ensure correct amount of USDC has been taken from buyer
		expect(
			tFormatUSDC(senderUSDBalanceBefore.sub(senderUSDBalanceAfter)) - tFormatUSDC(quote)
		).to.be.within(-0.1, 0.1)

		const poolUSDBalanceDiff = tFormatUSDC(poolBalanceAfter.sub(poolBalanceBefore))
		const expectedUSDBalanceDiff = tFormatUSDC(quote) - tFormatUSDC(collateralAllocatedDiff)
		// check LP USDC balance is changed
		expect(poolUSDBalanceDiff - expectedUSDBalanceDiff).to.be.within(-0.0015, 0.0015)
		// check collateral allocated is increased
		expect(
			tFormatUSDC(collateralAllocatedDiff) - tFormatUSDC(expectedCollateralAllocated)
		).to.be.within(-0.001, 0.001)
	})
	it("user buys option 3", async () => {
		const [sender] = signers
		const amount = toWei("25")

		const netDhvExposure = await getNetDhvExposure(
			strikePrice,
			usd.address,
			catalogue,
			portfolioValuesFeed,
			expiration3,
			CALL_FLAVOR
		)
		expect(netDhvExposure).to.eq(0)

		proposedSeries = {
			expiration: expiration3,
			strike: BigNumber.from(strikePrice),
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		let quote = quoteResponse[0].add(quoteResponse[2])
		compareQuotes(
			quoteResponse,
			liquidityPool,
			optionProtocol,
			volFeed,
			priceFeed,
			proposedSeries,
			amount,
			false,
			exchange,
			optionRegistry,
			usd,
			pricer
		)

		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const expectedCollateralAllocated = await optionRegistry.getCollateral(
			{
				expiration: expiration3,
				isPut: CALL_FLAVOR,
				strike: strikePrice.div(10 ** 10), // convert to 1e8 for getCollateral
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			},
			amount
		)

		await usd.approve(exchange.address, quote.mul(10001).div(10000))
		await exchange.operate([
			{
				operation: 1,
				operationQueue: [
					{
						actionType: 0,
						owner: ZERO_ADDRESS,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: 0,
						optionSeries: proposedSeries,
						indexOrAcceptablePremium: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						indexOrAcceptablePremium: amount,
						data: "0x"
					}
				]
			}
		])
		seriesAddress3 = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
		putOptionToken = (await ethers.getContractAt("Otoken", seriesAddress3)) as Otoken
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const senderPutBalance = await putOptionToken.balanceOf(senderAddress)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = collateralAllocatedAfter.sub(collateralAllocatedBefore)
		const senderUSDBalanceAfter = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		// check buyer's OToken balance is correct
		expect(senderPutBalance).to.eq(opynAmount)
		// ensure correct amount of USDC has been taken from buyer
		expect(
			tFormatUSDC(senderUSDBalanceBefore.sub(senderUSDBalanceAfter)) - tFormatUSDC(quote)
		).to.be.within(-0.1, 0.1)

		const poolUSDBalanceDiff = tFormatUSDC(poolBalanceAfter.sub(poolBalanceBefore))
		const expectedUSDBalanceDiff = tFormatUSDC(quote) - tFormatUSDC(collateralAllocatedDiff)
		// check LP USDC balance is changed
		expect(poolUSDBalanceDiff - expectedUSDBalanceDiff).to.be.within(-0.0015, 0.0015)
		// check collateral allocated is increased
		expect(
			tFormatUSDC(collateralAllocatedDiff) - tFormatUSDC(expectedCollateralAllocated)
		).to.be.within(-0.001, 0.001)
	})
	it("user buys option 4", async () => {
		const [sender] = signers
		const amount = toWei("25")

		const netDhvExposure = await getNetDhvExposure(
			strikePrice,
			usd.address,
			catalogue,
			portfolioValuesFeed,
			expiration4,
			CALL_FLAVOR
		)
		expect(netDhvExposure).to.eq(0)

		proposedSeries = {
			expiration: expiration4,
			strike: BigNumber.from(strikePrice),
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		let quote = quoteResponse[0].add(quoteResponse[2])
		compareQuotes(
			quoteResponse,
			liquidityPool,
			optionProtocol,
			volFeed,
			priceFeed,
			proposedSeries,
			amount,
			false,
			exchange,
			optionRegistry,
			usd,
			pricer
		)

		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const expectedCollateralAllocated = await optionRegistry.getCollateral(
			{
				expiration: expiration4,
				isPut: CALL_FLAVOR,
				strike: strikePrice.div(10 ** 10), // convert to 1e8 for getCollateral
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			},
			amount
		)

		await usd.approve(exchange.address, quote.mul(10001).div(10000))
		await exchange.operate([
			{
				operation: 1,
				operationQueue: [
					{
						actionType: 0,
						owner: ZERO_ADDRESS,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: 0,
						optionSeries: proposedSeries,
						indexOrAcceptablePremium: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						indexOrAcceptablePremium: amount,
						data: "0x"
					}
				]
			}
		])
		seriesAddress4 = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
		putOptionToken = (await ethers.getContractAt("Otoken", seriesAddress4)) as Otoken
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const senderPutBalance = await putOptionToken.balanceOf(senderAddress)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = collateralAllocatedAfter.sub(collateralAllocatedBefore)
		const senderUSDBalanceAfter = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		// check buyer's OToken balance is correct
		expect(senderPutBalance).to.eq(opynAmount)
		// ensure correct amount of USDC has been taken from buyer
		expect(
			tFormatUSDC(senderUSDBalanceBefore.sub(senderUSDBalanceAfter)) - tFormatUSDC(quote)
		).to.be.within(-0.1, 0.1)

		const poolUSDBalanceDiff = tFormatUSDC(poolBalanceAfter.sub(poolBalanceBefore))
		const expectedUSDBalanceDiff = tFormatUSDC(quote) - tFormatUSDC(collateralAllocatedDiff)
		// check LP USDC balance is changed
		expect(poolUSDBalanceDiff - expectedUSDBalanceDiff).to.be.within(-0.0015, 0.0015)
		// check collateral allocated is increased
		expect(
			tFormatUSDC(collateralAllocatedDiff) - tFormatUSDC(expectedCollateralAllocated)
		).to.be.within(-0.001, 0.001)
	})
})
let multicall: DeltaSettlerMulticall
let resolver: DeltaSettlerResolver
describe("deploy resolver and multicall", async () => {
	it("deploys multicall", async () => {
		const multicallFactory = await ethers.getContractFactory("DeltaSettlerMulticall")
		multicall = (await multicallFactory.deploy(
			authority,
			optionRegistry.address,
			controller.address,
			liquidityPool.address
		)) as DeltaSettlerMulticall
		expect(multicall).to.haveOwnProperty("checkVaultsToSettle")
	})
	it("deploys resolver", async () => {
		const resolverFactory = await ethers.getContractFactory("DeltaSettlerResolver")
		resolver = (await resolverFactory.deploy(
			multicall.address,
			portfolioValuesFeed.address
		)) as DeltaSettlerResolver
		expect(resolver).to.haveOwnProperty("checker")
	})
	it("sets permissions on pvFed and liquidity pool", async () => {
		await liquidityPool.setKeeper(multicall.address, true)
		await portfolioValuesFeed.setKeeper(multicall.address, true)
	})
})
describe("executes bots runs", async () => {
	it("shows incorrect time", async () => {
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const timestamp = block.timestamp
		const date = new Date(timestamp * 1000)
		expect(date.getHours()).to.not.eq(8)
		const checkerResult = await resolver.checker()
		console.log({ checkerResult })
		const decodedResult = hexToUtf8(checkerResult.execPayload)

		expect(decodedResult).to.eq("Incorrect time")
	})
	it("shows no vaults to settle", async () => {
		// fast forward 3 min
		await ethers.provider.send("evm_increaseTime", [3600 * 13])
		await ethers.provider.send("evm_mine")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const timestamp = block.timestamp
		const date = new Date(timestamp * 1000)
		expect(date.getHours()).to.eq(8)
		console.log({ date })
		const checkerResult = await resolver.checker()
		console.log({ checkerResult })
		const decodedResult = hexToUtf8(checkerResult.execPayload)

		expect(decodedResult).to.eq("No vaults to settle")
	})
	it("shows 1 vault to settle and settles it with keeper", async () => {
		const blockNumBefore = await ethers.provider.getBlockNumber()
		const blockBefore = await ethers.provider.getBlock(blockNumBefore)
		const timestampBefore = blockBefore.timestamp
		// fast forward to expiry
		await ethers.provider.send("evm_increaseTime", [expiration - timestampBefore])
		await ethers.provider.send("evm_mine")

		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const timestamp = block.timestamp
		const date = new Date(timestamp * 1000)
		// expect(date.getHours()).to.eq(9) // BST now
		console.log({ date, timestamp })

		const settlePrice = utils.parseUnits("2000", 8)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)

		const checkerResult = await resolver.checker()

		expect(checkerResult.canExec).to.eq(true)

		// Check keeper system works
		const keeperAddress = "0x55fe002aeff02f77364de339a1292923a15844b8"
		// user is not keeper. Tx should fail
		await expect(
			multicall
				.connect(await ethers.getSigner(keeperAddress))
				.settleVaults([seriesAddress1, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS])
		).to.be.revertedWithCustomError(multicall, "NotKeeper")

		// set address as keeper
		await multicall.setKeeper(keeperAddress, true)
		// tx now passes
		await multicall
			.connect(await ethers.getSigner(keeperAddress))
			.settleVaults([seriesAddress1, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS])

		const checkerResultAfter = await resolver.checker()
		const decodedResultAfter = hexToUtf8(checkerResultAfter.execPayload)

		expect(decodedResultAfter).to.eq("No vaults to settle")
	})
	it("Cleans all expired options", async () => {
		const originalLength = await portfolioValuesFeed.addressSetLength()
		await portfolioValuesFeed.syncLooper()
		const newLength = await portfolioValuesFeed.addressSetLength()
		expect(originalLength.sub(1)).to.equal(newLength)
		console.log({ newLength })
	})
	it("shows 3 vaults to settle and settles them all", async () => {
		const blockNumBefore2 = await ethers.provider.getBlockNumber()
		const blockBefore2 = await ethers.provider.getBlock(blockNumBefore2)
		const timestampBefore2 = blockBefore2.timestamp

		const settlePrice = utils.parseUnits("2000", 8)
		// fast forward to expiry
		await ethers.provider.send("evm_increaseTime", [expiration2 - timestampBefore2])
		await ethers.provider.send("evm_mine")
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration2, settlePrice)

		const blockNumBefore3 = await ethers.provider.getBlockNumber()
		const blockBefore3 = await ethers.provider.getBlock(blockNumBefore3)
		const timestampBefore3 = blockBefore3.timestamp
		// fast forward to expiry
		await ethers.provider.send("evm_increaseTime", [expiration3 - timestampBefore3])
		await ethers.provider.send("evm_mine")
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration3, settlePrice)

		const blockNumBefore4 = await ethers.provider.getBlockNumber()
		const blockBefore4 = await ethers.provider.getBlock(blockNumBefore4)
		const timestampBefore4 = blockBefore4.timestamp
		// fast forward to expiry
		await ethers.provider.send("evm_increaseTime", [expiration4 - timestampBefore4])
		await ethers.provider.send("evm_mine")
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration4, settlePrice)

		const checkerResult = await resolver.checker()
		expect(checkerResult.canExec).to.eq(true)

		await multicall.settleVaults([seriesAddress2, seriesAddress3, seriesAddress4])

		const checkerResultAfter = await resolver.checker()
		const decodedResultAfter = hexToUtf8(checkerResultAfter.execPayload)

		expect(decodedResultAfter).to.eq("No vaults to settle")
	})
})
