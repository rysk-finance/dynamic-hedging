import hre, { ethers, network } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber } from "ethers"
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
	scaleNum
} from "../utils/conversion-helper"
import moment from "moment"
import { AbiCoder } from "ethers/lib/utils"
//@ts-ignore
import bs from "black-scholes"
import { expect } from "chai"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { OracleMock } from "../types/OracleMock"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry, OptionSeriesStruct } from "../types/OptionRegistry"
import { Otoken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
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
	setOpynOracleExpiryPrice,
	getExchangeParams,
	getSeriesWithe18Strike,
	compareQuotes
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
import { deployOpyn } from "../utils/opyn-deployer"
import { AlphaPortfolioValuesFeed } from "../types/AlphaPortfolioValuesFeed"
import { UniswapV3HedgingReactor } from "../types/UniswapV3HedgingReactor"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { BeyondPricer } from "../types/BeyondPricer"
import { create } from "domain"
import { NewWhitelist } from "../types/NewWhitelist"
import { OptionExchange } from "../types/OptionExchange"
import { OtokenFactory } from "../types/OtokenFactory"
let usd: MintableERC20
let weth: WETH
let wethERC20: MintableERC20
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let portfolioValuesFeed: AlphaPortfolioValuesFeed
let volatility: Volatility
let volFeed: VolatilityFeed
let priceFeed: PriceFeed
let rate: string
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let newWhitelist: NewWhitelist
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let optionToken: Otoken
let oTokenUSDCXC: Otoken
let oTokenUSDCSXC: Otoken
let oTokenETH1500C: Otoken
let oTokenETH1600C: Otoken
let oTokenUSDC1650C: Otoken
let oTokenBUSD3000P: Otoken
let oTokenUSDCXCLaterExp2: Otoken
let collateralAllocatedToVault1: BigNumber
let spotHedgingReactor: UniswapV3HedgingReactor
let exchange: OptionExchange
let pricer: BeyondPricer
let authority: string

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
const rfr: string = "0"
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
const liquidityPoolUsdcDeposit = "100000"
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
const CALL_FLAVOR = false
const PUT_FLAVOR = true
const emptySeries = {
	expiration: 1,
	strike: 1,
	isPut: CALL_FLAVOR,
	collateral: ZERO_ADDRESS,
	underlying: ZERO_ADDRESS,
	strikeAsset: ZERO_ADDRESS
}
/* --- end variables to change --- */

const expiration = moment.utc(expiryDate).add(3, "d").add(8, "h").valueOf() / 1000
const expiration2 = moment.utc(expiryDate).add(1, "w").add(8, "h").valueOf() / 1000 // have another batch of options exire 1 week after the first
const expiration3 = moment.utc(expiryDate).add(2, "w").add(8, "h").valueOf() / 1000
const invalidExpirationLong = moment.utc(invalidExpiryDateLong).add(8, "h").valueOf() / 1000
const invalidExpirationShort = moment.utc(invalidExpiryDateShort).add(8, "h").valueOf() / 1000
const abiCode = new AbiCoder()

const bcsLowerStrike = toWei("2200")
const bcsUpperStrike = toWei("2400")
const bearcsLowerStrike = toWei("2300")
const bearcsUpperStrike = toWei("2500")
const butterflyLowerStrike = toWei("1900")
const butterflyMidStrike = toWei("2000")
const butterflyUpperStrike = toWei("2100")
const putStrike = toWei("2300")
const failingPutStrike = toWei("2000")
const callStrike = toWei("2600")

describe("Structured Product maker", async () => {
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
		newWhitelist = opynParams.newWhitelist
		const [sender] = signers

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
			rfr,
			minCallStrikePrice,
			minPutStrikePrice,
			maxCallStrikePrice,
			maxPutStrikePrice,
			minExpiry,
			maxExpiry,
			optionRegistry,
			portfolioValuesFeed,
			authority
		)
		volatility = lpParams.volatility
		liquidityPool = lpParams.liquidityPool
		exchange = lpParams.exchange
		pricer = lpParams.pricer
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
	})
	describe("Setup add-on system features", async () => {
		it("SETUP: set sabrParams", async () => {
			const proposedSabrParams = {
				callAlpha: 250000,
				callBeta: 1_000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1_000000,
				putRho: -300000,
				putVolvol: 1_500000
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
				putVolvol: 1_500000
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
		})
		it("Deposit to the liquidityPool", async () => {
			const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"
			await hre.network.provider.request({
				method: "hardhat_impersonateAccount",
				params: [USDC_WHALE]
			})
			const usdcWhale = await ethers.getSigner(USDC_WHALE)
			const usdWhaleConnect = await usd.connect(usdcWhale)
			await weth.deposit({ value: toWei(liquidityPoolWethDeposit) })
			await usdWhaleConnect.transfer(senderAddress, toUSDC("1000000"))
			await usdWhaleConnect.transfer(receiverAddress, toUSDC("1000000"))
			await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
			const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
			const receipt = await deposit.wait(1)
			const event = receipt?.events?.find(x => x.event == "Deposit")
			expect(event?.event).to.eq("Deposit")
		})
		it("pauses trading and executes epoch", async () => {
			await liquidityPool.pauseTradingAndRequest()
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			await liquidityPool.executeEpochCalculation()
			await liquidityPool.redeem(toWei("10000000"))
		})
		it("SETUP: sets the exchange as a hedging reactor", async function () {
			await liquidityPool.setHedgingReactorAddress(exchange.address)
			expect(await liquidityPool.hedgingReactors(0)).to.equal(exchange.address)
		})
		it("SETUP: set the pool fee", async function () {
			await exchange.setPoolFee(weth.address, 500)
			expect(await exchange.poolFees(weth.address)).to.equal(500)
		})
		it("can compute portfolio delta", async function () {
			const delta = await liquidityPool.getPortfolioDelta()
			expect(delta).to.equal(0)
		})
		it("SUCCEEDS: Sender sets exchange as an operator", async () => {
			await controller.setOperator(exchange.address, true)
			expect(await controller.isOperator(senderAddress, exchange.address))
		})
	})
	describe("Purchase and sell back an option", async () => {
		it("SETUP: approve series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			await exchange.issueNewSeries([
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: BigNumber.from(strikePrice),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: bcsLowerStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: bearcsLowerStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: bearcsUpperStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: bcsUpperStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: butterflyLowerStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: butterflyMidStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: butterflyUpperStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration2,
					isPut: CALL_FLAVOR,
					strike: BigNumber.from(strikePrice),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration2,
					isPut: CALL_FLAVOR,
					strike: toWei("1750"),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration2,
					isPut: CALL_FLAVOR,
					strike: toWei("1650"),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration2,
					isPut: CALL_FLAVOR,
					strike: callStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration2,
					isPut: PUT_FLAVOR,
					strike: putStrike,
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: PUT_FLAVOR,
					strike: failingPutStrike,
					isSellable: true,
					isBuyable: true
				}
			])
		})
		it("LP Writes a ETH/USD call for premium", async () => {
			const amount = toWei("5")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: expiration,
				strike: BigNumber.from(strikePrice),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			let quote = quoteResponse[0].add(quoteResponse[2])
			const before = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				0,
				senderAddress,
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
			oTokenUSDCXC = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDCXC
			quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			quote = quoteResponse[0].add(quoteResponse[2])
			const after = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				optionToken,
				senderAddress,
				amount
			)
			expect(after.senderOtokenBalance).to.eq(after.opynAmount)
			expect(after.exchangeOTokenBalance).to.eq(0)
			expect(before.senderUSDBalance.sub(after.senderUSDBalance).sub(quote)).to.be.within(-200, 200)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.add(quote)
					.add(before.collateralAllocated.sub(after.collateralAllocated))
			).to.be.within(-200, 200)
			expect(after.pfList.length - before.pfList.length).to.equal(1)
			expect(after.seriesStores.longExposure).to.equal(0)
			expect(after.seriesStores.shortExposure).to.equal(amount)
			expect(after.seriesStores.optionSeries.expiration).to.equal(proposedSeries.expiration)
			expect(after.seriesStores.optionSeries.isPut).to.equal(proposedSeries.isPut)
			expect(after.seriesStores.optionSeries.collateral)
				.to.equal(proposedSeries.collateral)
				.to.equal(usd.address)
			expect(after.seriesStores.optionSeries.underlying)
				.to.equal(proposedSeries.underlying)
				.to.equal(weth.address)
			expect(after.seriesStores.optionSeries.strikeAsset)
				.to.equal(proposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(after.netDhvExposure.add(amount)).to.equal(0)
		})
		// bull call spread or long call spread involves buying a lower strike price call and selling a higher strike price call expiring at the same time
		// the sender should have their funds reduced
		it("CONSTRUCT: BULL CALL SPREAD", async () => {
			const amount = toWei("3")
			const lowerProposedSeries = {
				expiration: expiration,
				strike: bcsLowerStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const upperProposedSeries = {
				expiration: expiration,
				strike: bcsUpperStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const marginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: upperProposedSeries.expiration,
						strike: upperProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: upperProposedSeries.isPut,
						strikeAsset: upperProposedSeries.strikeAsset,
						underlying: upperProposedSeries.underlying,
						collateral: upperProposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))
			let lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, false, 0)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			let lowerQuote = lowerQuoteResponse[0].add(lowerQuoteResponse[2])
			let upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, true, 0)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			let upperQuote = upperQuoteResponse[0].sub(upperQuoteResponse[2])

			await usd.approve(
				exchange.address,
				marginRequirement.add(lowerQuote.sub(upperQuote).add(toUSDC("100")))
			)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const otoken = await exchange.callStatic.createOtoken(upperProposedSeries)
			await exchange.createOtoken(upperProposedSeries)
			await exchange.createOtoken(lowerProposedSeries)
			const upperToken = await exchange.callStatic.createOtoken(upperProposedSeries)
			const lowerToken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			const upperBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: upperProposedSeries.collateral,
							vaultId: vaultId,
							amount: marginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: vaultId,
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: exchange.address,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: upperProposedSeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 0,
							owner: ZERO_ADDRESS,
							secondAddress: ZERO_ADDRESS,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: 0,
							optionSeries: lowerProposedSeries,
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
							optionSeries: lowerProposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])

			lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, false, 0)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			lowerQuote = lowerQuoteResponse[0].add(lowerQuoteResponse[2])
			upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, true, 0)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			upperQuote = upperQuoteResponse[0].sub(upperQuoteResponse[2])
			const upperAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			expect(upperAfter.exchangeOTokenBalance).to.eq(toOpyn(fromWei(amount)))
			expect(lowerAfter.exchangeOTokenBalance).to.eq(0)
			expect(
				upperAfter.senderUSDBalance
					.sub(upperBefore.senderUSDBalance)
					.sub(upperQuote)
					.add(lowerQuote)
					.add(marginRequirement)
			).to.be.within(-10, 10)
			expect(
				upperBefore.poolUSDBalance
					.sub(upperAfter.poolUSDBalance)
					.add(lowerQuote)
					.sub(upperQuote)
					.sub(upperAfter.collateralAllocated.sub(upperBefore.collateralAllocated))
			).to.be.within(-10, 10)
			expect(upperAfter.pfList.length - upperBefore.pfList.length).to.equal(2)
			expect(upperAfter.seriesStores.longExposure).to.equal(amount)
			expect(lowerAfter.seriesStores.shortExposure).to.equal(amount)
			expect(upperAfter.seriesStores.optionSeries.expiration).to.equal(upperProposedSeries.expiration)
			expect(upperAfter.seriesStores.optionSeries.isPut).to.equal(upperProposedSeries.isPut)
			expect(upperAfter.seriesStores.optionSeries.collateral)
				.to.equal(upperProposedSeries.collateral)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.underlying)
				.to.equal(upperProposedSeries.underlying)
				.to.equal(weth.address)
			expect(upperAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(upperProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.strike).to.equal(upperProposedSeries.strike)
			expect(lowerAfter.seriesStores.optionSeries.expiration).to.equal(lowerProposedSeries.expiration)
			expect(lowerAfter.seriesStores.optionSeries.isPut).to.equal(lowerProposedSeries.isPut)
			expect(lowerAfter.seriesStores.optionSeries.collateral)
				.to.equal(lowerProposedSeries.collateral)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.underlying)
				.to.equal(lowerProposedSeries.underlying)
				.to.equal(weth.address)
			expect(lowerAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(lowerProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.strike).to.equal(lowerProposedSeries.strike)
			expect(lowerAfter.netDhvExposure.add(amount)).to.equal(0)
			expect(upperAfter.netDhvExposure.sub(amount)).to.equal(0)
		})
		// bear call spread involves selling a lower strike price call and buying a higher strike price call expiring at the same time
		// the sender is paid for this strategy
		it("CONSTRUCT: BEAR CALL SPREAD", async () => {
			const amount = toWei("3")
			const lowerProposedSeries = {
				expiration: expiration,
				strike: bearcsLowerStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const upperProposedSeries = {
				expiration: expiration,
				strike: bearcsUpperStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const marginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: lowerProposedSeries.expiration,
						strike: lowerProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: lowerProposedSeries.isPut,
						strikeAsset: lowerProposedSeries.strikeAsset,
						underlying: lowerProposedSeries.underlying,
						collateral: lowerProposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))

			let lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, true, 0)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			let lowerQuote = lowerQuoteResponse[0].sub(lowerQuoteResponse[2])
			let upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, false, 0)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			let upperQuote = upperQuoteResponse[0].add(upperQuoteResponse[2])

			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const otoken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			const upperToken = await exchange.callStatic.createOtoken(upperProposedSeries)
			const lowerToken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(upperProposedSeries)
			const upperBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: lowerProposedSeries.collateral,
							vaultId: vaultId,
							amount: marginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: vaultId,
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: exchange.address,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: lowerProposedSeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 0,
							owner: ZERO_ADDRESS,
							secondAddress: ZERO_ADDRESS,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: 0,
							optionSeries: upperProposedSeries,
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
							optionSeries: upperProposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])

			lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, true, 0)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			lowerQuote = lowerQuoteResponse[0].sub(lowerQuoteResponse[2])
			upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, false, 0)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			upperQuote = upperQuoteResponse[0].add(upperQuoteResponse[2])
			const upperAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			expect(upperAfter.exchangeOTokenBalance).to.eq(0)
			expect(lowerAfter.exchangeOTokenBalance).to.eq(toOpyn(fromWei(amount)))
			expect(
				upperAfter.senderUSDBalance
					.sub(upperBefore.senderUSDBalance)
					.sub(lowerQuote)
					.add(upperQuote)
					.add(marginRequirement)
			).to.be.within(-10, 10)
			expect(
				upperBefore.poolUSDBalance
					.sub(upperAfter.poolUSDBalance)
					.add(upperQuote)
					.sub(lowerQuote)
					.sub(upperAfter.collateralAllocated.sub(upperBefore.collateralAllocated))
			).to.be.within(-10, 10)
			expect(upperAfter.pfList.length - upperBefore.pfList.length).to.equal(2)
			expect(upperAfter.seriesStores.shortExposure).to.equal(amount)
			expect(lowerAfter.seriesStores.longExposure).to.equal(amount)
			expect(upperAfter.seriesStores.optionSeries.expiration).to.equal(upperProposedSeries.expiration)
			expect(upperAfter.seriesStores.optionSeries.isPut).to.equal(upperProposedSeries.isPut)
			expect(upperAfter.seriesStores.optionSeries.collateral)
				.to.equal(upperProposedSeries.collateral)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.underlying)
				.to.equal(upperProposedSeries.underlying)
				.to.equal(weth.address)
			expect(upperAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(upperProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.strike).to.equal(upperProposedSeries.strike)
			expect(lowerAfter.seriesStores.optionSeries.expiration).to.equal(lowerProposedSeries.expiration)
			expect(lowerAfter.seriesStores.optionSeries.isPut).to.equal(lowerProposedSeries.isPut)
			expect(lowerAfter.seriesStores.optionSeries.collateral)
				.to.equal(lowerProposedSeries.collateral)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.underlying)
				.to.equal(lowerProposedSeries.underlying)
				.to.equal(weth.address)
			expect(lowerAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(lowerProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.strike).to.equal(lowerProposedSeries.strike)
			expect(lowerAfter.netDhvExposure.sub(amount)).to.equal(0)
			expect(upperAfter.netDhvExposure.add(amount)).to.equal(0)
		})
		// e.g.
		// Buy 1 XYZ 100-strike price call for $5.00
		// Sell 2 XYZ 105-strike price calls for $5.40 ($2.70 each)
		// Buy 1 XYZ 110-strike price call for $1.10
		it("CONSTRUCT: CALL BUTTERFLY", async () => {
			const amount = toWei("3")
			const lowerProposedSeries = {
				expiration: expiration,
				strike: butterflyLowerStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const midProposedSeries = {
				expiration: expiration,
				strike: butterflyMidStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const upperProposedSeries = {
				expiration: expiration,
				strike: butterflyUpperStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const marginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: midProposedSeries.expiration,
						strike: midProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: midProposedSeries.isPut,
						strikeAsset: midProposedSeries.strikeAsset,
						underlying: midProposedSeries.underlying,
						collateral: midProposedSeries.collateral
					},
					amount.mul(2)
				)
			).add(toUSDC("100"))
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const otoken = await exchange.callStatic.createOtoken(midProposedSeries)
			const upperToken = await exchange.callStatic.createOtoken(upperProposedSeries)
			const midToken = await exchange.callStatic.createOtoken(midProposedSeries)
			const lowerToken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(midProposedSeries)
			await exchange.createOtoken(upperProposedSeries)
			const upperBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const midBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", midToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			let lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, false, lowerBefore.netDhvExposure)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, lowerBefore.netDhvExposure)
			let lowerQuote = lowerQuoteResponse[0].add(lowerQuoteResponse[2])
			let midQuoteResponse = await pricer.quoteOptionPrice(midProposedSeries, amount.mul(2), true, midBefore.netDhvExposure)
			await compareQuotes(midQuoteResponse, liquidityPool, priceFeed, midProposedSeries, amount.mul(2), true, exchange, optionRegistry, usd, pricer, midBefore.netDhvExposure)
			let midQuote = midQuoteResponse[0].sub(midQuoteResponse[2])
			let upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, false, upperBefore.netDhvExposure)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, upperBefore.netDhvExposure)
			let upperQuote = upperQuoteResponse[0].add(upperQuoteResponse[2])
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: midProposedSeries.collateral,
							vaultId: vaultId,
							amount: marginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: vaultId,
							amount: amount.mul(2).div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: exchange.address,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount.mul(2),
							optionSeries: midProposedSeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 0,
							owner: ZERO_ADDRESS,
							secondAddress: ZERO_ADDRESS,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: 0,
							optionSeries: upperProposedSeries,
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
							optionSeries: upperProposedSeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 0,
							owner: ZERO_ADDRESS,
							secondAddress: ZERO_ADDRESS,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: 0,
							optionSeries: lowerProposedSeries,
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
							optionSeries: lowerProposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])

			lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, false, lowerBefore.netDhvExposure)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, lowerBefore.netDhvExposure)
			lowerQuote = lowerQuoteResponse[0].add(lowerQuoteResponse[2])
			midQuoteResponse = await pricer.quoteOptionPrice(midProposedSeries, amount.mul(2), true, midBefore.netDhvExposure)
			await compareQuotes(midQuoteResponse, liquidityPool, priceFeed, midProposedSeries, amount.mul(2), true, exchange, optionRegistry, usd, pricer, midBefore.netDhvExposure)
			midQuote = midQuoteResponse[0].sub(midQuoteResponse[2])
			upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, false, upperBefore.netDhvExposure)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, upperBefore.netDhvExposure)
			upperQuote = upperQuoteResponse[0].add(upperQuoteResponse[2])
			const upperAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const midAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", midToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			expect(upperAfter.exchangeOTokenBalance).to.eq(0)
			expect(midAfter.exchangeOTokenBalance).to.eq(toOpyn(fromWei(amount.mul(2))))
			expect(lowerAfter.exchangeOTokenBalance).to.eq(0)
			expect(
				upperAfter.senderUSDBalance
					.sub(upperBefore.senderUSDBalance)
					.add(marginRequirement)
					.add(lowerQuote)
					.add(upperQuote)
					.sub(midQuote)
			).to.be.within(-10, 10)
			expect(
				upperBefore.poolUSDBalance
					.sub(upperAfter.poolUSDBalance)
					.add(upperQuote)
					.add(lowerQuote)
					.sub(midQuote)
					.sub(upperAfter.collateralAllocated.sub(upperBefore.collateralAllocated))
			).to.be.within(-10, 10)
			expect(upperAfter.pfList.length - upperBefore.pfList.length).to.equal(3)
			expect(upperAfter.seriesStores.shortExposure).to.equal(amount)
			expect(midAfter.seriesStores.longExposure).to.equal(amount.mul(2))
			expect(lowerAfter.seriesStores.shortExposure).to.equal(amount)
			expect(upperAfter.seriesStores.optionSeries.expiration).to.equal(upperProposedSeries.expiration)
			expect(upperAfter.seriesStores.optionSeries.isPut).to.equal(upperProposedSeries.isPut)
			expect(upperAfter.seriesStores.optionSeries.collateral)
				.to.equal(upperProposedSeries.collateral)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.underlying)
				.to.equal(upperProposedSeries.underlying)
				.to.equal(weth.address)
			expect(upperAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(upperProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.strike).to.equal(upperProposedSeries.strike)
			expect(lowerAfter.seriesStores.optionSeries.expiration).to.equal(lowerProposedSeries.expiration)
			expect(lowerAfter.seriesStores.optionSeries.isPut).to.equal(lowerProposedSeries.isPut)
			expect(lowerAfter.seriesStores.optionSeries.collateral)
				.to.equal(lowerProposedSeries.collateral)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.underlying)
				.to.equal(lowerProposedSeries.underlying)
				.to.equal(weth.address)
			expect(lowerAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(lowerProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.strike).to.equal(lowerProposedSeries.strike)
			expect(midAfter.seriesStores.optionSeries.expiration).to.equal(midProposedSeries.expiration)
			expect(midAfter.seriesStores.optionSeries.isPut).to.equal(midProposedSeries.isPut)
			expect(midAfter.seriesStores.optionSeries.collateral)
				.to.equal(midProposedSeries.collateral)
				.to.equal(usd.address)
			expect(midAfter.seriesStores.optionSeries.underlying)
				.to.equal(lowerProposedSeries.underlying)
				.to.equal(weth.address)
			expect(midAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(midProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(midAfter.seriesStores.optionSeries.strike).to.equal(midProposedSeries.strike)
			expect(lowerAfter.netDhvExposure.add(amount)).to.equal(0)
			expect(upperAfter.netDhvExposure.add(amount)).to.equal(0)
			expect(midAfter.netDhvExposure.sub(amount.mul(2))).to.equal(0)
		})
		// short strangle sell a call and sell a put at the same expiry
		// the sender is paid for this strategy
		it("CONSTRUCT: SHORT STRANGLE", async () => {
			const amount = toWei("3")
			const lowerProposedSeries = {
				expiration: expiration2,
				strike: putStrike,
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const upperProposedSeries = {
				expiration: expiration2,
				strike: callStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const lowerMarginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: lowerProposedSeries.expiration,
						strike: lowerProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: lowerProposedSeries.isPut,
						strikeAsset: lowerProposedSeries.strikeAsset,
						underlying: lowerProposedSeries.underlying,
						collateral: lowerProposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))
			const upperMarginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: upperProposedSeries.expiration,
						strike: upperProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: upperProposedSeries.isPut,
						strikeAsset: upperProposedSeries.strikeAsset,
						underlying: upperProposedSeries.underlying,
						collateral: upperProposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))
			await usd.approve(exchange.address, lowerMarginRequirement.add(upperMarginRequirement))
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const otoken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			const upperToken = await exchange.callStatic.createOtoken(upperProposedSeries)
			const lowerToken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(upperProposedSeries)
			const upperBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			let lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, true, lowerBefore.netDhvExposure)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, lowerBefore.netDhvExposure)
			let lowerQuote = lowerQuoteResponse[0].sub(lowerQuoteResponse[2])
			let upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, true, upperBefore.netDhvExposure)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, upperBefore.netDhvExposure)
			let upperQuote = upperQuoteResponse[0].sub(upperQuoteResponse[2])

			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: lowerProposedSeries.collateral,
							vaultId: vaultId,
							amount: lowerMarginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: lowerToken,
							vaultId: vaultId,
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId.add(1),
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: upperProposedSeries.collateral,
							vaultId: vaultId.add(1),
							amount: upperMarginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: upperToken,
							vaultId: vaultId.add(1),
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: exchange.address,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: lowerProposedSeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: exchange.address,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: upperProposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])

			lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, true, 0)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			lowerQuote = lowerQuoteResponse[0].sub(lowerQuoteResponse[2])
			upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, true, 0)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			upperQuote = upperQuoteResponse[0].sub(upperQuoteResponse[2])
			const upperAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			expect(upperAfter.exchangeOTokenBalance).to.eq(toOpyn(fromWei(amount)))
			expect(lowerAfter.exchangeOTokenBalance).to.eq(toOpyn(fromWei(amount)))
			expect(
				upperAfter.senderUSDBalance
					.sub(upperBefore.senderUSDBalance)
					.sub(lowerQuote)
					.sub(upperQuote)
					.add(upperMarginRequirement)
					.add(lowerMarginRequirement)
			).to.be.within(-10, 10)
			expect(
				upperBefore.poolUSDBalance
					.sub(upperAfter.poolUSDBalance)
					.sub(upperQuote)
					.sub(lowerQuote)
					.sub(upperAfter.collateralAllocated.sub(upperBefore.collateralAllocated))
			).to.be.within(-10, 10)
			expect(upperAfter.pfList.length - upperBefore.pfList.length).to.equal(2)
			expect(upperAfter.seriesStores.shortExposure).to.equal(0)
			expect(upperAfter.seriesStores.longExposure).to.equal(amount)
			expect(lowerAfter.seriesStores.longExposure).to.equal(amount)
			expect(lowerAfter.seriesStores.shortExposure).to.equal(0)
			expect(upperAfter.seriesStores.optionSeries.expiration).to.equal(upperProposedSeries.expiration)
			expect(upperAfter.seriesStores.optionSeries.isPut).to.equal(upperProposedSeries.isPut)
			expect(upperAfter.seriesStores.optionSeries.collateral)
				.to.equal(upperProposedSeries.collateral)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.underlying)
				.to.equal(upperProposedSeries.underlying)
				.to.equal(weth.address)
			expect(upperAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(upperProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.strike).to.equal(upperProposedSeries.strike)
			expect(lowerAfter.seriesStores.optionSeries.expiration).to.equal(lowerProposedSeries.expiration)
			expect(lowerAfter.seriesStores.optionSeries.isPut).to.equal(lowerProposedSeries.isPut)
			expect(lowerAfter.seriesStores.optionSeries.collateral)
				.to.equal(lowerProposedSeries.collateral)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.underlying)
				.to.equal(lowerProposedSeries.underlying)
				.to.equal(weth.address)
			expect(lowerAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(lowerProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.strike).to.equal(lowerProposedSeries.strike)
			expect(lowerAfter.netDhvExposure.sub(amount)).to.equal(0)
			expect(upperAfter.netDhvExposure.sub(amount)).to.equal(0)
		})
		// short strangle sell a call and sell a put at the same expiry
		// the sender is paid for this strategy
		it("REVERT: SHORT STRANGLE with failing put strike", async () => {
			const amount = toWei("3")
			const lowerProposedSeries = {
				expiration: expiration,
				strike: failingPutStrike,
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const upperProposedSeries = {
				expiration: expiration,
				strike: callStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const lowerMarginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: lowerProposedSeries.expiration,
						strike: lowerProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: lowerProposedSeries.isPut,
						strikeAsset: lowerProposedSeries.strikeAsset,
						underlying: lowerProposedSeries.underlying,
						collateral: lowerProposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))
			const upperMarginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: upperProposedSeries.expiration,
						strike: upperProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: upperProposedSeries.isPut,
						strikeAsset: upperProposedSeries.strikeAsset,
						underlying: upperProposedSeries.underlying,
						collateral: upperProposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))			
			let lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, true, 0)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			let lowerQuote = lowerQuoteResponse[0].sub(lowerQuoteResponse[2])
			let upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, true, 0)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			let upperQuote = upperQuoteResponse[0].sub(upperQuoteResponse[2])

			await usd.approve(exchange.address, lowerMarginRequirement.add(upperMarginRequirement))
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const otoken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			const upperToken = await exchange.callStatic.createOtoken(upperProposedSeries)
			const lowerToken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(upperProposedSeries)
			const upperBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			await expect(
				exchange.operate([
					{
						operation: 0,
						operationQueue: [
							{
								actionType: 0,
								owner: senderAddress,
								secondAddress: senderAddress,
								asset: ZERO_ADDRESS,
								vaultId: vaultId,
								amount: 0,
								optionSeries: emptySeries,
								index: 0,
								data: abiCode.encode(["uint256"], [1])
							},
							{
								actionType: 5,
								owner: senderAddress,
								secondAddress: exchange.address,
								asset: lowerProposedSeries.collateral,
								vaultId: vaultId,
								amount: lowerMarginRequirement,
								optionSeries: emptySeries,
								index: 0,
								data: ZERO_ADDRESS
							},
							{
								actionType: 1,
								owner: senderAddress,
								secondAddress: exchange.address,
								asset: lowerToken,
								vaultId: vaultId,
								amount: amount.div(ethers.utils.parseUnits("1", 10)),
								optionSeries: emptySeries,
								index: 0,
								data: ZERO_ADDRESS
							}
						]
					},
					{
						operation: 0,
						operationQueue: [
							{
								actionType: 0,
								owner: senderAddress,
								secondAddress: senderAddress,
								asset: ZERO_ADDRESS,
								vaultId: vaultId.add(1),
								amount: 0,
								optionSeries: emptySeries,
								index: 0,
								data: abiCode.encode(["uint256"], [1])
							},
							{
								actionType: 5,
								owner: senderAddress,
								secondAddress: exchange.address,
								asset: upperProposedSeries.collateral,
								vaultId: vaultId.add(1),
								amount: upperMarginRequirement,
								optionSeries: emptySeries,
								index: 0,
								data: ZERO_ADDRESS
							},
							{
								actionType: 1,
								owner: senderAddress,
								secondAddress: exchange.address,
								asset: upperToken,
								vaultId: vaultId.add(1),
								amount: amount.div(ethers.utils.parseUnits("1", 10)),
								optionSeries: emptySeries,
								index: 0,
								data: ZERO_ADDRESS
							}
						]
					},
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: exchange.address,
								asset: ZERO_ADDRESS,
								vaultId: 0,
								amount: amount,
								optionSeries: lowerProposedSeries,
								index: 0,
								data: "0x"
							},
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: exchange.address,
								asset: ZERO_ADDRESS,
								vaultId: 0,
								amount: amount,
								optionSeries: upperProposedSeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWith("PremiumTooSmall()")
		})
		it("SUCCEED: buys more of option amount than has short", async () => {
			const amount = toWei("10")
			const lowerProposedSeries = {
				expiration: expiration2,
				strike: putStrike,
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const lowerToken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			const before = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			let quoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, false, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			let quote = quoteResponse[0].add(quoteResponse[2])
			await usd.approve(exchange.address, quote)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 0,
							owner: ZERO_ADDRESS,
							secondAddress: exchange.address,
							asset: lowerToken,
							vaultId: 0,
							amount: amount,
							optionSeries: lowerProposedSeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: lowerToken,
							vaultId: 0,
							amount: amount,
							optionSeries: lowerProposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
			const after = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			quoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, false, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			quote = quoteResponse[0].add(quoteResponse[2])
			expect(after.senderOtokenBalance.sub(before.senderOtokenBalance)).to.eq(after.opynAmount)
			expect(after.exchangeOTokenBalance).to.eq(0)
			expect(before.senderUSDBalance.sub(after.senderUSDBalance).sub(quote)).to.be.within(-200, 200)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.add(quote)
					.add(before.collateralAllocated.sub(after.collateralAllocated))
			).to.be.within(-200, 200)
			expect(after.pfList.length - before.pfList.length).to.equal(0)
			expect(after.seriesStores.longExposure).to.equal(0)
			expect(after.seriesStores.shortExposure.sub(before.seriesStores.shortExposure)).to.equal(
				toWei("7")
			)
			expect(after.seriesStores.optionSeries.expiration).to.equal(lowerProposedSeries.expiration)
			expect(after.seriesStores.optionSeries.isPut).to.equal(lowerProposedSeries.isPut)
			expect(after.seriesStores.optionSeries.collateral)
				.to.equal(lowerProposedSeries.collateral)
				.to.equal(usd.address)
			expect(after.seriesStores.optionSeries.underlying)
				.to.equal(lowerProposedSeries.underlying)
				.to.equal(weth.address)
			expect(after.seriesStores.optionSeries.strikeAsset)
				.to.equal(lowerProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(before.netDhvExposure.sub(after.netDhvExposure)).to.equal(amount)
		})
		// short strangle sell a call and sell a put at the same expiry
		// the sender is paid for this strategy
		it("CONSTRUCT: SHORT STRANGLE with ETH", async () => {
			const amount = toWei("3")
			const lowerProposedSeries = {
				expiration: expiration2,
				strike: putStrike,
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: weth.address
			}
			const upperProposedSeries = {
				expiration: expiration2,
				strike: callStrike,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: weth.address
			}
			const lowerMarginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: lowerProposedSeries.expiration,
						strike: lowerProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: lowerProposedSeries.isPut,
						strikeAsset: lowerProposedSeries.strikeAsset,
						underlying: lowerProposedSeries.underlying,
						collateral: lowerProposedSeries.collateral
					},
					amount
				)
			).add(toWei("0.1"))
			const upperMarginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: upperProposedSeries.expiration,
						strike: upperProposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: upperProposedSeries.isPut,
						strikeAsset: upperProposedSeries.strikeAsset,
						underlying: upperProposedSeries.underlying,
						collateral: upperProposedSeries.collateral
					},
					amount
				)
			).add(toWei("0.1"))

			await weth.approve(exchange.address, lowerMarginRequirement.add(upperMarginRequirement))
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const otoken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			const upperToken = await exchange.callStatic.createOtoken(upperProposedSeries)
			const lowerToken = await exchange.callStatic.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(lowerProposedSeries)
			await exchange.createOtoken(upperProposedSeries)
			const upperBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			let lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, true, lowerBefore.netDhvExposure)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, lowerBefore.netDhvExposure)
			let lowerQuote = lowerQuoteResponse[0].sub(lowerQuoteResponse[2])
			let upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, true, upperBefore.netDhvExposure)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, upperBefore.netDhvExposure)
			let upperQuote = upperQuoteResponse[0].sub(upperQuoteResponse[2])
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: lowerProposedSeries.collateral,
							vaultId: vaultId,
							amount: lowerMarginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: lowerToken,
							vaultId: vaultId,
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId.add(1),
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: upperProposedSeries.collateral,
							vaultId: vaultId.add(1),
							amount: upperMarginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: upperToken,
							vaultId: vaultId.add(1),
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: exchange.address,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: lowerProposedSeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: exchange.address,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: upperProposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
			const upperAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", upperToken)) as Otoken,
				senderAddress,
				amount
			)
			const lowerAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				(await ethers.getContractAt("Otoken", lowerToken)) as Otoken,
				senderAddress,
				amount
			)
			lowerQuoteResponse = await pricer.quoteOptionPrice(lowerProposedSeries, amount, true, lowerBefore.netDhvExposure)
			await compareQuotes(lowerQuoteResponse, liquidityPool, priceFeed, lowerProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, lowerBefore.netDhvExposure)
			lowerQuote = lowerQuoteResponse[0].sub(lowerQuoteResponse[2])
			upperQuoteResponse = await pricer.quoteOptionPrice(upperProposedSeries, amount, true, upperBefore.netDhvExposure)
			await compareQuotes(upperQuoteResponse, liquidityPool, priceFeed, upperProposedSeries, amount, true, exchange, optionRegistry, usd, pricer, upperBefore.netDhvExposure)
			upperQuote = upperQuoteResponse[0].sub(upperQuoteResponse[2])
			expect(upperAfter.exchangeOTokenBalance).to.eq(toOpyn(fromWei(amount)))
			expect(lowerAfter.exchangeOTokenBalance).to.eq(toOpyn(fromWei(amount)))
			expect(
				upperAfter.senderUSDBalance.sub(upperBefore.senderUSDBalance).sub(lowerQuote).sub(upperQuote)
			).to.be.within(-10, 10)
			expect(
				upperBefore.poolUSDBalance
					.sub(upperAfter.poolUSDBalance)
					.sub(upperQuote)
					.sub(lowerQuote)
					.sub(upperAfter.collateralAllocated.sub(upperBefore.collateralAllocated))
			).to.be.within(-10, 10)
			expect(upperAfter.pfList.length - upperBefore.pfList.length).to.equal(2)
			expect(upperAfter.seriesStores.shortExposure).to.equal(0)
			expect(upperAfter.seriesStores.longExposure).to.equal(amount)
			expect(lowerAfter.seriesStores.longExposure).to.equal(amount)
			expect(lowerAfter.seriesStores.shortExposure).to.equal(0)
			expect(upperAfter.seriesStores.optionSeries.expiration).to.equal(upperProposedSeries.expiration)
			expect(upperAfter.seriesStores.optionSeries.isPut).to.equal(upperProposedSeries.isPut)
			expect(upperAfter.seriesStores.optionSeries.collateral)
				.to.equal(upperProposedSeries.collateral)
				.to.equal(weth.address)
			expect(upperAfter.seriesStores.optionSeries.underlying)
				.to.equal(upperProposedSeries.underlying)
				.to.equal(weth.address)
			expect(upperAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(upperProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(upperAfter.seriesStores.optionSeries.strike).to.equal(upperProposedSeries.strike)
			expect(lowerAfter.seriesStores.optionSeries.expiration).to.equal(lowerProposedSeries.expiration)
			expect(lowerAfter.seriesStores.optionSeries.isPut).to.equal(lowerProposedSeries.isPut)
			expect(lowerAfter.seriesStores.optionSeries.collateral)
				.to.equal(lowerProposedSeries.collateral)
				.to.equal(weth.address)
			expect(lowerAfter.seriesStores.optionSeries.underlying)
				.to.equal(lowerProposedSeries.underlying)
				.to.equal(weth.address)
			expect(lowerAfter.seriesStores.optionSeries.strikeAsset)
				.to.equal(lowerProposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(lowerAfter.seriesStores.optionSeries.strike).to.equal(lowerProposedSeries.strike)
			expect(lowerAfter.netDhvExposure.sub(lowerBefore.netDhvExposure)).to.equal(amount)
			expect(upperAfter.netDhvExposure.sub(upperBefore.netDhvExposure)).to.equal(amount)
		})
		it("SUCCEEDS: LP Sells a ETH/USD call for premium with otoken created outside", async () => {
			const amount = toWei("5")
			const strikePrice = toWei("1750")
			const proposedSeries = {
				expiration: expiration2,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			await compareQuotes(quoteResponse, liquidityPool, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			let quote = quoteResponse[0].sub(quoteResponse[2])
			const otokenFactory = (await ethers.getContractAt(
				"OtokenFactory",
				await addressBook.getOtokenFactory()
			)) as OtokenFactory
			const otoken = await otokenFactory.callStatic.createOtoken(
				proposedSeries.underlying,
				proposedSeries.strikeAsset,
				proposedSeries.collateral,
				proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
				proposedSeries.expiration,
				proposedSeries.isPut
			)
			await otokenFactory.createOtoken(
				proposedSeries.underlying,
				proposedSeries.strikeAsset,
				proposedSeries.collateral,
				proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
				proposedSeries.expiration,
				proposedSeries.isPut
			)
			const marginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: proposedSeries.expiration,
						strike: proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: proposedSeries.isPut,
						strikeAsset: proposedSeries.strikeAsset,
						underlying: proposedSeries.underlying,
						collateral: proposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))
			oTokenUSDCSXC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			optionToken = oTokenUSDCSXC
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const before = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				optionToken,
				senderAddress,
				amount
			)

			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: proposedSeries.collateral,
							vaultId: vaultId,
							amount: marginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: vaultId,
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
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
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("5"),
				true
			)
			const after = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				optionToken,
				senderAddress,
				amount
			)
			expect(after.senderOtokenBalance).to.eq(0)
			expect(
				after.senderUSDBalance.sub(before.senderUSDBalance).sub(quote).add(marginRequirement)
			).to.be.within(-10, 10)
			expect(after.poolUSDBalance.sub(before.poolUSDBalance).add(quote)).to.be.within(-10, 10)
			expect(after.exchangeOTokenBalance).to.equal(after.opynAmount)
			expect(after.pfList.length - before.pfList.length).to.equal(1)
			expect(after.seriesStores.longExposure).to.equal(amount)
			expect(after.seriesStores.shortExposure).to.equal(0)
			expect(after.seriesStores.optionSeries.expiration).to.equal(proposedSeries.expiration)
			expect(after.seriesStores.optionSeries.isPut).to.equal(proposedSeries.isPut)
			expect(after.seriesStores.optionSeries.collateral)
				.to.equal(proposedSeries.collateral)
				.to.equal(usd.address)
			expect(after.seriesStores.optionSeries.underlying)
				.to.equal(proposedSeries.underlying)
				.to.equal(weth.address)
			expect(after.seriesStores.optionSeries.strikeAsset)
				.to.equal(proposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(after.seriesStores.optionSeries.strike).to.equal(proposedSeries.strike)
			expect(after.netDhvExposure.sub(amount)).to.equal(0)
		})
		it("LP Writes a ETH/USD call for premium for an option to be sold", async () => {
			const amount = toWei("5")
			const strikePrice = toWei("1650")
			const proposedSeries = {
				expiration: expiration2,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const before = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				0,
				senderAddress,
				amount
			)
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			let quote = quoteResponse[0].add(quoteResponse[2])
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
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("5"),
				true
			)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			oTokenUSDC1650C = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDC1650C
			const after = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				optionToken,
				senderAddress,
				amount
			)
			expect(after.senderOtokenBalance).to.eq(after.opynAmount)
			expect(after.exchangeOTokenBalance).to.eq(0)
			expect(before.senderUSDBalance.sub(after.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.add(quote)
					.add(before.collateralAllocated.sub(after.collateralAllocated))
			).to.be.within(-10, 10)
			expect(after.pfList.length - before.pfList.length).to.equal(1)
			expect(after.seriesStores.longExposure).to.equal(0)
			expect(after.seriesStores.shortExposure).to.equal(amount)
			expect(after.seriesStores.optionSeries.expiration).to.equal(proposedSeries.expiration)
			expect(after.seriesStores.optionSeries.isPut).to.equal(proposedSeries.isPut)
			expect(after.seriesStores.optionSeries.collateral)
				.to.equal(proposedSeries.collateral)
				.to.equal(usd.address)
			expect(after.seriesStores.optionSeries.underlying)
				.to.equal(proposedSeries.underlying)
				.to.equal(weth.address)
			expect(after.seriesStores.optionSeries.strikeAsset)
				.to.equal(proposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(after.seriesStores.optionSeries.strike).to.equal(proposedSeries.strike)
			expect(after.netDhvExposure.add(amount)).to.equal(0)
		})
		it("SUCCEEDS: LP Sells a ETH/USD call for premium creating otoken in tx", async () => {
			const amount = toWei("5")
			const strikePrice = toWei("1650")
			const proposedSeries = {
				expiration: expiration2,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const marginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: proposedSeries.expiration,
						strike: proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: proposedSeries.isPut,
						strikeAsset: proposedSeries.strikeAsset,
						underlying: proposedSeries.underlying,
						collateral: proposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
			oTokenUSDCSXC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			optionToken = oTokenUSDCSXC
			const before = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				optionToken,
				senderAddress,
				amount
			)
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			let quote = quoteResponse[0].sub(quoteResponse[2])
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)

			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							index: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: proposedSeries.collateral,
							vaultId: vaultId,
							amount: marginRequirement,
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: vaultId,
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							index: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
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
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("5"),
				true
			)
			const after = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				optionToken,
				senderAddress,
				amount
			)
			quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			quote = quoteResponse[0].sub(quoteResponse[2])
			expect(after.exchangeOTokenBalance).to.eq(0)
			expect(
				after.senderUSDBalance.sub(before.senderUSDBalance).sub(quote).add(marginRequirement)
			).to.be.within(-10, 10)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.sub(quote)
					.add(before.collateralAllocated.sub(after.collateralAllocated))
			).to.be.within(-10, 10)
			expect(after.pfList.length - before.pfList.length).to.equal(0)
			expect(after.seriesStores.longExposure).to.equal(0)
			expect(after.seriesStores.shortExposure).to.equal(0)
			expect(after.seriesStores.optionSeries.expiration).to.equal(proposedSeries.expiration)
			expect(after.seriesStores.optionSeries.isPut).to.equal(proposedSeries.isPut)
			expect(after.seriesStores.optionSeries.collateral)
				.to.equal(proposedSeries.collateral)
				.to.equal(usd.address)
			expect(after.seriesStores.optionSeries.underlying)
				.to.equal(proposedSeries.underlying)
				.to.equal(weth.address)
			expect(after.seriesStores.optionSeries.strikeAsset)
				.to.equal(proposedSeries.strikeAsset)
				.to.equal(usd.address)
			expect(after.seriesStores.optionSeries.strike).to.equal(proposedSeries.strike)
			expect(after.netDhvExposure.sub(before.netDhvExposure)).to.equal(amount)
		})
	})
	describe("Deposit funds into the liquidityPool and withdraws", async () => {
		it("Adds additional liquidity from new account", async () => {
			const [sender, receiver] = signers
			const sendAmount = toUSDC("1000000")
			const usdReceiver = usd.connect(receiver)
			await usdReceiver.approve(liquidityPool.address, sendAmount)
			const lpReceiver = liquidityPool.connect(receiver)
			const totalSupply = await liquidityPool.totalSupply()
			await lpReceiver.deposit(sendAmount)
			const newTotalSupply = await liquidityPool.totalSupply()
			const lpBalance = await lpReceiver.balanceOf(receiverAddress)
			const difference = newTotalSupply.sub(lpBalance)
			expect(difference).to.eq(await lpReceiver.balanceOf(senderAddress))
			expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))
		})
		it("pauses trading and executes epoch", async () => {
			await liquidityPool.pauseTradingAndRequest()
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			await liquidityPool.executeEpochCalculation()
		})
		it("initiates withdraw liquidity", async () => {
			await liquidityPool.initiateWithdraw(await liquidityPool.balanceOf(senderAddress))
			await liquidityPool
				.connect(signers[1])
				.initiateWithdraw(await liquidityPool.connect(signers[1]).callStatic.redeem(toWei("500000")))
		})
		it("pauses trading and executes epoch", async () => {
			await liquidityPool.pauseTradingAndRequest()
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			await liquidityPool.executeEpochCalculation()
		})
		it("LP can redeem shares", async () => {
			const totalShares = await liquidityPool.totalSupply()
			//@ts-ignore
			const ratio = 1 / fromWei(totalShares)
			const usdBalance = await usd.balanceOf(liquidityPool.address)
			const withdraw = await liquidityPool.completeWithdraw()
			const receipt = await withdraw.wait(1)
			const events = receipt.events
			const removeEvent = events?.find(x => x.event == "Withdraw")
			const strikeAmount = removeEvent?.args?.amount
			const usdBalanceAfter = await usd.balanceOf(liquidityPool.address)
			//@ts-ignore
			const diff = fromWei(usdBalance) * ratio
			expect(diff).to.be.lt(1)
			expect(strikeAmount).to.be.eq(usdBalance.sub(usdBalanceAfter))
		})
	})

	describe("Settles and redeems usd otoken", async () => {
		it("settles an expired ITM vault", async () => {
			optionToken = oTokenUSDCXC
			const totalCollateralAllocated = await liquidityPool.collateralAllocated()
			const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
			const strikePrice = await optionToken.strikePrice()
			// set price to $80 ITM for calls
			const settlePrice = strikePrice.add(toWei("80").div(oTokenDecimalShift18))
			// set the option expiry price, make sure the option has now expired
			await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)
			const vault = await controller.getVault(optionRegistry.address, 1)
			const collateralAllocatedToVault1 = vault.collateralAmounts[0]
			// settle the vault
			const settleVault = await liquidityPool.settleVault(optionToken.address)
			let receipt = await settleVault.wait()
			const events = receipt.events
			const settleEvent = events?.find(x => x.event == "SettleVault")
			const collateralReturned = settleEvent?.args?.collateralReturned
			const collateralLost = settleEvent?.args?.collateralLost
			// puts expired ITM, so the amount ITM will be subtracted and used to pay out option holders
			const optionITMamount = settlePrice.sub(strikePrice)
			const amount = parseFloat(utils.formatUnits(vault.shortAmounts[0], 8))
			// format from e8 oracle price to e6 USDC decimals
			expect(collateralReturned).to.equal(
				collateralAllocatedToVault1.sub(optionITMamount.div(100).mul(amount))
			)
			expect(await liquidityPool.collateralAllocated()).to.equal(
				totalCollateralAllocated.sub(collateralReturned).sub(collateralLost)
			)
		})
	})
})
