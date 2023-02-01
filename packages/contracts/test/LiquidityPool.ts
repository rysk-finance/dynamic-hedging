import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"
import { AlphaPortfolioValuesFeed, BeyondPricer, LiquidityPool, MintableERC20, MockChainlinkAggregator, NewController, OptionCatalogue, OptionExchange, OptionRegistry, Oracle, Otoken, PriceFeed, Protocol, UniswapV3HedgingReactor, VolatilityFeed, WETH } from "../types"
import {
	CALL_FLAVOR, emptySeries, fromOpyn, fromWei,
	percentDiff, PUT_FLAVOR, tFormatEth, tFormatUSDC, toOpyn, toUSDC, toWei, toWeiFromUSDC, truncate, ZERO_ADDRESS
} from "../utils/conversion-helper"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { deployOpyn } from "../utils/opyn-deployer"
import { OptionsCompute } from "../types/OptionsCompute"
import {
	CHAINLINK_WETH_PRICER, CONTROLLER_OWNER, UNISWAP_V3_SWAP_ROUTER, USDC_ADDRESS,
	WETH_ADDRESS
} from "./constants"
import {
	applySlippageLocally,
	calculateOptionDeltaLocally, calculateOptionQuoteLocally, compareQuotes, getNetDhvExposure, getSeriesWithe18Strike, localQuoteOptionPrice, setOpynOracleExpiryPrice, setupOracle, setupTestOracle
} from "./helpers"

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
const expiryDate: string = "2022-04-05"

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
const invalidExpirationLong = dayjs.utc(invalidExpiryDateLong).add(8, "hours").unix()
const invalidExpirationShort = dayjs.utc(invalidExpiryDateShort).add(8, "hours").unix()

describe("Liquidity Pools", async () => {
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
		let deployParams = await deploySystem(signers, oracle, opynAggregator)
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
		await usdWhaleConnect.transfer(senderAddress, toUSDC("1000000"))
		await usdWhaleConnect.transfer(receiverAddress, toUSDC("1000000"))
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
		await volFeed.setSabrParameters(proposedSabrParams, expiration)
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
	it("sets slippage gradient in pricer contract", async () => {
		await pricer.setSlippageGradient(slippageGradient)

		expect(await pricer.slippageGradient()).to.eq(slippageGradient)
	})
	it("reverts when unauthorised party tries to update slippage variables", async () => {
		await expect(
			pricer.connect((await ethers.getSigners())[4]).setSlippageGradient(0)
		).to.be.revertedWithCustomError(pricer, "UNAUTHORIZED")
	})
	it("SETUP: approve series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const tx = await catalogue.issueNewSeries([
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isBuyable: true,
				isSellable: true
			}
		])
		let receipt = await tx.wait()
		const events = receipt.events
		const approveEvents = events?.find(x => x.event == "SeriesApproved")
		const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
			ethers.utils.parseUnits("1", 10)
		)
		const oHash = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration, formattedStrikePrice, PUT_FLAVOR]
		)
		const isApproved = await catalogue.approvedOptions(oHash)
		const expirationList = await catalogue.getExpirations()
		const chainStrike = await catalogue.getOptionDetails(expiration, true)
		const isSellable = await catalogue.isSellable(oHash)
		const isBuyable = await catalogue.isBuyable(oHash)
		expect(isApproved).to.be.true
		expect(isSellable).to.be.true
		expect(isBuyable).to.be.true
		expect(chainStrike[0]).to.equal(formattedStrikePrice)
		expect(expirationList[0]).to.equal(expiration)
	})
	it("SUCCEEDs: change option buy or sell on series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
			ethers.utils.parseUnits("1", 10)
		)
		const tx = await catalogue.changeOptionBuyOrSell([
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: formattedStrikePrice,
				isSellable: false,
				isBuyable: false
			}
		])
		const oHash = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration, formattedStrikePrice, PUT_FLAVOR]
		)
		const isApproved = await catalogue.approvedOptions(oHash)
		const expirationList = await catalogue.getExpirations()
		const chainStrike = await catalogue.getOptionDetails(expiration, true)
		const isSellable = await catalogue.isSellable(oHash)
		const isBuyable = await catalogue.isBuyable(oHash)
		expect(isApproved).to.be.true
		expect(isSellable).to.be.false
		expect(isBuyable).to.be.false
		expect(chainStrike[0]).to.equal(formattedStrikePrice)
		expect(expirationList[0]).to.equal(expiration)
	})
	it("REVERTs: change option buy or sell on series for unapproved option", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		await expect(
			catalogue.changeOptionBuyOrSell([
				{
					expiration: expiration,
					isPut: PUT_FLAVOR,
					strike: 0,
					isSellable: false,
					isBuyable: false
				}
			])
		).to.be.revertedWithCustomError(exchange, "UnapprovedSeries")
	})
	it("SUCCEEDs: reapprove series doesn't work", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const tx = await catalogue.issueNewSeries([
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			}
		])
		let receipt = await tx.wait()
		const events = receipt.events
		const approveEvents = events?.find(x => x.event == "SeriesApproved")
		expect(approveEvents).to.be.undefined
	})
	it("SETUP: approve series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const tx = await catalogue.changeOptionBuyOrSell([
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			}
		])
		const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
			ethers.utils.parseUnits("1", 10)
		)
		const oHash = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration, formattedStrikePrice, PUT_FLAVOR]
		)
		const isApproved = await catalogue.approvedOptions(oHash)
		const expirationList = await catalogue.getExpirations()
		const chainStrike = await catalogue.getOptionDetails(expiration, true)
		const isSellable = await catalogue.isSellable(oHash)
		const isBuyable = await catalogue.isBuyable(oHash)
		expect(isApproved).to.be.true
		expect(isSellable).to.be.true
		expect(isBuyable).to.be.true
		expect(chainStrike[0]).to.equal(formattedStrikePrice)
		expect(expirationList[0]).to.equal(expiration)
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
	it("deploys the hedging reactor", async () => {
		const uniswapV3HedgingReactorFactory = await ethers.getContractFactory(
			"UniswapV3HedgingReactor",
			{
				signer: signers[0]
			}
		)

		uniswapV3HedgingReactor = (await uniswapV3HedgingReactorFactory.deploy(
			UNISWAP_V3_SWAP_ROUTER[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			liquidityPool.address,
			3000,
			priceFeed.address,
			authority
		)) as UniswapV3HedgingReactor

		expect(uniswapV3HedgingReactor).to.have.property("hedgeDelta")
	})
	it("sets reactor address on LP contract", async () => {
		const reactorAddress = uniswapV3HedgingReactor.address

		await liquidityPool.setHedgingReactorAddress(reactorAddress)

		await expect(await liquidityPool.hedgingReactors(0)).to.equal(reactorAddress)
	})
	it("adds and deletes a hedging reactor address", async () => {
		const reactorAddress = uniswapV3HedgingReactor.address

		const hedgingReactorBefore = await liquidityPool.hedgingReactors(0)
		// check hedging reactor exists in array
		expect(parseInt(hedgingReactorBefore, 16)).to.not.eq(0x0)
		await liquidityPool.removeHedgingReactorAddress(0, false)
		// check no hedging reactors exist
		await expect(liquidityPool.hedgingReactors(0)).to.be.reverted
		await expect(liquidityPool.hedgingReactors(1)).to.be.reverted

		// restore hedging reactor
		await liquidityPool.setHedgingReactorAddress(reactorAddress)
		await expect(await liquidityPool.hedgingReactors(0)).to.equal(reactorAddress)

		await liquidityPool.setHedgingReactorAddress(senderAddress)
		await liquidityPool.setHedgingReactorAddress(WETH_ADDRESS[chainId])

		// check added addresses show
		expect(await liquidityPool.hedgingReactors(1)).to.equal(senderAddress)
		expect(await liquidityPool.hedgingReactors(2)).to.equal(WETH_ADDRESS[chainId])
		// delete two added reactors
		// should remove middle element (element 1)
		await liquidityPool.removeHedgingReactorAddress(1, true)
		// should remove last element (elements 1)
		await liquidityPool.removeHedgingReactorAddress(1, true)
		expect(await liquidityPool.hedgingReactors(0)).to.equal(reactorAddress)
		await expect(liquidityPool.hedgingReactors(1)).to.be.reverted
	})
	it("reverts when adding invalid reactor address", async () => {
		await expect(
			liquidityPool.setHedgingReactorAddress(uniswapV3HedgingReactor.address)
		).to.be.revertedWithCustomError(liquidityPool, "ReactorAlreadyExists")
		await expect(liquidityPool.setHedgingReactorAddress(ZERO_ADDRESS)).to.be.revertedWithCustomError(
			liquidityPool, "InvalidAddress"
		)
	})
	it("SETUP: sets the exchange as a hedging reactor", async function () {
		await liquidityPool.setHedgingReactorAddress(exchange.address)
		expect(await liquidityPool.hedgingReactors(1)).to.equal(exchange.address)
	})
	it("Returns a quote for a ETH/USD put with utilization", async () => {
		const amount = toWei("500")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const optionSeries = {
			expiration: expiration,
			strike: strikePrice,
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
			ethers.utils.parseUnits("1", 10)
		)
		const oHash = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration, formattedStrikePrice, PUT_FLAVOR]
		)
		const netDhvExposure = await getNetDhvExposure(
			optionSeries.strike,
			optionSeries.collateral,
			catalogue,
			optionSeries.expiration,
			optionSeries.isPut
		)
		expect(netDhvExposure).to.eq(0)
		let quoteResponse = await pricer.quoteOptionPrice(optionSeries, amount, false, netDhvExposure)
		await compareQuotes(
			quoteResponse,
			liquidityPool,
			priceFeed,
			optionSeries,
			amount,
			false,
			exchange,
			optionRegistry,
			usd,
			pricer,
			netDhvExposure
		)
	})

	it("Returns a quote for a ETH/USD put for DHV to buy", async () => {
		const thirtyPercentStr = "0.3"
		const amount = toWei("350")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const optionSeries = {
			expiration: expiration,
			strike: strikePrice,
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}

		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			optionSeries,
			amount,
			pricer,
			true
		)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			optionSeries,
			amount,
			true
		)
		const slippageFactor = await applySlippageLocally(
			pricer,
			catalogue,
			optionSeries,
			amount,
			localDelta.div(parseFloat(fromWei(amount))),
			true
		)
		let quoteResponse = await pricer.quoteOptionPrice(optionSeries, amount, true, 0)
		let localQuoteWithSlippage = localQuote * slippageFactor
		expect(localQuoteWithSlippage).to.be.lt(localQuote)
		let buyQuote = quoteResponse[0].add(quoteResponse[2])
		const truncQuote = truncate(localQuoteWithSlippage)
		const chainQuote = tFormatUSDC(buyQuote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)
	})
	it("SETUP: approve series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		await catalogue.issueNewSeries([
			{
				expiration: invalidExpirationLong,
				isPut: PUT_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			},
			{
				expiration: invalidExpirationShort,
				isPut: PUT_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			}
		])
	})
	it("reverts when attempting to write ETH/USD puts with expiry outside of limit", async () => {
		const amount = toWei("1")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		await volFeed.setSabrParameters(
			{
				callAlpha: 250000,
				callBeta: 1_000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1_000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			},
			invalidExpirationLong
		)
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
		// series with expiry too long
		const proposedSeries1 = {
			expiration: invalidExpirationLong,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}

		await usd.approve(exchange.address, toWei("1000000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "OptionExpiryInvalid")
		await volFeed.setSabrParameters(
			{
				callAlpha: 250000,
				callBeta: 1_000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1_000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			},
			invalidExpirationShort
		)
		// series with expiry too short
		const proposedSeries2 = {
			expiration: invalidExpirationShort,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await usd.approve(exchange.address, toWei("1000000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries2,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries2,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "OptionExpiryInvalid")
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const senderUSDBalanceAfter = await usd.balanceOf(senderAddress)
		// check to make sure no balances have changed
		expect(collateralAllocatedBefore).to.eq(collateralAllocatedAfter)
		expect(senderUSDBalanceBefore).to.eq(senderUSDBalanceAfter)
	})
	it("SETUP: approve series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		await catalogue.issueNewSeries([
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: invalidStrikeHigh,
				isSellable: true,
				isBuyable: true
			},
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: invalidStrikeLow,
				isSellable: true,
				isBuyable: true
			}
		])
	})
	it("reverts when attempting to write a ETH/USD put with strike outside of limit", async () => {
		const amount = toWei("7")
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		// Series with strike price too high
		const proposedSeries1 = {
			expiration: expiration,
			strike: invalidStrikeHigh,
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		// const quote = (await pricer.quoteOptionPrice(proposedSeries1, amount, false))[0]
		await usd.approve(exchange.address, toWei("100000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(liquidityPool, "OptionStrikeInvalid")
		// Series with strike price too low

		const proposedSeries2 = {
			expiration: expiration,
			strike: invalidStrikeLow,
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		// const quote2 = (await pricer.quoteOptionPrice(proposedSeries2, amount, false))[0]
		await usd.approve(exchange.address, toWei("100000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries2,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries2,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(liquidityPool, "OptionStrikeInvalid")
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const senderUSDBalanceAfter = await usd.balanceOf(senderAddress)
		// check to make sure no balances have changed
		expect(collateralAllocatedBefore).to.eq(collateralAllocatedAfter)
		expect(senderUSDBalanceBefore).to.eq(senderUSDBalanceAfter)
	})
	it("SETUP: approve series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.add(toWei(strike))
		await catalogue.issueNewSeries([
			{
				expiration: invalidExpirationLong,
				isPut: CALL_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			},
			{
				expiration: invalidExpirationShort,
				isPut: CALL_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			}
		])
	})
	it("reverts when attempting to write ETH/USD call with expiry outside of limit", async () => {
		const amount = toWei("1")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.add(toWei(strike))
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		await volFeed.setSabrParameters(
			{
				callAlpha: 250000,
				callBeta: 1_000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1_000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			},
			invalidExpirationLong
		)
		// series with expiry too long
		const proposedSeries1 = {
			expiration: invalidExpirationLong,
			strike: BigNumber.from(strikePrice),
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await usd.approve(exchange.address, toWei("1000000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "OptionExpiryInvalid")
		await volFeed.setSabrParameters(
			{
				callAlpha: 250000,
				callBeta: 1_000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1_000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			},
			invalidExpirationShort
		)
		// series with expiry too short
		const proposedSeries2 = {
			expiration: invalidExpirationShort,
			strike: BigNumber.from(strikePrice),
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await usd.approve(exchange.address, toWei("1000000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries2,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries2,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "OptionExpiryInvalid")
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const senderUSDBalanceAfter = await usd.balanceOf(senderAddress)
		// check to make sure no balances have changed
		expect(collateralAllocatedBefore).to.eq(collateralAllocatedAfter)
		expect(senderUSDBalanceBefore).to.eq(senderUSDBalanceAfter)
	})
	it("SETUP: approve series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.add(toWei(strike))
		await catalogue.issueNewSeries([
			{
				expiration: expiration,
				isPut: CALL_FLAVOR,
				strike: invalidStrikeHigh,
				isSellable: true,
				isBuyable: true
			},
			{
				expiration: expiration,
				isPut: CALL_FLAVOR,
				strike: invalidStrikeLow,
				isSellable: true,
				isBuyable: true
			}
		])
	})
	it("reverts when attempting to write a ETH/USD call with strike outside of limit", async () => {
		const amount = toWei("7")
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		// Series with strike price too high
		const proposedSeries1 = {
			expiration: expiration,
			strike: invalidStrikeHigh,
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		// const quote = (await pricer.quoteOptionPrice(proposedSeries1, amount, false))[0]
		await usd.approve(exchange.address, toWei("100000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(liquidityPool, "OptionStrikeInvalid")
		// Series with strike price too low

		const proposedSeries2 = {
			expiration: expiration,
			strike: invalidStrikeLow,
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		// const quote2 = (await pricer.quoteOptionPrice(proposedSeries2, amount, false))[0]
		await usd.approve(exchange.address, toWei("100000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries2,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries2,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(liquidityPool, "OptionStrikeInvalid")
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const senderUSDBalanceAfter = await usd.balanceOf(senderAddress)
		// check to make sure no balances have changed
		expect(collateralAllocatedBefore).to.eq(collateralAllocatedAfter)
		expect(senderUSDBalanceBefore).to.eq(senderUSDBalanceAfter)
	})
	it("can compute portfolio delta", async function () {
		const delta = await liquidityPool.getPortfolioDelta()
		// no options have been written yet
		expect(delta).to.equal(0)
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
		await volFeed.setSabrParameters(proposedSabrParams, expiration)
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
	it("REVERTs: when attempting to write a ETH/USD call with unapproved series", async () => {
		const amount = toWei("7")
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const senderUSDBalanceBefore = await usd.balanceOf(senderAddress)
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.add(toWei(strike).add(5))
		const proposedSeries1 = {
			expiration: expiration,
			strike: strikePrice,
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		// const quote = (await pricer.quoteOptionPrice(proposedSeries1, amount, false))[0]
		await usd.approve(exchange.address, toWei("100000000"))
		await expect(
			exchange.operate([
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
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries1,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "UnapprovedSeries")
	})
	it("LP Writes a ETH/USD put for premium", async () => {
		const [sender] = signers
		const amount = toWei("25")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const netDhvExposure = await getNetDhvExposure(
			strikePrice,
			usd.address,
			catalogue,
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

		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			proposedSeries,
			amount,
			pricer,
			false
		)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			amount,
			false
		)
		const slippageFactor = await applySlippageLocally(
			pricer,
			catalogue,
			proposedSeries,
			amount,
			localDelta.div(parseFloat(fromWei(amount))),
			false
		)
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		let localQuoteWithSlippage = localQuote * slippageFactor
		expect(localQuoteWithSlippage).to.be.gt(localQuote)
		let quote = quoteResponse[0].add(quoteResponse[2])
		let delta = quoteResponse[1]
		const truncQuote = truncate(localQuoteWithSlippage)
		const chainQuote = tFormatUSDC(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)

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
						index: 0,
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
						index: 0,
						data: "0x"
					}
				]
			}
		])
		const seriesAddress = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
		putOptionToken = await ethers.getContractAt("Otoken", seriesAddress) as Otoken
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
		expect(tFormatEth(await liquidityPool.ephemeralDelta())).to.equal(-tFormatEth(delta))
		expect(
			tFormatEth(await liquidityPool.ephemeralLiabilities()) - tFormatUSDC(quote.sub(quoteResponse[2]))
		).to.be.within(-0.01, 0.01)
	})
	it("SETUP: change option buy or sell on series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
			ethers.utils.parseUnits("1", 10)
		)
		const tx = await catalogue.changeOptionBuyOrSell([
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: formattedStrikePrice,
				isSellable: false,
				isBuyable: false
			}
		])
		const oHash = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration, formattedStrikePrice, PUT_FLAVOR]
		)
		const isApproved = await catalogue.approvedOptions(oHash)
		const expirationList = await catalogue.getExpirations()
		const chainStrike = await catalogue.getOptionDetails(expiration, true)
		const isSellable = await catalogue.isSellable(oHash)
		const isBuyable = await catalogue.isBuyable(oHash)
		expect(isApproved).to.be.true
		expect(isSellable).to.be.false
		expect(isBuyable).to.be.false
		expect(chainStrike[0]).to.equal(formattedStrikePrice)
		expect(expirationList[0]).to.equal(expiration)
	})
	it("REVERTs: LP issueWrites a ETH/USD put for premium for series not approved for sale", async () => {
		const [sender] = signers
		const amount = toWei("5")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
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

		await usd.approve(exchange.address, quote)
		await expect(
			exchange.operate([
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
							index: 0,
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
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "SeriesNotBuyable")
	})
	it("REVERTs: LP writes a ETH/USD put for premium for series not approved for sale", async () => {
		const [sender] = signers
		const amount = toWei("5")
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		let quote = quoteResponse[0].add(quoteResponse[2])
		await usd.approve(exchange.address, quote)
		await expect(
			exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: putOptionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "SeriesNotBuyable")
	})
	it("REVERTs: LP buyback a ETH/USD put for premium for series not approved for buying", async () => {
		const [sender] = signers
		const amount = toWei("5")
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
		let quote = quoteResponse[0].add(quoteResponse[2])
		await usd.approve(exchange.address, quote)
		await expect(
			exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: putOptionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "SeriesNotSellable")
	})
	it("SETUP: change option buy or sell on series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
			ethers.utils.parseUnits("1", 10)
		)
		const tx = await catalogue.changeOptionBuyOrSell([
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: formattedStrikePrice,
				isSellable: true,
				isBuyable: true
			}
		])
		const oHash = ethers.utils.solidityKeccak256(
			["uint64", "uint128", "bool"],
			[expiration, formattedStrikePrice, PUT_FLAVOR]
		)
		const isApproved = await catalogue.approvedOptions(oHash)
		const expirationList = await catalogue.getExpirations()
		const chainStrike = await catalogue.getOptionDetails(expiration, true)
		const isSellable = await catalogue.isSellable(oHash)
		const isBuyable = await catalogue.isBuyable(oHash)
		expect(isApproved).to.be.true
		expect(isSellable).to.be.true
		expect(isBuyable).to.be.true
		expect(chainStrike[0]).to.equal(formattedStrikePrice)
		expect(expirationList[0]).to.equal(expiration)
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
		await volFeed.setSabrParameters(proposedSabrParams, expiration)
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
	it("can compute portfolio delta", async function () {
		expect(await liquidityPool.ephemeralDelta()).to.not.eq(0)
		expect(await liquidityPool.ephemeralLiabilities()).to.not.eq(0)
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			toWei("25"),
			true,
			true
		)
		// mock external adapter delta calculation
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
		const delta = await liquidityPool.getPortfolioDelta()
		const addressSet = await portfolioValuesFeed.getAddressSet()
		expect(delta.sub(localDelta)).to.be.within(-1000000000000, 1000000000000)
		// expect ephemeral values to be reset
		expect(await liquidityPool.ephemeralDelta()).to.eq(0)
		expect(await liquidityPool.ephemeralLiabilities()).to.eq(0)
	})
	it("writes more options for an existing series", async () => {
		const ephemeralDeltaBefore = await liquidityPool.ephemeralDelta()
		const ephemeralLiabilitiesBefore = await liquidityPool.ephemeralLiabilities()
		const amount = toWei("12")
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const LpBalanceBefore = tFormatUSDC(await usd.balanceOf(liquidityPool.address))
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const numberOTokensMintedBefore = await putOptionToken.totalSupply()

		const seriesInfo = await optionRegistry.getSeriesInfo(putOptionToken.address)
		const netDhvExposure = await getNetDhvExposure(
			seriesInfo.strike.mul(ethers.utils.parseUnits("1", 10)),
			usd.address,
			catalogue,
			expiration,
			PUT_FLAVOR
		)
		expect(netDhvExposure).to.eq(toWei("-25"))

		const expectedCollateralAllocated = await optionRegistry.getCollateral(seriesInfo, amount)
		const seriesInfoDecimalCorrected = {
			expiration: seriesInfo.expiration.toNumber(),
			strike: seriesInfo.strike.mul(1e10),
			isPut: seriesInfo.isPut,
			strikeAsset: seriesInfo.strikeAsset,
			underlying: seriesInfo.underlying,
			collateral: seriesInfo.collateral
		}

		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			seriesInfoDecimalCorrected,
			amount,
			pricer,
			false
		)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			seriesInfoDecimalCorrected,
			amount,
			false
		)
		const slippageFactor = await applySlippageLocally(
			pricer,
			catalogue,
			seriesInfoDecimalCorrected,
			amount,
			localDelta.div(parseFloat(fromWei(amount))),
			false
		)
		let quoteResponse = await pricer.quoteOptionPrice(
			seriesInfoDecimalCorrected,
			amount,
			false,
			netDhvExposure
		)
		let quote = quoteResponse[0].add(quoteResponse[2])
		const delta = quoteResponse[1]
		let localQuoteWithSlippage = localQuote * slippageFactor
		// slippage should make option more expensive as existing dhv exposure is short and this tx makes it more short
		expect(localQuoteWithSlippage).to.be.gt(localQuote)

		const truncQuote = truncate(localQuoteWithSlippage)
		const chainQuote = tFormatUSDC(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)
		await usd.approve(exchange.address, quote)
		await exchange.operate([
			{
				operation: 1,
				operationQueue: [
					{
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: putOptionToken.address,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						index: 0,
						data: "0x"
					}
				]
			}
		])

		const putBalanceAfter = await putOptionToken.balanceOf(senderAddress)
		const LpBalanceAfter = tFormatUSDC(await usd.balanceOf(liquidityPool.address))
		const numberOTokensMintedAfter = await putOptionToken.totalSupply()
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = collateralAllocatedAfter.sub(collateralAllocatedBefore)
		// check option buyer's OToken balance increases by correct amount
		expect(putBalanceAfter).to.eq(putBalance.add(utils.parseUnits(fromWei(amount), 8)))
		// LP USDC balance after should equal balanceBefore, minus collateral allocated, plus premium quote.
		// This does have a small rounding discrepency that might need looking into
		expect(
			LpBalanceAfter - LpBalanceBefore - (tFormatUSDC(quote) - tFormatUSDC(collateralAllocatedDiff))
		).to.be.within(-0.003, 0.003)
		// check number of OTokens minted increases
		expect(numberOTokensMintedAfter).to.eq(numberOTokensMintedBefore.add(amount.div(1e10)))
		// check expected amount of collateral was used
		expect(expectedCollateralAllocated).to.eq(collateralAllocatedDiff)
		// check ephemeral values update correctly
		const ephemeralLiabilitiesDiff =
			tFormatEth(await liquidityPool.ephemeralLiabilities()) - tFormatEth(ephemeralLiabilitiesBefore)
		const ephemeralDeltaDiff =
			tFormatEth(await liquidityPool.ephemeralDelta()) - tFormatEth(ephemeralDeltaBefore)
		expect(ephemeralDeltaDiff).to.equal(-tFormatEth(delta))
		expect(ephemeralLiabilitiesDiff - tFormatUSDC(quote.sub(quoteResponse[2]))).to.be.within(
			-0.01,
			0.01
		)
	})
	it("pauses and unpauses exchange contract", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		await exchange.pause()
		const amount = toWei("1")

		expect(await exchange.paused()).to.eq(true)

		await expect(
			exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: putOptionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWith("Pausable: paused")

		await exchange.unpause()
		expect(await exchange.paused()).to.eq(false)
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
		await volFeed.setSabrParameters(proposedSabrParams, expiration2)
		const volFeedSabrParams = await volFeed.sabrParams(expiration2)
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
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		await catalogue.issueNewSeries([
			{
				expiration: expiration2,
				isPut: PUT_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			}
		])
	})
	it("LP writes another ETH/USD put that expires later", async () => {
		const ephemeralDeltaBefore = await liquidityPool.ephemeralDelta()
		const ephemeralLiabilitiesBefore = await liquidityPool.ephemeralLiabilities()
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const [sender] = signers
		const amount = toWei("50")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const netDhvExposure = await getNetDhvExposure(
			strikePrice,
			usd.address,
			catalogue,
			expiration2,
			PUT_FLAVOR
		)
		expect(netDhvExposure).to.eq(0)

		const proposedSeries = {
			expiration: expiration2,
			strike: strikePrice,
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}

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
		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			proposedSeries,
			amount,
			pricer,
			false
		)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			amount,
			false
		)
		const slippageFactor = await applySlippageLocally(
			pricer,
			catalogue,
			proposedSeries,
			amount,
			localDelta.div(parseFloat(fromWei(amount))),
			false
		)
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		let localQuoteWithSlippage = localQuote * slippageFactor
		expect(localQuoteWithSlippage).to.be.gt(localQuote)
		let quote = quoteResponse[0].add(quoteResponse[2])
		let delta = quoteResponse[1]
		await usd.approve(exchange.address, quote)
		const buyerUSDBalanceBefore = await usd.balanceOf(senderAddress)
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
						index: 0,
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
						index: 0,
						data: "0x"
					}
				]
			}
		])
		const seriesAddress = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		putOptionToken2 = await ethers.getContractAt("Otoken", seriesAddress) as Otoken
		const putBalance = await putOptionToken2.balanceOf(senderAddress)

		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const buyerUSDBalanceAfter = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))

		// ensure quote is accurate
		const truncQuote = truncate(localQuoteWithSlippage)
		const chainQuote = tFormatUSDC(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)

		// ensure option buyer's OToken uyerUSDB is correct
		expect(putBalance).to.eq(opynAmount)
		// ensure correct amount of USD is taken from buyer's address
		expect(
			tFormatUSDC(buyerUSDBalanceBefore.sub(buyerUSDBalanceAfter)) - tFormatUSDC(quote)
		).to.be.within(-0.1, 0.1)

		// check pool balance increased by (quote - collateral)
		const poolBalanceDiff = poolBalanceAfter.sub(poolBalanceBefore)
		const collateralAllocatedDiff = collateralAllocatedAfter.sub(collateralAllocatedBefore)
		expect(
			tFormatUSDC(poolBalanceDiff) - (tFormatUSDC(quote) - tFormatUSDC(collateralAllocatedDiff))
		).to.be.within(-0.1, 0.1)
		// ensure allocated collateral is correct
		expect(
			tFormatUSDC(collateralAllocatedDiff) - tFormatUSDC(expectedCollateralAllocated)
		).to.be.within(-0.001, 0.001)
		// check ephemeral values update correctly
		const ephemeralLiabilitiesDiff =
			tFormatEth(await liquidityPool.ephemeralLiabilities()) - tFormatEth(ephemeralLiabilitiesBefore)
		const ephemeralDeltaDiff =
			tFormatEth(await liquidityPool.ephemeralDelta()) - tFormatEth(ephemeralDeltaBefore)
		expect(ephemeralDeltaDiff - -tFormatEth(delta)).to.be.within(-0.001, 0.001)
		expect(ephemeralLiabilitiesDiff - tFormatUSDC(quote.sub(quoteResponse[2]))).to.be.within(
			-0.01,
			0.01
		)
	})
	it("LP can buy back option to reduce open interest", async () => {
		// sender was added to buyback whitelist in prev test
		const amount = toWei("2")
		const putOptionAddress = putOptionToken.address
		const seriesInfo = await optionRegistry.getSeriesInfo(putOptionToken.address)
		const vaultId = await optionRegistry.vaultIds(putOptionToken.address)
		const vaultDetails = await controller.getVault(optionRegistry.address, vaultId)
		const netDhvExposure = await getNetDhvExposure(
			seriesInfo.strike.mul(ethers.utils.parseUnits("1", 10)),
			usd.address,
			catalogue,
			seriesInfo.expiration,
			PUT_FLAVOR
		)
		expect(netDhvExposure).to.eq(toWei("-37"))

		// expected collateral returned is no. options short div collateral allocated mul no. options bought back
		const expectedCollateralReturned =
			(tFormatUSDC(vaultDetails.collateralAmounts[0]) * parseInt(fromWei(amount))) /
			parseInt(fromOpyn(vaultDetails.shortAmounts[0]))

		const seriesInfoDecimalCorrected = {
			expiration: seriesInfo.expiration.toNumber(),
			isPut: seriesInfo.isPut,
			strike: seriesInfo.strike.mul(1e10),
			strikeAsset: seriesInfo.strikeAsset,
			underlying: seriesInfo.underlying,
			collateral: seriesInfo.collateral
		}

		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			seriesInfoDecimalCorrected,
			amount,
			pricer,
			true
		)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			seriesInfoDecimalCorrected,
			amount,
			true
		)
		const slippageFactor = await applySlippageLocally(
			pricer,
			catalogue,
			seriesInfoDecimalCorrected,
			amount,
			localDelta.div(parseFloat(fromWei(amount))),
			true
		)

		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await putOptionToken.totalSupply()
		const sellerOTokenBalanceBefore = await putOptionToken.balanceOf(senderAddress)
		const sellerUsdcBalanceBefore = await usd.balanceOf(senderAddress)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const ephemeralDeltaBefore = await liquidityPool.ephemeralDelta()
		const ephemeralLiabilitiesBefore = await liquidityPool.ephemeralLiabilities()

		await putOptionToken.approve(exchange.address, toOpyn("2.1"))
		let quoteResponse = await pricer.quoteOptionPrice(
			seriesInfoDecimalCorrected,
			amount,
			true,
			netDhvExposure
		)
		let quote = quoteResponse[0].sub(quoteResponse[2])
		let delta = quoteResponse[1]
		let localQuoteWithSlippage = localQuote * slippageFactor
		const truncQuote = truncate(localQuoteWithSlippage)
		const chainQuote = tFormatUSDC(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)
		const write = await exchange.operate([
			{
				operation: 1,
				operationQueue: [
					{
						actionType: 2,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: putOptionToken.address,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						index: 0,
						data: "0x"
					}
				]
			}
		])
		await write.wait(1)
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.BuybackOption(), 0)
		const buybackEvent = logs[0].args
		const totalSupplyAfter = await putOptionToken.totalSupply()
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = tFormatUSDC(
			collateralAllocatedBefore.sub(collateralAllocatedAfter)
		)
		const sellerOTokenBalanceAfter = await putOptionToken.balanceOf(senderAddress)
		const sellerUsdcBalanceAfter = await usd.balanceOf(senderAddress)
		const lpUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lpUSDBalanceDiff = tFormatUSDC(lpUSDBalanceBefore) - tFormatUSDC(lpUSDBalanceAfter)

		// expect number of options sold in event to be correct
		expect(buybackEvent.amount).to.equal(amount)
		// premium in emitted event is correct
		expect(tFormatUSDC(buybackEvent.premium) - tFormatUSDC(quote.add(quoteResponse[2]))).to.be.within(
			-0.001,
			0.001
		)
		// collateral returned in event is correct
		expect(tFormatUSDC(buybackEvent.escrowReturned)).to.equal(collateralAllocatedDiff)
		// option seller in event is correct
		// TODO: inform frontend team about the next line change
		// expect(buybackEvent.seller).to.equal(senderAddress)
		// expect correct amount of OTokens to be burned
		expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(toOpyn(fromWei(amount))))
		// seller's OToken balance goes down by correct amount
		expect(sellerOTokenBalanceAfter).to.equal(sellerOTokenBalanceBefore.sub(toOpyn(fromWei(amount))))
		// seller's USDC balance goes up by quoted amount
		expect(
			tFormatUSDC(sellerUsdcBalanceAfter) - (tFormatUSDC(sellerUsdcBalanceBefore) + tFormatUSDC(quote))
		).to.be.within(-0.002, 0.002)
		// liquidity pool USD balance goes down by (quote - collateralReturned)
		expect(lpUSDBalanceDiff - (tFormatUSDC(quote) - collateralAllocatedDiff)).to.be.within(
			-0.0011,
			0.0011
		)
		// collateral returned is correct amount
		expect(collateralAllocatedDiff - expectedCollateralReturned).to.be.within(-0.001, 0.001)
		// check ephemeral values update correctly
		const ephemeralLiabilitiesDiff =
			tFormatEth(await liquidityPool.ephemeralLiabilities()) - tFormatEth(ephemeralLiabilitiesBefore)
		const ephemeralDeltaDiff =
			tFormatEth(await liquidityPool.ephemeralDelta()) - tFormatEth(ephemeralDeltaBefore)
		expect(ephemeralDeltaDiff - tFormatEth(delta)).to.be.within(-0.01, 0.01)
		expect(ephemeralLiabilitiesDiff + tFormatUSDC(quote.add(quoteResponse[2]))).to.be.within(
			-0.01,
			0.01
		)
	})
	it("buys back an option if it moves delta closer to zero", async () => {
		const amount = toWei("5")

		const seriesInfo = await optionRegistry.getSeriesInfo(putOptionToken2.address)
		const vaultId = await optionRegistry.vaultIds(putOptionToken2.address)
		const vaultDetails = await controller.getVault(optionRegistry.address, vaultId)
		const netDhvExposure = await getNetDhvExposure(
			seriesInfo.strike.mul(ethers.utils.parseUnits("1", 10)),
			seriesInfo.collateral,
			catalogue,
			seriesInfo.expiration,
			seriesInfo.isPut
		)
		expect(netDhvExposure).to.eq(toWei("-50"))
		// expected collateral returned is no. options short div collateral allocated mul no. options bought back
		const expectedCollateralReturned =
			(tFormatUSDC(vaultDetails.collateralAmounts[0]) * parseInt(fromWei(amount))) /
			parseInt(fromOpyn(vaultDetails.shortAmounts[0]))

		const seriesInfoDecimalCorrected = {
			expiration: seriesInfo.expiration.toNumber(),
			isPut: seriesInfo.isPut,
			strike: seriesInfo.strike.mul(1e10),
			strikeAsset: seriesInfo.strikeAsset,
			underlying: seriesInfo.underlying,
			collateral: seriesInfo.collateral
		}
		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			seriesInfoDecimalCorrected,
			amount,
			pricer,
			true
		)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			seriesInfoDecimalCorrected,
			amount,
			true
		)
		let quoteResponse = await pricer.quoteOptionPrice(
			seriesInfoDecimalCorrected,
			amount,
			true,
			netDhvExposure
		)
		let quote = quoteResponse[0].sub(quoteResponse[2])
		let expectedDeltaChange = quoteResponse[1]
		let localQuoteWithSlippage = await localQuoteOptionPrice(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			seriesInfoDecimalCorrected,
			amount,
			pricer,
			true,
			catalogue,
			localDelta.div(amount.div(toWei("1"))),
			toWei("0").sub(toWei("50"))
		)
		// DHV is 50 short so a 5 buyback will still have positive slippage
		expect(localQuoteWithSlippage).to.be.gt(localQuote)
		// ensure quote is accurate
		const truncQuote = truncate(localQuoteWithSlippage)
		const chainQuote = tFormatUSDC(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)

		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const deltaBefore = await liquidityPool.getPortfolioDelta()
		const sellerOTokenBalanceBefore = await putOptionToken2.balanceOf(senderAddress)
		const sellerUSDBalanceBefore = await usd.balanceOf(senderAddress)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const ephemeralDeltaBefore = await liquidityPool.ephemeralDelta()
		const ephemeralLiabilitiesBefore = await liquidityPool.ephemeralLiabilities()
		await putOptionToken2.approve(exchange.address, toOpyn(fromWei(amount)))
		await exchange.operate([
			{
				operation: 1,
				operationQueue: [
					{
						actionType: 2,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: putOptionToken2.address,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						index: 0,
						data: "0x"
					}
				]
			}
		])

		const deltaAfter = await liquidityPool.getPortfolioDelta()
		const sellerOTokenBalanceAfter = await putOptionToken2.balanceOf(senderAddress)
		const lpUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const sellerUSDBalanceAfter = await usd.balanceOf(senderAddress)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = tFormatUSDC(
			collateralAllocatedBefore.sub(collateralAllocatedAfter)
		)

		// expect delta to be closer to 0 afterwards because selling back a put option
		expect(Math.abs(tFormatEth(deltaAfter))).to.be.lt(Math.abs(tFormatEth(deltaBefore)))
		// check option seller's OToken balance reduced
		expect(sellerOTokenBalanceAfter).to.equal(sellerOTokenBalanceBefore.sub(toOpyn(fromWei(amount))))
		// check option seller's USD balance increases by correct amount
		expect(tFormatUSDC(sellerUSDBalanceAfter.sub(sellerUSDBalanceBefore)).toPrecision(5)).to.eq(
			tFormatUSDC(quote).toPrecision(5)
		)
		// expect liquidity pool's USD balance decreases by correct amount
		expect(
			tFormatUSDC(lpUSDBalanceBefore.sub(lpUSDBalanceAfter)) -
			(tFormatUSDC(quote) - collateralAllocatedDiff)
		).to.be.within(-0.0011, 0.0011)
		// expect collateral allocated in LP reduces by correct amount
		expect(collateralAllocatedDiff - expectedCollateralReturned).to.be.within(-0.0011, 0.0011)
		// expect portfolio delta to change
		expect(tFormatEth(deltaAfter)).to.equal(tFormatEth(deltaBefore.add(expectedDeltaChange)))
		// check ephemeral values update correctly
		const ephemeralLiabilitiesDiff =
			tFormatEth(await liquidityPool.ephemeralLiabilities()) - tFormatEth(ephemeralLiabilitiesBefore)
		const ephemeralDeltaDiff =
			tFormatEth(await liquidityPool.ephemeralDelta()) - tFormatEth(ephemeralDeltaBefore)
		expect(ephemeralDeltaDiff - tFormatEth(expectedDeltaChange)).to.be.within(-0.01, 0.01)
		expect(ephemeralLiabilitiesDiff + tFormatUSDC(quote.add(quoteResponse[2]))).to.be.within(
			-0.01,
			0.01
		)
	})
	it("can compute portfolio delta", async function () {
		expect(await liquidityPool.ephemeralDelta()).to.not.eq(0)
		expect(await liquidityPool.ephemeralLiabilities()).to.not.eq(0)
		let localDelta = toWei("0")
		const addressSet = await portfolioValuesFeed.getAddressSet()
		for (let i = 0; i < addressSet.length; i++) {
			const seriesStore = await portfolioValuesFeed.storesForAddress(addressSet[i])
			const delta_ = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				{
					expiration: seriesStore.optionSeries.expiration.toNumber(),
					isPut: seriesStore.optionSeries.isPut,
					strike: seriesStore.optionSeries.strike,
					strikeAsset: seriesStore.optionSeries.strikeAsset,
					underlying: seriesStore.optionSeries.underlying,
					collateral: seriesStore.optionSeries.collateral
				},
				seriesStore.shortExposure,
				true,
				true
			)
			localDelta = localDelta.add(delta_)
		}
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
		const delta = await liquidityPool.getPortfolioDelta()
		const oracleDelta = (
			await portfolioValuesFeed.getPortfolioValues(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		).delta
		expect(tFormatEth(oracleDelta.sub(localDelta))).to.be.within(-5, 5)
		expect(delta.sub(localDelta)).to.be.within(-1e15, 1e15)
		// expect ephemeral values to be reset
		expect(await liquidityPool.ephemeralDelta()).to.eq(0)
		expect(await liquidityPool.ephemeralLiabilities()).to.eq(0)
	})
	it("reverts if option collateral exceeds buffer limit", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const ephemeralDeltaBefore = await liquidityPool.ephemeralDelta()
		const ephemeralLiabilitiesBefore = await liquidityPool.ephemeralLiabilities()

		const amount = toWei("1000")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration2,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await usd.approve(exchange.address, toWei("2000"))
		await expect(
			exchange.operate([
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
							index: 0,
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
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(liquidityPool, "MaxLiquidityBufferReached")

		const lpUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const ephemeralDeltaAfter = await liquidityPool.ephemeralDelta()
		const ephemeralLiabilitiesAfter = await liquidityPool.ephemeralLiabilities()
		expect(lpUSDBalanceBefore).to.eq(lpUSDBalanceAfter)
		expect(collateralAllocatedBefore).to.eq(collateralAllocatedAfter)
		expect(ephemeralDeltaBefore).to.eq(ephemeralDeltaAfter)
		expect(ephemeralLiabilitiesBefore).to.eq(ephemeralLiabilitiesAfter)
	})
	it("reverts when non-admin calls rebalance function", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		await expect(liquidityPool.connect(signers[1]).rebalancePortfolioDelta(delta, 0)).to.be.reverted
	})
	it("reverts when rebalance delta too small", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		await expect(liquidityPool.connect(signers[1]).rebalancePortfolioDelta(toWei("0.00001"), 0)).to.be
			.reverted
	})
	it("returns zero when hedging positive delta when reactor has no funds", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		expect(delta).to.be.gt(0)
		const reactorDelta = await uniswapV3HedgingReactor.internalDelta()
		await liquidityPool.rebalancePortfolioDelta(delta, 0)
		const newReactorDelta = await uniswapV3HedgingReactor.internalDelta()
		const newDelta = await liquidityPool.getPortfolioDelta()
		expect(reactorDelta).to.equal(newReactorDelta).to.equal(0)
		expect(newDelta.sub(delta)).to.be.within(0, 1e13)
	})

	it("Returns a quote for ETH/USD call with utilization", async () => {
		const amount = toWei("50")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.add(toWei(strike))
		const optionSeries = {
			expiration: expiration,
			strike: strikePrice,
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			optionSeries,
			amount,
			pricer,
			false
		)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			optionSeries,
			amount,
			false
		)
		const slippageFactor = await applySlippageLocally(
			pricer,
			catalogue,
			optionSeries,
			amount,
			localDelta.div(parseFloat(fromWei(amount))),
			false
		)
		let quoteResponse = await pricer.quoteOptionPrice(optionSeries, amount, false, 0)
		let localQuoteWithSlippage = localQuote * slippageFactor
		expect(localQuoteWithSlippage).to.be.gt(localQuote)
		let quote = quoteResponse[0].add(quoteResponse[2])
		const truncQuote = truncate(localQuoteWithSlippage)
		const chainQuote = tFormatUSDC(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)
	})
	it("Succeeds: User 2: Deposit to the liquidityPool", async () => {
		const user = receiverAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.depositEpoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await usd.connect(signers[1]).approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(
			await liquidityPool.connect(signers[1]).callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))
		).to.be.true
		const deposit = await liquidityPool.connect(signers[1]).deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.depositEpoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[1].args
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
	it("Succeed: User 1: redeems all shares", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.depositEpoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		// set as big number to redeem all
		const toRedeem = await liquidityPool.callStatic.redeem(toWei("100000000000000"))
		await liquidityPool.redeem(toWei("100000000000000"))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.depositEpoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Redeem(), 0)
		const redeemEvent = logs[0].args
		expect(redeemEvent.recipient).to.equal(user)
		expect(redeemEvent.amount).to.equal(toRedeem)
		expect(redeemEvent.epoch).to.equal(epochBefore.sub(1))
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceAfter.sub(lpBalanceBefore)).to.equal(toRedeem)
		expect(lpusdBalanceBefore).to.equal(lpusdBalanceAfter)
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(toRedeem)
		expect(epochAfter).to.equal(epochBefore)
		expect(depositReceiptAfter.epoch).to.equal(epochBefore.sub(1)).to.equal(epochAfter.sub(1))
		expect(depositReceiptBefore.amount.sub(depositReceiptAfter.amount)).to.equal(
			depositReceiptBefore.amount
		)
		expect(depositReceiptAfter.amount).to.equal(0)
		expect(
			depositReceiptBefore.unredeemedShares.add(
				depositReceiptBefore.amount
					.mul(collatDecimalShift)
					.mul(toWei("1"))
					.div(await liquidityPool.depositEpochPricePerShare(depositReceiptBefore.epoch))
			)
		).to.equal(toRedeem)
		expect(depositReceiptAfter.unredeemedShares).to.equal(0)
		expect(await liquidityPool.allowance(liquidityPool.address, user)).to.equal(0)
	})
	it("Succeeds: pauses trading", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const prevalues = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
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
			toWei("1")
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
	it("Succeed: User 1: Initiates Withdraw for half owned balance", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		await liquidityPool.initiateWithdraw(lpBalanceBefore.div(2))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.InitiateWithdraw(), 0)
		const initWithdrawEvent = logs[0].args
		expect(initWithdrawEvent.recipient).to.equal(user)
		expect(initWithdrawEvent.amount).to.equal(lpBalanceBefore.div(2))
		expect(initWithdrawEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(lpBalanceBefore.div(2))
		expect(lpusdBalanceAfter).to.equal(lpusdBalanceBefore)
		expect(lplpBalanceAfter.sub(lplpBalanceBefore)).to.equal(lpBalanceBefore.div(2))
		expect(withdrawalReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(withdrawalReceiptBefore.epoch).to.equal(0)
		expect(withdrawalReceiptAfter.shares).to.equal(lpBalanceBefore.div(2))
		expect(withdrawalReceiptBefore.shares).to.equal(0)
	})
	it("pauses and unpauses LP contract", async () => {
		await usd.approve(liquidityPool.address, toUSDC("200"))
		await liquidityPool.deposit(toUSDC("100"))
		await liquidityPool.pause()
		await expect(liquidityPool.deposit(toUSDC("100"))).to.be.revertedWith("Pausable: paused")
		await liquidityPool.unpause()
	})

	it("settles an expired ITM vault", async () => {
		const totalCollateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const vaultId = await optionRegistry.vaultIds(putOptionToken.address)
		const collateralAllocatedToVault = (await controller.getVault(optionRegistry.address, vaultId))
			.collateralAmounts[0]
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		const strikePrice = await putOptionToken.strikePrice()
		// set price to $80 ITM for put
		const settlePrice = strikePrice.sub(toWei("80").div(oTokenDecimalShift18))
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		// settle the vault
		const settleVault = await liquidityPool.settleVault(putOptionToken.address)
		let receipt = await settleVault.wait()
		const events = receipt.events
		const settleEvent = events?.find(x => x.event == "SettleVault")
		const collateralReturned = settleEvent?.args?.collateralReturned
		const collateralLost = settleEvent?.args?.collateralLost
		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lpBalanceDiff = tFormatUSDC(lpBalanceAfter.sub(lpBalanceBefore))

		// puts expired ITM, so the amount ITM will be subtracted and used to pay out option holders
		const optionITMamount = strikePrice.sub(settlePrice)
		const amount = parseFloat(utils.formatUnits(await putOptionToken.totalSupply(), 8))
		// format from e8 oracle price to e6 USDC decimals
		// check collateral returned to LP is correct
		expect(
			tFormatUSDC(collateralReturned) -
			tFormatUSDC(collateralAllocatedToVault.sub(optionITMamount.div(100).mul(amount)))
		).to.be.within(-0.001, 0.001)
		// check LP USDC balance increases by correct amount
		expect(lpBalanceDiff).to.eq(tFormatUSDC(collateralReturned))
		// check collateralAllocated updates to correct amount
		expect(await liquidityPool.collateralAllocated()).to.equal(
			totalCollateralAllocatedBefore.sub(collateralReturned).sub(collateralLost)
		)
	})

	it("settles an expired OTM vault", async () => {
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		const strikePrice = await putOptionToken2.strikePrice()
		// set price to $100 OTM for put
		const settlePrice = strikePrice.add(toWei("100").div(oTokenDecimalShift18))
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration2, settlePrice)
		// settle the vault
		const settleVault = await liquidityPool.settleVault(putOptionToken2.address)
		let receipt = await settleVault.wait()
		const events = receipt.events
		const settleEvent = events?.find(x => x.event == "SettleVault")
		const collateralReturned = settleEvent?.args?.collateralReturned
		const collateralLost = settleEvent?.args?.collateralLost
		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		// puts expired OTM, so all collateral should be returned
		const amount = parseFloat(utils.formatUnits(await putOptionToken.totalSupply(), 8))
		expect(lpBalanceAfter.sub(lpBalanceBefore)).to.equal(collateralReturned) // format from e8 oracle price to e6 USDC decimals
		expect(collateralAllocatedBefore.sub(collateralAllocatedAfter)).to.equal(collateralReturned)
		expect(collateralLost).to.equal(0)
	})
	it("Reverts: tries to sell an expired option back to the pool", async () => {
		await expect(
			exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: putOptionToken2.address,
							vaultId: 0,
							amount: toWei("3"),
							optionSeries: proposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.revertedWithCustomError(exchange, "OptionExpiryInvalid")
	})
	it("Reverts: tries to write an option that doesnt exist in the handler", async () => {
		await expect(
			exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: exchange.address,
							vaultId: 0,
							amount: toWei("3"),
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
		).to.be.reverted
	})
	it("updates option params with setter", async () => {
		await liquidityPool.setNewOptionParams(
			utils.parseEther("700"),
			utils.parseEther("12000"),
			utils.parseEther("200"),
			utils.parseEther("6000"),
			86400 * 3,
			86400 * 365
		)

		const minCallStrikePrice = (await liquidityPool.optionParams()).minCallStrikePrice
		const maxCallStrikePrice = (await liquidityPool.optionParams()).maxCallStrikePrice
		const minPutStrikePrice = (await liquidityPool.optionParams()).minPutStrikePrice
		const maxPutStrikePrice = (await liquidityPool.optionParams()).maxPutStrikePrice
		const minExpiry = (await liquidityPool.optionParams()).minExpiry
		const maxExpiry = (await liquidityPool.optionParams()).maxExpiry

		expect(minCallStrikePrice).to.equal(utils.parseEther("700"))
		expect(maxCallStrikePrice).to.equal(utils.parseEther("12000"))
		expect(minPutStrikePrice).to.equal(utils.parseEther("200"))
		expect(maxPutStrikePrice).to.equal(utils.parseEther("6000"))
		expect(minExpiry).to.equal(86400 * 3)
		expect(maxExpiry).to.equal(86400 * 365)
	})
	it("updates collateralCap variable", async () => {
		const beforeValue = await liquidityPool.collateralCap()
		const expectedValue = toWei("1000000000000000")
		await liquidityPool.setCollateralCap(expectedValue)
		const afterValue = await liquidityPool.collateralCap()
		expect(afterValue).to.eq(expectedValue)
		expect(afterValue).to.not.eq(beforeValue)
	})
	it("updates bufferPercentage variable", async () => {
		const beforeValue = await liquidityPool.bufferPercentage()
		expect(beforeValue).to.equal(5000)
		const expectedValue = 1500
		await liquidityPool.setBufferPercentage(expectedValue)
		const afterValue = await liquidityPool.bufferPercentage()
		expect(afterValue).to.eq(expectedValue)
		expect(afterValue).to.not.eq(beforeValue)
	})
	it("updates riskFreeRate variable", async () => {
		const beforeValue = await liquidityPool.riskFreeRate()
		expect(beforeValue).to.equal(toWei("0.01"))
		const expectedValue = toWei("0.06")
		await liquidityPool.setRiskFreeRate(expectedValue)
		const afterValue = await liquidityPool.riskFreeRate()
		expect(afterValue).to.eq(expectedValue)
		expect(afterValue).to.not.eq(beforeValue)
	})
	it("pauses trading", async () => {
		await liquidityPool.pauseUnpauseTrading(true)
		expect(await liquidityPool.isTradingPaused()).to.be.true
		await liquidityPool.pauseUnpauseTrading(false)
		expect(await liquidityPool.isTradingPaused()).to.be.false
	})
	it("handler-only functions in Liquidity pool revert if not called by handler", async () => {
		await expect(liquidityPool.resetEphemeralValues()).to.be.reverted
		await expect(
			liquidityPool.handlerBuybackOption(
				proposedSeries,
				toWei("1"),
				optionRegistry.address,
				putOptionToken.address,
				toWei("1"),
				toWei("1"),
				senderAddress
			)
		).to.be.reverted
		await expect(liquidityPool.handlerIssue(proposedSeries)).to.be.reverted
		await expect(
			liquidityPool.handlerWriteOption(
				proposedSeries,
				putOptionToken.address,
				toWei("1"),
				optionRegistry.address,
				toWei("1"),
				toWei("1"),
				senderAddress
			)
		).to.be.reverted
		await expect(
			liquidityPool.handlerIssueAndWriteOption(
				proposedSeries,
				toWei("1"),
				toWei("1"),
				toWei("1"),
				senderAddress
			)
		).to.be.reverted
	})
	// have as final test as this just sets things wrong
	it("protocol changes feeds", async () => {
		await optionProtocol.changePortfolioValuesFeed(priceFeed.address)
		await optionProtocol.changeVolatilityFeed(priceFeed.address)
		await optionProtocol.changeAccounting(priceFeed.address)
		await optionProtocol.changePriceFeed(volFeed.address)
		expect(await optionProtocol.accounting()).to.eq(priceFeed.address)
		expect(await optionProtocol.portfolioValuesFeed()).to.eq(priceFeed.address)
		expect(await optionProtocol.volatilityFeed()).to.eq(priceFeed.address)
		expect(await optionProtocol.priceFeed()).to.eq(volFeed.address)
	})
	it("reverts when setting new handler address to zero", async () => {
		await expect(liquidityPool.changeHandler(ZERO_ADDRESS, true)).to.be.revertedWithCustomError(
			liquidityPool,
			"InvalidAddress"
		)
	})
	it("reverts when setting new keeper address to zero", async () => {
		await expect(liquidityPool.setKeeper(ZERO_ADDRESS, true)).to.be.revertedWithCustomError(
			liquidityPool,
			"InvalidAddress"
		)
	})
	it("sets a new pricer on the exchange", async () => {
		await exchange.setPricer(liquidityPool.address)
		expect(await exchange.pricer()).to.equal(liquidityPool.address)
		await exchange.setPricer(pricer.address)
		expect(await exchange.pricer()).to.equal(pricer.address)
	})
})
