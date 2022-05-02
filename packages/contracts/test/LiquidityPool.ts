import hre, { ethers, network } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber, providers } from "ethers"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import {
	toWei,
	truncate,
	tFormatEth,
	call,
	put,
	genOptionTimeFromUnix,
	fromWei,
	percentDiff,
	toUSDC,
	fromOpyn,
	toOpyn,
	tFormatUSDC,
	scaleNum,
	fromWeiToUSDC
} from "../utils/conversion-helper"
import moment from "moment"
//@ts-ignore
import bs from "black-scholes"
import { deployOpyn } from "../utils/opyn-deployer"
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { UniswapV3HedgingReactor } from "../types/UniswapV3HedgingReactor"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { MockPortfolioValuesFeed } from "../types/MockPortfolioValuesFeed"
import { LiquidityPool } from "../types/LiquidityPool"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import { Volatility } from "../types/Volatility"
import { VolatilityFeed } from "../types/VolatilityFeed"
import { NewController } from "../types/NewController"
import { AddressBook } from "../types/AddressBook"
import { Oracle } from "../types/Oracle"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import {
	setupTestOracle,
	setupOracle,
	calculateOptionQuoteLocally,
	calculateOptionDeltaLocally,
	increase,
	setOpynOracleExpiryPrice
} from "./helpers"
import {
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS,
	ADDRESS_BOOK,
	UNISWAP_V3_SWAP_ROUTER,
	CONTROLLER_OWNER,
	GAMMA_ORACLE_NEW,
	CHAINLINK_WETH_PRICER
} from "./constants"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import exp from "constants"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { ERC20Interface } from "../types/ERC20Interface"
import { OptionHandler } from "../types/OptionHandler"
import { Console } from "console"
let usd: MintableERC20
let weth: WETH
let wethERC20: ERC20Interface
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let volatility: Volatility
let volFeed: VolatilityFeed
let priceFeed: PriceFeed
let portfolioValuesFeed: MockPortfolioValuesFeed
let uniswapV3HedgingReactor: UniswapV3HedgingReactor
let rate: string
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let putOptionToken: IOToken
let putOptionToken2: IOToken
let collateralAllocatedToVault1: BigNumber
let proposedSeries: any
let handler: OptionHandler

const IMPLIED_VOL = "60"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

const invalidExpiryDateLong: string = "2024-09-03"
const invalidExpiryDateShort: string = "2022-03-01"
// decimal representation of a percentage
const rfr: string = "0.03"
// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = "20"

// hardcoded value for strike price that is outside of accepted bounds
const invalidStrikeHigh = utils.parseEther("12500")
const invalidStrikeLow = utils.parseEther("200")

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "60000"
const liquidityPoolWethDeposit = "1"

// balance to withdraw after deposit
const liquidityPoolWethWidthdraw = "0.1"

const minCallStrikePrice = utils.parseEther("500")
const maxCallStrikePrice = utils.parseEther("10000")
const minPutStrikePrice = utils.parseEther("500")
const maxPutStrikePrice = utils.parseEther("10000")
// one week in seconds
const minExpiry = 86400 * 7
// 365 days in seconds
const maxExpiry = 86400 * 365

// time travel period between each expiry
const expiryPeriod = {
	days: 0,
	weeks: 0,
	months: 1,
	years: 0
}
const productSpotShockValue = scaleNum("0.6", 27)
// array of time to expiry
const day = 60 * 60 * 24
const timeToExpiry = [day * 7, day * 14, day * 28, day * 42, day * 56]
// array of upper bound value correspond to time to expiry
const expiryToValue = [
	scaleNum("0.1678", 27),
	scaleNum("0.237", 27),
	scaleNum("0.3326", 27),
	scaleNum("0.4032", 27),
	scaleNum("0.4603", 27)
]

/* --- end variables to change --- */

const expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000
const expiration2 = moment.utc(expiryDate).add(1, "w").add(8, "h").valueOf() / 1000 // have another batch of options exire 1 week after the first
const expiration3 = moment.utc(expiryDate).add(2, "w").add(8, "h").valueOf() / 1000
const expiration4 = moment.utc(expiryDate).add(3, "w").add(8, "h").valueOf() / 1000
const invalidExpirationLong = moment.utc(invalidExpiryDateLong).add(8, "h").valueOf() / 1000
const invalidExpirationShort = moment.utc(invalidExpiryDateShort).add(8, "h").valueOf() / 1000

const CALL_FLAVOR = false
const PUT_FLAVOR = true

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
		let opynParams = await deployOpyn(signers, productSpotShockValue, timeToExpiry, expiryToValue)
		controller = opynParams.controller
		addressBook = opynParams.addressBook
		oracle = opynParams.oracle
		newCalculator = opynParams.newCalculator
		const [sender] = signers

		const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
		await sender.sendTransaction({
			to: signer.address,
			value: ethers.utils.parseEther("10.0") // Sends exactly 10.0 ether
		})

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
		let lpParams = await deployLiquidityPool(
			signers,
			optionProtocol,
			usd,
			wethERC20,
			rfr,
			minCallStrikePrice,
			minPutStrikePrice,
			maxCallStrikePrice,
			maxPutStrikePrice,
			minExpiry,
			maxExpiry,
			optionRegistry,
			portfolioValuesFeed
		)
		volatility = lpParams.volatility
		liquidityPool = lpParams.liquidityPool
		handler = lpParams.handler
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
	})
	it("Deposit to the liquidityPool", async () => {
		const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_WHALE]
		})
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		await usdWhaleConnect.transfer(senderAddress, toUSDC("1000000"))
		await usdWhaleConnect.transfer(receiverAddress, toUSDC("1000000"))
		const senderBalance = await usd.balanceOf(senderAddress)
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit), senderAddress)
		const liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const receipt = await deposit.wait(1)
		const event = receipt?.events?.find(x => x.event == "Deposit")
		const newSenderBalance = await usd.balanceOf(senderAddress)
		expect(event?.event).to.eq("Deposit")
		expect(senderBalance.sub(newSenderBalance)).to.eq(toUSDC(liquidityPoolUsdcDeposit))
		expect(liquidityPoolBalance.toString()).to.eq(toWei(liquidityPoolUsdcDeposit))
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
			priceFeed.address
		)) as UniswapV3HedgingReactor

		expect(uniswapV3HedgingReactor).to.have.property("hedgeDelta")
	})
	it("sets reactor address on LP contract", async () => {
		const reactorAddress = uniswapV3HedgingReactor.address

		await liquidityPool.setHedgingReactorAddress(reactorAddress)

		await expect(await liquidityPool.hedgingReactors(0)).to.equal(reactorAddress)
	})
	it("Returns a quote for a ETH/USD put with utilization", async () => {
		const amount = toWei("5")
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
			priceFeed,
			optionSeries,
			amount
		)

		const quote = (
			await liquidityPool.quotePriceWithUtilizationGreeks(
				{
					expiration: expiration,
					strike: BigNumber.from(strikePrice),
					isPut: PUT_FLAVOR,
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: usd.address
				},
				amount
			)
		)[0]
		const truncQuote = truncate(localQuote)
		const chainQuote = tFormatEth(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)
	})

	it("Returns a quote for a ETH/USD put to buy", async () => {
		const thirtyPercentStr = "0.3"
		const thirtyPercent = toWei(thirtyPercentStr)
		await liquidityPool.setBidAskSpread(thirtyPercent)
		const amount = toWei("1")
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
			priceFeed,
			optionSeries,
			amount,
			true
		)

		const buyQuotes = await liquidityPool.quotePriceBuying(optionSeries, amount)
		const buyQuote = buyQuotes[0]
		const truncQuote = truncate(localQuote)
		const chainQuote = tFormatEth(buyQuote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 0.1)
	})

	it("reverts when attempting to write ETH/USD puts with expiry outside of limit", async () => {
		const [sender] = signers
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		// series with expiry too long
		const proposedSeries1 = {
			expiration: invalidExpirationLong,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries1, amount))[0]
		await usd.approve(handler.address, quote)
		await expect(handler.issueAndWriteOption(proposedSeries1, amount)).to.be.revertedWith(
			"OptionExpiryInvalid()"
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
		const quote2 = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries2, amount))[0]
		await usd.approve(handler.address, quote2)
		await expect(handler.issueAndWriteOption(proposedSeries2, amount)).to.be.revertedWith(
			"OptionExpiryInvalid()"
		)
	})
	it("reverts when attempting to write a ETH/USD put with strike outside of limit", async () => {
		const [sender] = signers
		const amount = toWei("7")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		// Series with strike price too high
		const proposedSeries1 = {
			expiration: expiration,
			strike: invalidStrikeHigh,
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries1, amount))[0]
		await usd.approve(handler.address, quote)
		await expect(handler.issueAndWriteOption(proposedSeries1, amount)).to.be.revertedWith(
			"OptionStrikeInvalid()"
		)
		// Series with strike price too low

		const proposedSeries2 = {
			expiration: expiration,
			strike: invalidStrikeLow,
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const quote2 = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries2, amount))[0]
		await usd.approve(handler.address, quote2)
		await expect(handler.issueAndWriteOption(proposedSeries2, amount)).to.be.revertedWith(
			"OptionStrikeInvalid()"
		)
	})
	it("can compute portfolio delta", async function () {
		const delta = await liquidityPool.getPortfolioDelta()
		expect(delta).to.equal(0)
	})
	it("LP Writes a ETH/USD put for premium", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
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
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
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

		await usd.approve(handler.address, quote)
		const seriesAddress = (await handler.callStatic.issueAndWriteOption(proposedSeries, amount))
			.series
		putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		await handler.issueAndWriteOption(proposedSeries, amount)

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
			tFormatUSDC(senderUSDBalanceBefore.sub(senderUSDBalanceAfter)) - tFormatEth(quote)
		).to.be.within(-0.1, 0.1)

		const poolUSDBalanceDiff = tFormatUSDC(poolBalanceAfter.sub(poolBalanceBefore))
		const expectedUSDBalanceDiff = tFormatEth(quote) - tFormatUSDC(collateralAllocatedDiff)
		// check LP USDC balance is changed
		expect(poolUSDBalanceDiff - expectedUSDBalanceDiff).to.be.within(-0.0015, 0.0015)
		// check collateral allocated is increased
		expect(
			tFormatUSDC(collateralAllocatedDiff) - tFormatUSDC(expectedCollateralAllocated)
		).to.be.within(-0.001, 0.001)
	})
	it("can compute portfolio delta", async function () {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			toWei("1"),
			true
		)
		// mock external adapter delta calculation
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			localDelta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0)
		)
		const delta = await liquidityPool.getPortfolioDelta()
		expect(delta.sub(localDelta)).to.be.within(0, 100000000000)
	})
	it("writes more options for an existing series", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const amount = toWei("12")
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const LpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const numberOTokensMintedBefore = await putOptionToken.totalSupply()

		const seriesInfo = await optionRegistry.getSeriesInfo(putOptionToken.address)
		const seriesInfoDecimalCorrected = {
			expiration: seriesInfo.expiration,
			strike: seriesInfo.strike.mul(1e10),
			isPut: seriesInfo.isPut,
			strikeAsset: seriesInfo.strikeAsset,
			underlying: seriesInfo.underlying,
			collateral: seriesInfo.collateral
		}
		const quote = utils.formatUnits(
			(await liquidityPool.quotePriceWithUtilizationGreeks(seriesInfoDecimalCorrected, amount))[0],
			12
		)
		await handler.writeOption(putOptionToken.address, amount)

		const putBalanceAfter = await putOptionToken.balanceOf(senderAddress)
		const LpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const numberOTokensMintedAfter = await putOptionToken.totalSupply()
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = collateralAllocatedAfter.sub(collateralAllocatedBefore)
		// check option buyer's OToken balance increases by correct amount
		expect(putBalanceAfter).to.eq(putBalance.add(utils.parseUnits(fromWei(amount), 8)))
		// LP USDC balance after should equal balanceBefore, minus collateral allocated, plus premium quote.
		// This does have a small rounding discrepency that might need looking into
		expect(
			LpBalanceAfter.sub(
				LpBalanceBefore.add(BigNumber.from(parseInt(quote))).sub(collateralAllocatedDiff)
			)
		).to.be.within(-1000, 1000)
		// check number of OTokens minted increases
		expect(numberOTokensMintedAfter).to.eq(numberOTokensMintedBefore.add(amount.div(1e10)))
	})
	it("pauses and unpauses handler contract", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		await handler.pauseContract()
		const amount = toWei("1")

		await expect(handler.writeOption(putOptionToken.address, amount)).to.be.revertedWith(
			"Pausable: paused"
		)

		await handler.unpause()
	})
	it("LP writes another ETH/USD put that expires later", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const [sender] = signers
		const amount = toWei("8")
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
		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			amount
		)
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lpAllocatedBefore = await liquidityPool.collateralAllocated()
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await usd.approve(handler.address, quote)
		const balance = await usd.balanceOf(senderAddress)
		const seriesAddress = (await handler.callStatic.issueAndWriteOption(proposedSeries, amount))
			.series
		const write = await handler.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		putOptionToken2 = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken2.balanceOf(senderAddress)
		const lpAllocatedAfter = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew)) - tFormatEth(quote)).to.be.within(-0.1, 0.1)
		const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
		const lpAllocatedDiff = lpAllocatedAfter.sub(lpAllocatedBefore)
		expect(
			tFormatUSDC(poolBalanceDiff) + tFormatEth(quote) - tFormatUSDC(lpAllocatedDiff)
		).to.be.within(-0.1, 0.1)
	})

	it("adds address to the buyback whitelist", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		await expect(await handler.buybackWhitelist(senderAddress)).to.be.false
		await handler.addOrRemoveBuybackAddress(senderAddress, true)
		await expect(await handler.buybackWhitelist(senderAddress)).to.be.true
	})

	it("LP can buy back option to reduce open interest", async () => {
		const [sender] = signers
		const amount = toWei("2")
		const putOptionAddress = putOptionToken.address
		const seriesInfo = await optionRegistry.getSeriesInfo(putOptionToken.address)

		const seriesInfoDecimalCorrected = {
			expiration: seriesInfo.expiration,
			isPut: seriesInfo.isPut,
			strike: seriesInfo.strike.mul(1e10),
			strikeAsset: seriesInfo.strikeAsset,
			underlying: seriesInfo.underlying,
			collateral: seriesInfo.collateral
		}

		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await putOptionToken.totalSupply()
		const sellerOTokenBalanceBefore = await putOptionToken.balanceOf(senderAddress)
		const sellerUsdcBalanceBefore = await usd.balanceOf(senderAddress)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()

		await putOptionToken.approve(handler.address, toOpyn(fromWei(amount)))
		const quote = (await liquidityPool.quotePriceBuying(seriesInfoDecimalCorrected, amount))[0]
		const write = await handler.buybackOption(putOptionAddress, amount)
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

		expect(buybackEvent.amount).to.equal(amount)
		expect(tFormatUSDC(buybackEvent.premium) - tFormatEth(quote)).to.be.within(-0.001, 0.001)
		expect(tFormatUSDC(buybackEvent.escrowReturned)).to.equal(collateralAllocatedDiff)
		expect(buybackEvent.seller).to.equal(senderAddress)
		expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(toOpyn(fromWei(amount))))
		expect(sellerOTokenBalanceAfter).to.equal(sellerOTokenBalanceBefore.sub(toOpyn(fromWei(amount))))
		expect(
			tFormatUSDC(sellerUsdcBalanceAfter) - (tFormatUSDC(sellerUsdcBalanceBefore) + tFormatEth(quote))
		).to.be.within(-0.002, 0.002)
		expect(lpUSDBalanceDiff - (tFormatEth(quote) - collateralAllocatedDiff)).to.be.within(
			-0.001,
			0.001
		)
	})
	it("fails if buyback token address is invalid", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const amount = toWei("1")
		// ETH_ADDRESS is not a valid OToken address
		await expect(handler.buybackOption(ETH_ADDRESS, amount)).to.be.revertedWith("NonExistentOtoken()")
	})
	it("buys back an option from a non-whitelisted address if it moves delta closer to zero", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const amount = toWei("2")

		await handler.addOrRemoveBuybackAddress(senderAddress, false)
		await expect(await handler.buybackWhitelist(senderAddress)).to.be.false

		const seriesInfo = await optionRegistry.getSeriesInfo(putOptionToken2.address)

		const seriesInfoDecimalCorrected = {
			expiration: seriesInfo.expiration,
			isPut: seriesInfo.isPut,
			strike: seriesInfo.strike.mul(1e10),
			strikeAsset: seriesInfo.strikeAsset,
			underlying: seriesInfo.underlying,
			collateral: seriesInfo.collateral
		}

		const deltaBefore = await liquidityPool.getPortfolioDelta()
		const sellerOTokenBalanceBefore = await putOptionToken2.balanceOf(senderAddress)

		const expectedDeltaChange = (
			await liquidityPool.quotePriceBuying(seriesInfoDecimalCorrected, amount)
		)[1]

		await putOptionToken2.approve(handler.address, toOpyn(fromWei(amount)))
		await handler.buybackOption(putOptionToken2.address, amount)

		const deltaAfter = await liquidityPool.getPortfolioDelta()
		const sellerOTokenBalanceAfter = await putOptionToken2.balanceOf(senderAddress)
		expect(Math.abs(tFormatEth(deltaAfter))).to.be.lt(Math.abs(tFormatEth(deltaBefore)))
		expect(sellerOTokenBalanceAfter).to.equal(sellerOTokenBalanceBefore.sub(toOpyn(fromWei(amount))))

		// *************************************************************************
		// Believe this line is failing due to the discrepancy of weighting vars ***
		// *************************************************************************
		expect(deltaAfter).to.equal(deltaBefore.add(expectedDeltaChange.mul(tFormatEth(amount))))
	})
	it("can compute portfolio delta", async function () {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block

		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			toWei("1"),
			true
		)
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("1"),
			weth.address,
			usd.address,
			localDelta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0)
		)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries2 = {
			expiration: expiration2,
			isPut: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localDelta2 = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries2,
			toWei("3"),
			true
		)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("1"),
			weth.address,
			usd.address,
			localDelta.add(localDelta2),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0)
		)
		const delta = await liquidityPool.getPortfolioDelta()
		const oracleDelta = (
			await portfolioValuesFeed.getPortfolioValues(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		).delta
		expect(oracleDelta.sub(localDelta.add(localDelta2))).to.be.within(-5, 5)
		expect(delta.sub(localDelta.add(localDelta2))).to.be.within(-1e15, 1e15)
	})
	it("reverts if option collateral exceeds buffer limit", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lpBalance = await usd.balanceOf(liquidityPool.address)
		const collateralAllocated = await liquidityPool.collateralAllocated()
		const amount = toWei("20")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration3,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await expect(handler.issueAndWriteOption(proposedSeries, amount)).to.be.revertedWith(
			"MaxLiquidityBufferReached"
		)
	})
	it("reverts when non-admin calls rebalance function", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		await expect(liquidityPool.connect(signers[1]).rebalancePortfolioDelta(delta, 0)).to.be.reverted
	})
	it("returns zero when hedging positive delta when reactor has no funds", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		const reactorDelta = await uniswapV3HedgingReactor.internalDelta()
		await liquidityPool.rebalancePortfolioDelta(delta, 0)
		const newReactorDelta = await uniswapV3HedgingReactor.internalDelta()
		const newDelta = await liquidityPool.getPortfolioDelta()
		expect(reactorDelta).to.equal(newReactorDelta).to.equal(0)
		expect(newDelta.sub(delta)).to.be.within(0, 1e13)
	})

	it("Returns a quote for ETH/USD call with utilization", async () => {
		const amount = toWei("5")
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
			priceFeed,
			optionSeries,
			amount
		)

		const quote = (
			await liquidityPool.quotePriceWithUtilizationGreeks(
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: BigNumber.from(strikePrice),
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: usd.address
				},
				amount
			)
		)[0]
		const truncQuote = truncate(localQuote)
		const chainQuote = tFormatEth(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.within(0, 1)
	})

	let optionToken: IOToken
	let customOrderPrice: number
	it("Creates a buy order", async () => {
		let customOrderPriceMultiplier = 0.93
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei("600"))
		const amount = toWei("5")
		const orderExpiry = 10
		const proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: true,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			amount
		)
		customOrderPrice = localQuote * customOrderPriceMultiplier
		await handler.createOrder(
			proposedSeries,
			amount,
			toWei(customOrderPrice.toString()).mul(toWei("1")).div(amount),
			orderExpiry,
			receiverAddress
		)
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const order = await handler.orderStores(1)
		expect(order.optionSeries.expiration).to.eq(proposedSeries.expiration)
		expect(order.optionSeries.isPut).to.eq(proposedSeries.isPut)
		expect(
			order.optionSeries.strike.sub(proposedSeries.strike.div(oTokenDecimalShift18))
		).to.be.within(-100, 0)
		expect(order.optionSeries.underlying).to.eq(proposedSeries.underlying)
		expect(order.optionSeries.strikeAsset).to.eq(proposedSeries.strikeAsset)
		expect(order.optionSeries.collateral).to.eq(proposedSeries.collateral)
		expect(order.amount).to.eq(amount)
		expect(order.price).to.eq(toWei(customOrderPrice.toString()).mul(toWei("1")).div(amount))
		expect(order.buyer).to.eq(receiverAddress)
		const seriesInfo = await optionRegistry.getSeriesInfo(order.seriesAddress)
		expect(order.optionSeries.expiration).to.eq(seriesInfo.expiration.toString())
		expect(order.optionSeries.isPut).to.eq(seriesInfo.isPut)
		// TODO: line below has a rounding error. Why is this?
		// expect(order.optionSeries.strike).to.eq(utils.parseUnits(seriesInfo.strike.toString(), 10))
		expect(await handler.orderIdCounter()).to.eq(1)
		optionToken = new Contract(order.seriesAddress, Otoken.abi, receiver) as IOToken
	})
	let customOrderPriceCall: number
	let customOrderPricePut: number
	let customStranglePrice: number
	let strangleId: number
	let strangleCallToken: IOToken
	let stranglePutToken: IOToken
	it("creates a custom strangle order", async () => {
		let customOrderPriceMultiplier = 0.93
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePriceCall = priceQuote.add(toWei("1400"))
		const strikePricePut = priceQuote.sub(toWei("900"))
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const amount = toWei("2")
		const orderExpiry = 600 // 10 minutes
		const proposedSeriesCall = {
			expiration: expiration,
			strike: BigNumber.from(strikePriceCall),
			isPut: false,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const proposedSeriesPut = {
			expiration: expiration,
			strike: BigNumber.from(strikePricePut),
			isPut: true,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localQuoteCall = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesCall,
			amount
		)
		const localQuotePut = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesPut,
			amount
		)
		customOrderPriceCall = localQuoteCall * customOrderPriceMultiplier
		customOrderPricePut = localQuotePut * customOrderPriceMultiplier
		customStranglePrice = customOrderPriceCall + customOrderPricePut
		const createStrangle = await handler.createStrangle(
			proposedSeriesCall,
			proposedSeriesPut,
			amount,
			amount,
			toWei(customOrderPriceCall.toString()).mul(toWei("1")).div(amount),
			toWei(customOrderPricePut.toString()).mul(toWei("1")).div(amount),
			orderExpiry,
			receiverAddress
		)

		const receipt = await createStrangle.wait()
		const events = receipt.events
		const createOrderEvents = events?.filter(x => x.event == "OrderCreated") as any
		expect(createOrderEvents?.length).to.eq(2)
		expect(parseInt(createOrderEvents[0].args?.orderId) + 1).to.eq(createOrderEvents[1].args?.orderId)
		const createStrangleEvent = events?.find(x => x.event == "StrangleCreated")
		strangleId = createStrangleEvent?.args?.strangleId
		const callOrder = await handler.orderStores(createOrderEvents[0].args?.orderId)
		const putOrder = await handler.orderStores(createOrderEvents[1].args?.orderId)
		strangleCallToken = new Contract(callOrder.seriesAddress, Otoken.abi, sender) as IOToken
		stranglePutToken = new Contract(putOrder.seriesAddress, Otoken.abi, sender) as IOToken

		expect(callOrder.optionSeries.isPut).to.be.false
		expect(putOrder.optionSeries.isPut).to.be.true
		expect(callOrder.optionSeries.expiration).to.eq(proposedSeriesCall.expiration)
		expect(callOrder.optionSeries.expiration).to.eq(putOrder.optionSeries.expiration)
		expect(
			callOrder.optionSeries.strike.sub(proposedSeriesCall.strike.div(oTokenDecimalShift18))
		).to.be.within(-100, 0)
		expect(
			putOrder.optionSeries.strike.sub(proposedSeriesPut.strike.div(oTokenDecimalShift18))
		).to.be.within(-100, 0)
		expect(callOrder.optionSeries.strikeAsset).to.eq(proposedSeriesCall.strikeAsset)
		expect(putOrder.optionSeries.strikeAsset).to.eq(proposedSeriesPut.strikeAsset)
		expect(callOrder.optionSeries.collateral).to.eq(proposedSeriesCall.collateral)
		expect(putOrder.optionSeries.collateral).to.eq(proposedSeriesPut.collateral)
		expect(callOrder.amount).to.eq(amount)
		expect(putOrder.amount).to.eq(amount)
	})

	it("Cant make a buy order if not admin", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike).add(100))
		const amount = toWei("1")
		const pricePer = toWei("1000")
		const orderExpiry = 10
		const proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: true,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await expect(
			handler
				.connect(receiver)
				.createOrder(proposedSeries, amount, pricePer, orderExpiry, receiverAddress)
		).to.be.reverted
	})
	it("Create buy order reverts if price is zero", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike).add(100))
		const amount = toWei("1")
		const pricePer = 0
		const orderExpiry = 10
		const proposedSeries = {
			expiration: expiration,
			isPut: true,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await expect(
			handler.createOrder(proposedSeries, amount, pricePer, orderExpiry, receiverAddress)
		).to.be.revertedWith("InvalidPrice()")
	})
	it("Create buy order reverts if order expiry too long", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike).add(100))
		const amount = toWei("1")
		const pricePer = toWei("1000")
		const orderExpiry = 2000 // 1800 is max
		const proposedSeries = {
			expiration: expiration,
			isPut: true,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await expect(
			handler.createOrder(proposedSeries, amount, pricePer, orderExpiry, receiverAddress)
		).to.be.revertedWith("OrderExpiryTooLong()")
	})
	it("cant exercise order if not buyer", async () => {
		await expect(handler.executeOrder(1)).to.be.revertedWith("InvalidBuyer()")
	})
	it("Executes a buy order", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const amount = toWei("5")
		const receiverOTokenBalBef = await optionToken.balanceOf(receiverAddress)
		const lpOTokenBalBef = await optionToken.balanceOf(liquidityPool.address)
		const lpBalBef = await usd.balanceOf(liquidityPool.address)
		const receiverBalBef = await usd.balanceOf(receiverAddress)
		const orderDeets = await handler.orderStores(1)
		const prevalues = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: orderDeets.optionSeries.expiration.toNumber(),
				strike: orderDeets.optionSeries.strike,
				isPut: orderDeets.optionSeries.isPut,
				underlying: orderDeets.optionSeries.underlying,
				strikeAsset: orderDeets.optionSeries.strikeAsset,
				collateral: orderDeets.optionSeries.collateral
			},
			amount,
			true
		)
		const deltaBefore = await liquidityPool.getPortfolioDelta()
		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: orderDeets.optionSeries.expiration.toNumber(),
				strike: orderDeets.optionSeries.strike,
				isPut: orderDeets.optionSeries.isPut,
				underlying: orderDeets.optionSeries.underlying,
				strikeAsset: orderDeets.optionSeries.strikeAsset,
				collateral: orderDeets.optionSeries.collateral
			},
			amount,
			false
		)
		await usd.connect(receiver).approve(handler.address, 100000000000)
		await optionToken.approve(handler.address, toOpyn(fromWei(amount)))
		await handler.connect(receiver).executeOrder(1)
		const deltaAfter = await liquidityPool.getPortfolioDelta()
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("1"),
			weth.address,
			usd.address,
			prevalues.delta.add(localDelta),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			prevalues.callPutsValue.add(toWei(localQuote.toString())),
			priceQuote
		)
		const receiverOTokenBalAft = await optionToken.balanceOf(receiverAddress)
		const lpOTokenBalAft = await optionToken.balanceOf(liquidityPool.address)
		const lpBalAft = await usd.balanceOf(liquidityPool.address)
		const receiverBalAft = await usd.balanceOf(receiverAddress)
		const order = await handler.orderStores(1)
		expect(order.buyer).to.eq(ZERO_ADDRESS)
		expect(fromOpyn(receiverOTokenBalAft.toString())).to.eq(fromWei(amount.toString()))
		expect(lpOTokenBalAft).to.eq(0)
		const usdDiff = lpBalBef.sub(lpBalAft)
		// expect(usdDiff).to.eq(seriesStrike.div(100).sub(fromWeiToUSDC(pricePer.toString())))
		expect(
			receiverBalBef
				.sub(receiverBalAft)
				.sub(BigNumber.from(Math.floor(customOrderPrice * 10 ** 6).toString()))
		).to.be.within(-1, 1)
	})
	it("executes a strangle", async () => {
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const amount = toWei("2")
		const receiverOTokenBalBef = (await strangleCallToken.balanceOf(receiverAddress)).add(
			await stranglePutToken.balanceOf(receiverAddress)
		)
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit).mul(2))
		await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit).mul(2), senderAddress)
		const lpUSDBalanceBefore1 = await usd.balanceOf(liquidityPool.address)
		const receiverBalBef = await usd.balanceOf(receiverAddress)
		const orderDeets1 = await handler.orderStores(2)
		const prevalues = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
		const localDelta1 = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: orderDeets1.optionSeries.expiration.toNumber(),
				strike: orderDeets1.optionSeries.strike,
				isPut: orderDeets1.optionSeries.isPut,
				underlying: orderDeets1.optionSeries.underlying,
				strikeAsset: orderDeets1.optionSeries.strikeAsset,
				collateral: orderDeets1.optionSeries.collateral
			},
			amount,
			true
		)
		const localQuote1 = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: orderDeets1.optionSeries.expiration.toNumber(),
				strike: orderDeets1.optionSeries.strike,
				isPut: orderDeets1.optionSeries.isPut,
				underlying: orderDeets1.optionSeries.underlying,
				strikeAsset: orderDeets1.optionSeries.strikeAsset,
				collateral: orderDeets1.optionSeries.collateral
			},
			amount,
			false
		)
		const orderDeets2 = await handler.orderStores(3)
		const localDelta2 = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: orderDeets2.optionSeries.expiration.toNumber(),
				strike: orderDeets2.optionSeries.strike,
				isPut: orderDeets2.optionSeries.isPut,
				underlying: orderDeets2.optionSeries.underlying,
				strikeAsset: orderDeets2.optionSeries.strikeAsset,
				collateral: orderDeets2.optionSeries.collateral
			},
			amount,
			true
		)
		const localQuote2 = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: orderDeets2.optionSeries.expiration.toNumber(),
				strike: orderDeets2.optionSeries.strike,
				isPut: orderDeets2.optionSeries.isPut,
				underlying: orderDeets2.optionSeries.underlying,
				strikeAsset: orderDeets2.optionSeries.strikeAsset,
				collateral: orderDeets2.optionSeries.collateral
			},
			amount,
			false
		)
		await usd.connect(receiver).approve(liquidityPool.address, 1000000000)
		await handler.connect(receiver).executeStrangle(2, 3)
		const receiverBalAft = await usd.balanceOf(receiverAddress)
		const receiverOTokenBalAft = (await strangleCallToken.balanceOf(receiverAddress)).add(
			await stranglePutToken.balanceOf(receiverAddress)
		)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("1"),
			weth.address,
			usd.address,
			prevalues.delta.add(localDelta1).add(localDelta2),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			prevalues.callPutsValue.add(toWei(localQuote1.toString()).add(toWei(localQuote2.toString()))),
			priceQuote
		)
		const lpOTokenBalAft = (await strangleCallToken.balanceOf(liquidityPool.address)).add(
			await stranglePutToken.balanceOf(liquidityPool.address)
		)
		expect(
			receiverBalBef
				.sub(receiverBalAft)
				.sub(BigNumber.from(Math.floor(customStranglePrice * 10 ** 6).toString()))
		).to.be.within(-1, 1)
		expect(fromOpyn(receiverOTokenBalAft.sub(receiverOTokenBalBef).toString())).to.equal(
			fromWei(amount.mul(2).toString())
		)
		expect(lpOTokenBalAft).to.eq(0)
	})
	it("does not buy back an option from a non-whitelisted address if it moves delta away to zero", async () => {
		const [sender, receiver] = signers
		const amount = toWei("1")

		await handler.addOrRemoveBuybackAddress(receiverAddress, false)
		await expect(await handler.buybackWhitelist(receiverAddress)).to.be.false
		const deltaBefore = await liquidityPool.getPortfolioDelta()
		const buybackToken = tFormatEth(deltaBefore) < 0 ? stranglePutToken : strangleCallToken

		await expect(
			handler.connect(receiver).buybackOption(buybackToken.address, amount)
		).to.be.revertedWith("DeltaNotDecreased()")
	})
	it("Cannot complete buy order after expiry", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike).add(100))
		const amount = toWei("1")
		const pricePer = toWei("10")
		const orderExpiry = 1200 // order valid for 20 minutes
		const proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: true,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const createOrdertx = await handler.createOrder(
			proposedSeries,
			amount,
			pricePer,
			orderExpiry,
			receiverAddress
		)
		const receipt = await createOrdertx.wait(1)
		const events = receipt.events
		const createOrderEvent = events?.find(x => x.event == "OrderCreated")
		const orderId = createOrderEvent?.args?.orderId
		const order = await handler.orderStores(orderId)
		expect(order.optionSeries.expiration).to.eq(proposedSeries.expiration)
		expect(order.optionSeries.isPut).to.eq(proposedSeries.isPut)
		expect(
			order.optionSeries.strike.sub(proposedSeries.strike.div(oTokenDecimalShift18))
		).to.be.within(-100, 0)
		expect(order.optionSeries.underlying).to.eq(proposedSeries.underlying)
		expect(order.optionSeries.strikeAsset).to.eq(proposedSeries.strikeAsset)
		expect(order.optionSeries.collateral).to.eq(proposedSeries.collateral)
		expect(order.amount).to.eq(amount)
		expect(order.price).to.eq(pricePer)
		expect(order.buyer).to.eq(receiverAddress)
		const seriesInfo = await optionRegistry.getSeriesInfo(order.seriesAddress)
		expect(order.optionSeries.expiration).to.eq(seriesInfo.expiration.toString())
		expect(order.optionSeries.isPut).to.eq(seriesInfo.isPut)
		// TODO: another tiny rounding error below. why?
		// expect(order.optionSeries.strike).to.eq(seriesInfo.strike)
		expect(await handler.orderIdCounter()).to.eq(orderId)
		optionToken = new Contract(order.seriesAddress, Otoken.abi, sender) as IOToken
		increase(1201)
		const prevalues = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("1"),
			weth.address,
			usd.address,
			prevalues.delta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			prevalues.callPutsValue,
			priceQuote
		)
		await expect(handler.connect(receiver).executeOrder(orderId)).to.be.revertedWith("OrderExpired()")
	})
	it("fails to execute invalid custom orders", async () => {
		let customOrderPriceMultiplier = 0.93
		let customOrderPriceMultiplierInvalid = 0.89 // below 10% buffer
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePriceInvalidDeltaCall = priceQuote.add(toWei("10")) // delta will be too high
		const strikePriceInvalidDeltaPut = priceQuote.sub(toWei("10")) // delta will be too high
		const strikePriceInvalidPrice = priceQuote.add(toWei("1500"))
		const amount = toWei("1")
		const orderExpiry = 600 // 10 minutes
		const proposedSeriesInvalidDeltaCall = {
			expiration: expiration,
			isPut: false,
			strike: BigNumber.from(strikePriceInvalidDeltaCall),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const proposedSeriesInvalidDeltaPut = {
			expiration: expiration,
			isPut: true,
			strike: BigNumber.from(strikePriceInvalidDeltaPut),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const proposedSeriesInvalidPrice = {
			expiration: expiration,
			strike: BigNumber.from(strikePriceInvalidPrice),
			isPut: false,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localQuoteInvalidDeltaCall = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesInvalidDeltaCall,
			amount
		)
		const localQuoteInvalidDeltaPut = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesInvalidDeltaPut,
			amount
		)
		const localQuoteInvalidPrice = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesInvalidPrice,
			amount
		)
		const customOrderPriceInvalidDeltaCall = localQuoteInvalidDeltaCall * customOrderPriceMultiplier
		const customOrderPriceInvalidDeltaPut = localQuoteInvalidDeltaPut * customOrderPriceMultiplier

		const customOrderPriceInvalidPrice = localQuoteInvalidPrice * customOrderPriceMultiplierInvalid
		// create invalid delta call option order
		const createOrderInvalidDeltaCall = await handler.createOrder(
			proposedSeriesInvalidDeltaCall,
			amount,
			toWei(customOrderPriceInvalidDeltaCall.toString()),
			orderExpiry,
			receiverAddress
		)

		const receipt = await createOrderInvalidDeltaCall.wait(1)
		const events = receipt.events
		const createOrderEvent = events?.find(x => x.event == "OrderCreated")
		const invalidDeltaCallOrderId = createOrderEvent?.args?.orderId

		// create invalid delta put order
		const createOrderInvalidDeltaPut = await handler.createOrder(
			proposedSeriesInvalidDeltaPut,
			amount,
			toWei(customOrderPriceInvalidDeltaPut.toString()),
			orderExpiry,
			receiverAddress
		)

		const receipt3 = await createOrderInvalidDeltaPut.wait(1)
		const events3 = receipt.events
		const createOrderEven3t = events?.find(x => x.event == "OrderCreated")
		const invalidDeltaPutOrderId = createOrderEvent?.args?.orderId

		// create invalid price option series
		const createOrderInvalidPrice = await handler.createOrder(
			proposedSeriesInvalidPrice,
			amount,
			toWei(customOrderPriceInvalidPrice.toString()),
			orderExpiry,
			receiverAddress
		)

		const receipt2 = await createOrderInvalidPrice.wait(1)
		const events2 = receipt2.events
		const createOrderEvent2 = events2?.find(x => x.event == "OrderCreated")
		const invalidPriceOrderId = createOrderEvent2?.args?.orderId

		await expect(handler.connect(receiver).executeOrder(invalidDeltaCallOrderId)).to.be.revertedWith(
			"CustomOrderInvalidDeltaValue()"
		)
		await expect(handler.connect(receiver).executeOrder(invalidDeltaPutOrderId)).to.be.revertedWith(
			"CustomOrderInvalidDeltaValue()"
		)

		await expect(handler.connect(receiver).executeOrder(invalidPriceOrderId)).to.be.revertedWith(
			"CustomOrderInsufficientPrice()"
		)
	})

	it("Can compute IV from volatility skew coefs", async () => {
		const coefs: BigNumberish[] = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		].map(x => toWei(x.toString()))
		const points = [-0.36556715, 0.59115575].map(x => toWei(x.toString()))
		const expected_iv = 1.4473946
		//@ts-ignore
		const res = await volatility.computeIVFromSkewInts(coefs, points)
		expect(tFormatEth(res)).to.eq(truncate(expected_iv))
	})

	it("Adds additional liquidity from new account", async () => {
		optionRegistry.setLiquidityPool(liquidityPool.address)
		const [sender, receiver] = signers
		const sendAmount = toUSDC("20000")
		const usdReceiver = usd.connect(receiver)
		await usdReceiver.approve(liquidityPool.address, sendAmount)
		const lpReceiver = liquidityPool.connect(receiver)
		const totalSupply = await liquidityPool.totalSupply()
		await lpReceiver.deposit(sendAmount, receiverAddress)
		const newTotalSupply = await liquidityPool.totalSupply()
		const lpBalance = await lpReceiver.balanceOf(receiverAddress)
		const difference = newTotalSupply.sub(lpBalance)
		expect(difference).to.eq(await lpReceiver.balanceOf(senderAddress))
		expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))
	})

	it("LP can redeem half shares", async () => {
		const shares = (await liquidityPool.balanceOf(senderAddress)).div(2)
		const totalShares = await liquidityPool.totalSupply()
		//@ts-ignore
		const ratio = 1 / fromWei(totalShares)
		const usdBalance = await usd.balanceOf(liquidityPool.address)
		const withdraw = await liquidityPool.withdraw(shares, senderAddress)
		const receipt = await withdraw.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "Withdraw")
		const strikeAmount = removeEvent?.args?.strikeAmount
		const usdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		//@ts-ignore
		const diff = fromWei(usdBalance) * ratio
		expect(diff).to.be.within(0, 1)
		expect(strikeAmount).to.be.eq(usdBalance.sub(usdBalanceAfter))
	})
	it("LP can not redeems shares when in excess of liquidity", async () => {
		const [sender, receiver] = signers
		const shares = await liquidityPool.balanceOf(senderAddress)
		const withdraw = liquidityPool.withdraw(shares, senderAddress)
		await expect(withdraw).to.be.revertedWith("WithdrawExceedsLiquidity()")
	})
	it("pauses and unpauses LP contract", async () => {
		await usd.approve(liquidityPool.address, toUSDC("200"))
		await liquidityPool.deposit(toUSDC("100"), senderAddress)
		await liquidityPool.pauseContract()
		await expect(liquidityPool.deposit(toUSDC("100"), senderAddress)).to.be.revertedWith(
			"Pausable: paused"
		)
		await liquidityPool.unpause()
	})

	it("settles an expired ITM vault", async () => {
		const totalCollateralAllocated = await liquidityPool.collateralAllocated()
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

		// puts expired ITM, so the amount ITM will be subtracted and used to pay out option holders
		const optionITMamount = strikePrice.sub(settlePrice)
		const amount = parseFloat(utils.formatUnits(await putOptionToken.totalSupply(), 8))
		// format from e8 oracle price to e6 USDC decimals
		expect(
			collateralReturned.sub(collateralAllocatedToVault1.sub(optionITMamount.div(100)).mul(amount))
		).to.be.within(-1, 1)
		expect(await liquidityPool.collateralAllocated()).to.equal(
			totalCollateralAllocated.sub(collateralReturned).sub(collateralLost)
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

	it("adds and deletes a hedging reactor address", async () => {
		const reactorAddress = uniswapV3HedgingReactor.address

		const hedgingReactorBefore = await liquidityPool.hedgingReactors(0)
		// check hedging reactor exists in array
		expect(parseInt(hedgingReactorBefore, 16)).to.not.eq(0x0)
		await liquidityPool.removeHedgingReactorAddress(0)
		// check no hedging reactors exist
		await expect(liquidityPool.hedgingReactors(0)).to.be.reverted
		// restore hedging reactor
		await liquidityPool.setHedgingReactorAddress(reactorAddress)
		await expect(await liquidityPool.hedgingReactors(0)).to.equal(reactorAddress)

		await liquidityPool.setHedgingReactorAddress(ETH_ADDRESS)
		await liquidityPool.setHedgingReactorAddress(ETH_ADDRESS)

		// check added addresses show
		expect(await liquidityPool.hedgingReactors(2)).to.equal(ETH_ADDRESS)
		// delete two added reactors
		// should remove middle element (element 1)
		await liquidityPool.removeHedgingReactorAddress(1)
		// should remove last element (elements 1)
		await liquidityPool.removeHedgingReactorAddress(1)
		expect(await liquidityPool.hedgingReactors(0)).to.equal(reactorAddress)
		await expect(liquidityPool.hedgingReactors(1)).to.be.reverted
	})
	it("sets new custom order bounds", async () => {
		const customOrderBoundsBefore = await handler.customOrderBounds()

		await handler.setCustomOrderBounds(
			BigNumber.from(0),
			utils.parseEther("0.3"),
			utils.parseEther("-0.3"),
			utils.parseEther("-0.05"),
			BigNumber.from(800)
		)

		const customOrderBoundsAfter = await handler.customOrderBounds()

		expect(customOrderBoundsAfter).to.not.eq(customOrderBoundsBefore)
		expect(customOrderBoundsAfter.callMaxDelta).to.equal(utils.parseEther("0.3"))
		expect(customOrderBoundsAfter.putMinDelta).to.equal(utils.parseEther("-0.3"))
		expect(customOrderBoundsAfter.putMaxDelta).to.equal(utils.parseEther("-0.05"))
		expect(customOrderBoundsAfter.maxPriceRange).to.equal(800)
	})
	it("updates maxTotalSupply variable", async () => {
		const beforeValue = await liquidityPool.maxTotalSupply()
		const expectedValue = toWei("1000000000000000")
		await liquidityPool.setMaxTotalSupply(expectedValue)
		const afterValue = await liquidityPool.maxTotalSupply()
		expect(afterValue).to.eq(expectedValue)
		expect(afterValue).to.not.eq(beforeValue)
	})
	it("updates maxDiscount variable", async () => {
		const beforeValue = await liquidityPool.maxDiscount()
		const expectedValue = toWei("2")
		await liquidityPool.setMaxDiscount(expectedValue)
		const afterValue = await liquidityPool.maxDiscount()
		expect(afterValue).to.eq(expectedValue)
		expect(afterValue).to.not.eq(beforeValue)
	})
	it("updates bufferPercentage variable", async () => {
		const beforeValue = await liquidityPool.bufferPercentage()
		expect(beforeValue).to.equal(2000)
		const expectedValue = 1500
		await liquidityPool.setBufferPercentage(expectedValue)
		const afterValue = await liquidityPool.bufferPercentage()
		expect(afterValue).to.eq(expectedValue)
		expect(afterValue).to.not.eq(beforeValue)
	})
	it("updates riskFreeRate variable", async () => {
		const beforeValue = await liquidityPool.riskFreeRate()
		expect(beforeValue).to.equal(toWei("0.03"))
		const expectedValue = toWei("0.06")
		await liquidityPool.setRiskFreeRate(expectedValue)
		const afterValue = await liquidityPool.riskFreeRate()
		expect(afterValue).to.eq(expectedValue)
		expect(afterValue).to.not.eq(beforeValue)
	})
	it("handler-only functions in Liquidity pool revert if not called by handler", async () => {
		await expect(liquidityPool.resetTempValues()).to.be.reverted
		// how to target handlerWriteOption, handlerBuybackOption, handlerIssue
	})
	it("reverts when trying to deposit/withdraw 0", async () => {
		await expect(liquidityPool.deposit(0, senderAddress)).to.be.revertedWith("InvalidAmount()")
		await expect(liquidityPool.withdraw(0, senderAddress)).to.be.revertedWith("InvalidShareAmount()")
	})
	it("returns a volatility skew", async () => {
		type int7 = [
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish
		]
		type number7 = [number, number, number, number, number, number, number]
		const coefInts: number7 = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		]
		//@ts-ignore
		const coefs: int7 = coefInts.map(x => toWei(x.toString()))
		const putVol = await volFeed.getVolatilitySkew(true)
		const callVol = await volFeed.getVolatilitySkew(false)
		expect(putVol[0]).to.eq(coefs[0])
		expect(putVol[1]).to.eq(coefs[1])
		expect(putVol[2]).to.eq(coefs[2])
		expect(putVol[3]).to.eq(coefs[3])
		expect(putVol[4]).to.eq(coefs[4])
		expect(putVol[5]).to.eq(coefs[5])
		expect(putVol[6]).to.eq(coefs[6])
		expect(callVol[1]).to.eq(coefs[1])
		expect(callVol[2]).to.eq(coefs[2])
		expect(callVol[3]).to.eq(coefs[3])
		expect(callVol[4]).to.eq(coefs[4])
		expect(callVol[5]).to.eq(coefs[5])
		expect(callVol[6]).to.eq(coefs[6])

	})
})
