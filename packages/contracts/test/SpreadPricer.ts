import hre, { ethers, network } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber } from "ethers"
import { toWei, toUSDC, scaleNum, fromUSDC } from "../utils/conversion-helper"
import moment from "moment"
import { AbiCoder } from "ethers/lib/utils"
//@ts-ignore
import { expect } from "chai"
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
import { setupTestOracle, calculateOptionQuoteLocally, compareQuotes } from "./helpers"
import { CHAINLINK_WETH_PRICER } from "./constants"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { deployOpyn } from "../utils/opyn-deployer"
import { AlphaPortfolioValuesFeed } from "../types/AlphaPortfolioValuesFeed"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { BeyondPricer } from "../types/BeyondPricer"
import { NewWhitelist } from "../types/NewWhitelist"
import { OptionExchange } from "../types/OptionExchange"
import { OptionCatalogue } from "../types/OptionCatalogue"

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
let exchange: OptionExchange
let pricer: BeyondPricer
let authority: string
let catalogue: OptionCatalogue

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

/* --- end variables to change --- */

const expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000
const expiration2 = moment.utc(expiryDate).add(1, "w").add(8, "h").valueOf() / 1000 // have another batch of options exire 1 week after the first
const expiration3 = moment.utc(expiryDate).add(2, "w").add(8, "h").valueOf() / 1000
const invalidExpirationLong = moment.utc(invalidExpiryDateLong).add(8, "h").valueOf() / 1000
const invalidExpirationShort = moment.utc(invalidExpiryDateShort).add(8, "h").valueOf() / 1000
const abiCode = new AbiCoder()
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
describe("Spread Pricer testing", async () => {
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
		catalogue = lpParams.catalogue
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
		it("sets spread values to non-zero", async () => {
			await pricer.setCollateralLendingRate(1000) // 10%
			expect(await pricer.collateralLendingRate()).to.eq(1000)
			await pricer.setShortDeltaBorrowRate(1000) // 10%
			expect(await pricer.shortDeltaBorrowRate()).to.eq(1000)
			await pricer.setLongDeltaBorrowRate(1500) // 15%
			expect(await pricer.longDeltaBorrowRate()).to.eq(1500)
		})
		it("sets slippage vars to zero", async () => {
			await pricer.setSlippageGradient(0)
			expect(await pricer.slippageGradient()).to.eq(0)
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
	})
	describe("Get quotes successfully for small and big calls", async () => {
		let proposedSeries: OptionSeriesStruct
		let singleBuyQuote: BigNumber
		let singleSellQuote: BigNumber
		it("SUCCEEDS: get quote for 1 option when buying", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2500"),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				false
			)
			singleBuyQuote = quoteResponse[0]
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				false,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.gt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 1 option when selling", async () => {
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			singleSellQuote = quoteResponse[0]
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(parseFloat(fromUSDC(quoteResponse[0])) - localQuoteNoSpread).to.be.within(-0.1, 0.1)
		})
		it("SUCCEEDS: get quote for 1000 options when buying", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				false
			)
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				false,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(singleBuyQuote.toNumber()).to.eq(quoteResponse[0].div(1000))
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.gt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 1000 options when selling", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			console.log({ quoteResponse: fromUSDC(quoteResponse[0]), localQuoteNoSpread })
			expect(singleSellQuote).to.eq(quoteResponse[0].div(1000))
			expect(parseFloat(fromUSDC(quoteResponse[0])) - localQuoteNoSpread).to.be.within(-0.1, 0.1)
		})
	})
	describe("Get quotes successfully for small and big puts", async () => {
		let proposedSeries: OptionSeriesStruct
		let singleBuyQuote: BigNumber
		let singleSellQuote: BigNumber
		it("SUCCEEDS: get quote for 1 option when buying", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2000"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				false
			)
			singleBuyQuote = quoteResponse[0]
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				false,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.gt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 1 option when selling", async () => {
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			singleSellQuote = quoteResponse[0]
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(parseFloat(fromUSDC(quoteResponse[0])) - localQuoteNoSpread).to.be.within(-0.1, 0.1)
		})
		it("SUCCEEDS: get quote for 1000 options when buying", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				false
			)
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				false,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(singleBuyQuote).to.eq(quoteResponse[0].div(1000))
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.gt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 1000 options when selling", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(singleSellQuote).to.eq(quoteResponse[0].div(1000))
			expect(parseFloat(fromUSDC(quoteResponse[0])) - localQuoteNoSpread).to.be.within(-0.1, 0.1)
		})
	})
	describe("Compare lots of small quotes to one big quote", async () => {
		let proposedSeries: OptionSeriesStruct
		let buyQuoteLots: BigNumber
		let sellQuoteLots: BigNumber
		it("SUCCEEDS: get quote for 100 option when buying 100 times", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2600"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				toWei("100"),
				pricer,
				false
			)
			const allAtOnceQuote = (
				await pricer.quoteOptionPrice(proposedSeries, toWei("100"), false, toWei("0"))
			)[0]
			buyQuoteLots = toWei("0")
			for (let i = 0; i < 100; i++) {
				const amount = toWei("1")
				let quoteResponse = await pricer.quoteOptionPrice(
					proposedSeries,
					amount,
					false,
					toWei("0").sub(toWei(i.toString()))
				)
				await compareQuotes(
					quoteResponse,
					liquidityPool,
					priceFeed,
					proposedSeries,
					amount,
					false,
					exchange,
					optionRegistry,
					usd,
					pricer,
					toWei("0").sub(toWei(i.toString()))
				)
				buyQuoteLots = buyQuoteLots.add(quoteResponse.totalPremium)
			}
			expect(allAtOnceQuote.sub(buyQuoteLots)).to.be.within(-100, 100)
			expect(parseFloat(fromUSDC(buyQuoteLots))).to.be.gt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 100 options when selling 100 times", async () => {
			sellQuoteLots = toWei("0")
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				toWei("100"),
				pricer,
				true
			)
			const allAtOnceQuote = (
				await pricer.quoteOptionPrice(proposedSeries, toWei("100"), true, toWei("0"))
			)[0]
			for (let i = 0; i < 100; i++) {
				const amount = toWei("1")
				let quoteResponse = await pricer.quoteOptionPrice(
					proposedSeries,
					amount,
					true,
					toWei(i.toString())
				)
				await compareQuotes(
					quoteResponse,
					liquidityPool,
					priceFeed,
					proposedSeries,
					amount,
					true,
					exchange,
					optionRegistry,
					usd,
					pricer,
					toWei(i.toString())
				)
				sellQuoteLots = sellQuoteLots.add(quoteResponse.totalPremium)
				expect(quoteResponse[0]).to.eq(allAtOnceQuote.div(100))
			}
			expect(allAtOnceQuote.sub(sellQuoteLots)).to.be.within(-100, 100)
			expect(parseFloat(fromUSDC(sellQuoteLots)) - localQuoteNoSpread).to.be.within(-0.1, 0.1)
		})
		it("SUCCEEDS: get quote for 100 options when buying 1 time", async () => {
			const amount = toWei("100")
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				false
			)
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				false,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(buyQuoteLots.sub(quoteResponse[0])).to.be.within(-100, 100)
			expect(parseFloat(fromUSDC(buyQuoteLots))).to.be.gt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 100 options when selling 1 time", async () => {
			const amount = toWei("100")
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			expect(sellQuoteLots.sub(quoteResponse[0])).to.be.within(-100, 100)
			expect(parseFloat(fromUSDC(sellQuoteLots)) - localQuoteNoSpread).to.be.within(-0.1, 0.1)
		})
		it("SUCCEEDS: get quote for 100 options when buying 100 times and dhv has positive exposure", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2600"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				toWei("100"),
				pricer,
				false
			)
			buyQuoteLots = toWei("0")
			const allAtOnceQuote = (
				await pricer.quoteOptionPrice(proposedSeries, toWei("100"), false, toWei("100"))
			)[0]

			for (let i = 0; i < 100; i++) {
				const amount = toWei("1")
				let quoteResponse = await pricer.quoteOptionPrice(
					proposedSeries,
					amount,
					false,
					toWei("100").sub(toWei(i.toString()))
				)

				await compareQuotes(
					quoteResponse,
					liquidityPool,
					priceFeed,
					proposedSeries,
					amount,
					false,
					exchange,
					optionRegistry,
					usd,
					pricer,
					toWei("100").sub(toWei(i.toString()))
				)
				expect(quoteResponse[0]).to.eq(allAtOnceQuote.div(100))
				buyQuoteLots = buyQuoteLots.add(quoteResponse.totalPremium)
			}
			expect(buyQuoteLots.sub(allAtOnceQuote)).to.be.within(-100, 100)
			expect(parseFloat(fromUSDC(buyQuoteLots))).to.be.gt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 100 options when buying 100 times and dhv has half amount worth of long exposure", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2600"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			buyQuoteLots = toWei("0")
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				toWei("100"),
				pricer,
				false
			)
			const allAtOnceQuoteNoLongExposure = (
				await pricer.quoteOptionPrice(proposedSeries, toWei("100"), false, toWei("0"))
			)[0]
			const allAtOnceQuoteFullLongExposure = (
				await pricer.quoteOptionPrice(proposedSeries, toWei("100"), false, toWei("100"))
			)[0]
			const allAtOnceQuoteHalfLongExposure = (
				await pricer.quoteOptionPrice(proposedSeries, toWei("100"), false, toWei("50"))
			)[0]

			for (let i = 0; i < 100; i++) {
				const amount = toWei("1")
				let quoteResponse = await pricer.quoteOptionPrice(
					proposedSeries,
					amount,
					false,
					toWei("50").sub(toWei(i.toString()))
				)

				await compareQuotes(
					quoteResponse,
					liquidityPool,
					priceFeed,
					proposedSeries,
					amount,
					false,
					exchange,
					optionRegistry,
					usd,
					pricer,
					toWei("50").sub(toWei(i.toString()))
				)
				if (i < 50) {
					expect(quoteResponse[0]).to.eq(allAtOnceQuoteFullLongExposure.div(100))
				} else {
					expect(quoteResponse[0]).to.eq(allAtOnceQuoteNoLongExposure.div(100))
				}
				buyQuoteLots = buyQuoteLots.add(quoteResponse.totalPremium)
			}
			expect(parseFloat(fromUSDC(buyQuoteLots))).to.be.gt(localQuoteNoSpread)
			expect(buyQuoteLots.sub(allAtOnceQuoteHalfLongExposure)).to.be.within(-100, 100)
			expect(allAtOnceQuoteFullLongExposure).to.be.lt(allAtOnceQuoteHalfLongExposure)
			expect(allAtOnceQuoteHalfLongExposure).to.be.lt(allAtOnceQuoteNoLongExposure)
		})
	})
})
