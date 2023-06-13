import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"
import {
	CALL_FLAVOR,
	fromUSDC,
	PUT_FLAVOR,
	toUSDC,
	toWei,
	fromWei
} from "../utils/conversion-helper"
//@ts-ignore
import { expect } from "chai"
import {
	AlphaPortfolioValuesFeed,
	BeyondPricer,
	LiquidityPool,
	MintableERC20,
	MockChainlinkAggregator,
	OptionCatalogue,
	OptionExchange,
	OptionRegistry,
	Oracle,
	PriceFeed,
	Protocol,
	VolatilityFeed,
	WETH,
	AddressBook
} from "../types"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { deployOpyn } from "../utils/opyn-deployer"
import { CHAINLINK_WETH_PRICER, ADDRESS_BOOK } from "./constants"
import {
	calculateOptionDeltaLocally,
	calculateOptionQuoteLocally,
	compareQuotes,
	setupTestOracle,
	getBlackScholesQuote,
	applySpreadLocally,
	applySlippageLocally,
	getTenorIndexAndRemainder,
	applyLinearInterpolation
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
let portfolioValuesFeed: AlphaPortfolioValuesFeed
let volFeed: VolatilityFeed
let priceFeed: PriceFeed
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let exchange: OptionExchange
let pricer: BeyondPricer
let catalogue: OptionCatalogue
let authority: string

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-03-27"

// edit depending on the chain id to be tested on
const chainId = 1

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "100000"
const liquidityPoolWethDeposit = "1"

const expiration = dayjs.utc(expiryDate).add(8, "days").add(8, "hours").unix()
const expiration2 = dayjs.utc(expiryDate).subtract(26, "days").unix()
const expiration3 = dayjs.utc(expiryDate).subtract(15, "days").unix()
const expiration4 = dayjs.utc(expiryDate).subtract(3, "days").unix()
const expiration5 = dayjs.utc(expiryDate).add(1, "month").add(20, "days").unix()

describe("Quote Option price", async () => {
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
		oracle = opynParams.oracle
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
				interestRate: utils.parseEther("-0.002")
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
				interestRate: utils.parseEther("-0.003")
			}
			await volFeed.setSabrParameters(proposedSabrParams, expiration3)
			const volFeedSabrParams = await volFeed.sabrParams(expiration3)
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
				interestRate: utils.parseEther("-0.004")
			}
			await volFeed.setSabrParameters(proposedSabrParams, expiration4)
			const volFeedSabrParams = await volFeed.sabrParams(expiration4)
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
				interestRate: utils.parseEther("-0.005")
			}
			await volFeed.setSabrParameters(proposedSabrParams, expiration5)
			const volFeedSabrParams = await volFeed.sabrParams(expiration5)
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
		it("sets spread values to non-zero", async () => {
			await pricer.setCollateralLendingRate(100000) // 10%
			expect(await pricer.collateralLendingRate()).to.eq(100000)
			await pricer.setDeltaBorrowRates({
				sellLong: 150000,
				sellShort: -100000,
				buyLong: 150000,
				buyShort: -100000
			})
			const newBorrowRates = await pricer.deltaBorrowRates()
			expect(newBorrowRates.sellLong).to.eq(150000)
			expect(newBorrowRates.sellShort).to.eq(-100000)
			expect(newBorrowRates.buyLong).to.eq(150000)
			expect(newBorrowRates.buyShort).to.eq(-100000)
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
		it("SETUP: set low spread delta multipliers on otm options for low tenors", async () => {
			const paramArray = [
				toWei("1.4"),
				toWei("1.3"),
				toWei("1.2"),
				toWei("1.1"),
				toWei("1"),
				toWei("1"),
				toWei("1.1"),
				toWei("1.2"),
				toWei("1.3"),
				toWei("1.4")
			]

			await pricer.setSpreadDeltaMultipliers(
				3,
				[
					toWei("1.4"),
					toWei("1.3"),
					toWei("1.2"),
					toWei("1.1"),
					toWei("1"),
					toWei("1"),
					toWei("1.1"),
					toWei("1.2"),
					toWei("1.3"),
					toWei("1.4")
				],
				[
					toWei("1.4"),
					toWei("1.3"),
					toWei("1.2"),
					toWei("1.1"),
					toWei("1"),
					toWei("1"),
					toWei("1.1"),
					toWei("1.2"),
					toWei("1.3"),
					toWei("1.4")
				]
			)
			await pricer.setSpreadDeltaMultipliers(
				4,
				[
					toWei("1.4"),
					toWei("1.3"),
					toWei("1.2"),
					toWei("1.1"),
					toWei("1"),
					toWei("1"),
					toWei("1.1"),
					toWei("1.2"),
					toWei("1.3"),
					toWei("1.4")
				],
				[
					toWei("1.4"),
					toWei("1.3"),
					toWei("1.2"),
					toWei("1.1"),
					toWei("1"),
					toWei("1"),
					toWei("1.1"),
					toWei("1.2"),
					toWei("1.3"),
					toWei("1.4")
				]
			)
		})
	})
	describe("Checks the bid on low delta options is set to flat IV set by pricer", async () => {
		let proposedSeries: any
		let singleSellQuote: BigNumber
		it("sets lowDeltaSellOptionFlatIV to 25%", async () => {
			expect(await pricer.lowDeltaSellOptionFlatIV()).to.eq(utils.parseEther("0.35"))
			await pricer.setLowDeltaSellOptionFlatIV(utils.parseEther("0.25"))
			expect(await pricer.lowDeltaSellOptionFlatIV()).to.eq(utils.parseEther("0.25"))
		})
		it("SUCCEEDS: get quote for 1 call when selling", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("3200"),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true
			)
			expect(Math.abs(parseFloat(fromWei(localDelta)))).to.be.lt(
				parseFloat(fromWei(await pricer.lowDeltaThreshold()))
			)
			// get vanilla black-scholes quote at flat IV
			const overrideQuote = await getBlackScholesQuote(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				await pricer.lowDeltaSellOptionFlatIV()
			)
			// get the quote the DHV would otherwise give without flat IV ovveride
			const bsQ = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			const slip = await applySlippageLocally(
				pricer,
				catalogue,
				portfolioValuesFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				true,
				0
			)
			let spread = 0

			spread = await applySpreadLocally(
				pricer,
				(await ethers.getContractAt("AddressBook", ADDRESS_BOOK[chainId])) as AddressBook,
				priceFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				toWei("0"),
				true
			)
			if (spread < 0) {
				spread = 0
			}
			const nonIvOverrideQuote = bsQ * slip - spread
			// IV override should be lower
			expect(overrideQuote).to.be.lt(nonIvOverrideQuote)

			singleSellQuote = quoteResponse[0]
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				optionProtocol,
				volFeed,
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
			// response from contract should match override quote
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.within(
				overrideQuote - 0.001,
				overrideQuote + 0.001
			)
		})

		it("SUCCEEDS: get quote for 1000 calls when selling", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true
			)
			expect(Math.abs(parseFloat(fromWei(localDelta.div(amount))))).to.be.lt(
				parseFloat(fromWei(await pricer.lowDeltaThreshold()))
			)
			// get vanilla black-scholes quote at flat IV
			const overrideQuote = await getBlackScholesQuote(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				await pricer.lowDeltaSellOptionFlatIV()
			)
			// get the quote the DHV would otherwise give without flat IV ovveride
			const bsQ = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			const slip = await applySlippageLocally(
				pricer,
				catalogue,
				portfolioValuesFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				true,
				0
			)
			let spread = 0

			spread = await applySpreadLocally(
				pricer,
				(await ethers.getContractAt("AddressBook", ADDRESS_BOOK[chainId])) as AddressBook,
				priceFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				toWei("0"),
				true
			)
			if (spread < 0) {
				spread = 0
			}

			const nonIvOverrideQuote = bsQ * slip - spread
			// IV override is NOT lower because of big slippage
			expect(overrideQuote).to.be.gt(nonIvOverrideQuote)

			await compareQuotes(
				quoteResponse,
				liquidityPool,
				optionProtocol,
				volFeed,
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
			// quote per contract should be smaller now
			expect(singleSellQuote).to.greaterThanOrEqual(quoteResponse[0].div(1000))
			// DHV quote should match non override quote because that is lower
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.within(
				nonIvOverrideQuote - 0.1,
				nonIvOverrideQuote + 0.1
			)
		})
		it("buys for calls are not affected by the IV override", async () => {
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)

			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				false
			)
			console.log({ localDelta: fromWei(localDelta) })
			expect(Math.abs(parseFloat(fromWei(localDelta)))).to.be.lt(
				parseFloat(fromWei(await pricer.lowDeltaThreshold()))
			)
			// get vanilla black-scholes quote at flat IV
			const overrideQuote = await getBlackScholesQuote(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				await pricer.lowDeltaSellOptionFlatIV()
			)
			// get the quote the DHV would otherwise give without flat IV ovveride
			const bsQ = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				false
			)
			const slip = await applySlippageLocally(
				pricer,
				catalogue,
				portfolioValuesFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				false,
				0
			)
			let spread = 0

			spread = await applySpreadLocally(
				pricer,
				(await ethers.getContractAt("AddressBook", ADDRESS_BOOK[chainId])) as AddressBook,
				priceFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				toWei("0"),
				false
			)
			if (spread < 0) {
				spread = 0
			}
			const nonIvOverrideQuote = bsQ * slip + spread
			// IV override should be lower
			expect(overrideQuote).to.be.lt(nonIvOverrideQuote)

			singleSellQuote = quoteResponse[0]
			await compareQuotes(
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
				pricer,
				toWei("0")
			)
			// response from contract should match non-iv-override quote
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.within(
				nonIvOverrideQuote - 0.001,
				nonIvOverrideQuote + 0.001
			)
		})
		it("SUCCEEDS: get quote for 1 put when selling", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2350"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true
			)
			console.log({ localDelta: fromWei(localDelta) })
			expect(Math.abs(parseFloat(fromWei(localDelta)))).to.be.lt(
				parseFloat(fromWei(await pricer.lowDeltaThreshold()))
			)
			// get vanilla black-scholes quote at flat IV
			const overrideQuote = await getBlackScholesQuote(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				await pricer.lowDeltaSellOptionFlatIV()
			)
			// get the quote the DHV would otherwise give without flat IV ovveride
			const bsQ = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			const slip = await applySlippageLocally(
				pricer,
				catalogue,
				portfolioValuesFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				true,
				0
			)
			let spread = 0

			spread = await applySpreadLocally(
				pricer,
				(await ethers.getContractAt("AddressBook", ADDRESS_BOOK[chainId])) as AddressBook,
				priceFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				toWei("0"),
				true
			)
			if (spread < 0) {
				spread = 0
			}
			console.log("local:", bsQ, slip, spread)
			const nonIvOverrideQuote = Math.max(bsQ * slip - spread, 0)
			// IV override should be lower
			expect(overrideQuote).to.be.lt(nonIvOverrideQuote)

			singleSellQuote = quoteResponse[0]
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				optionProtocol,
				volFeed,
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
			// response from contract should match override quote
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.within(
				overrideQuote - 0.001,
				overrideQuote + 0.001
			)
		})

		it("SUCCEEDS: get quote for 1000 puts when selling", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				true
			)
			expect(Math.abs(parseFloat(fromWei(localDelta.div(amount))))).to.be.lt(
				parseFloat(fromWei(await pricer.lowDeltaThreshold()))
			)
			// get vanilla black-scholes quote at flat IV
			const overrideQuote = await getBlackScholesQuote(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				await pricer.lowDeltaSellOptionFlatIV()
			)
			// get the quote the DHV would otherwise give without flat IV ovveride
			const bsQ = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				true
			)
			const slip = await applySlippageLocally(
				pricer,
				catalogue,
				portfolioValuesFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				true,
				0
			)
			let spread = 0

			spread = await applySpreadLocally(
				pricer,
				(await ethers.getContractAt("AddressBook", ADDRESS_BOOK[chainId])) as AddressBook,
				priceFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				toWei("0"),
				true
			)
			if (spread < 0) {
				spread = 0
			}

			const nonIvOverrideQuote = bsQ * slip - spread
			// IV override is still lower despite big slippage
			expect(overrideQuote).to.be.lt(nonIvOverrideQuote)

			await compareQuotes(
				quoteResponse,
				liquidityPool,
				optionProtocol,
				volFeed,
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
			// quote per contract should be smaller now
			expect(singleSellQuote).to.greaterThanOrEqual(quoteResponse[0].div(1000))
			// DHV quote should match  override quote because that is lower
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.within(
				overrideQuote - 0.2,
				overrideQuote + 0.2
			)
		})
		it("buys for puts are not affected by the IV override", async () => {
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				false
			)
			expect(Math.abs(parseFloat(fromWei(localDelta)))).to.be.lt(
				parseFloat(fromWei(await pricer.lowDeltaThreshold()))
			)
			// get vanilla black-scholes quote at flat IV
			const overrideQuote = await getBlackScholesQuote(
				liquidityPool,
				priceFeed,
				proposedSeries,
				amount,
				await pricer.lowDeltaSellOptionFlatIV()
			)
			// get the quote the DHV would otherwise give without flat IV ovveride
			const bsQ = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount,
				pricer,
				false
			)
			const slip = await applySlippageLocally(
				pricer,
				catalogue,
				portfolioValuesFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				false,
				0
			)
			let spread = 0

			spread = await applySpreadLocally(
				pricer,
				(await ethers.getContractAt("AddressBook", ADDRESS_BOOK[chainId])) as AddressBook,
				priceFeed,
				proposedSeries,
				amount,
				localDelta.div(amount.div(toWei("1"))),
				toWei("0"),
				false
			)
			if (spread < 0) {
				spread = 0
			}
			const nonIvOverrideQuote = bsQ * slip + spread
			// IV override should be lower
			expect(overrideQuote).to.be.lt(nonIvOverrideQuote)

			singleSellQuote = quoteResponse[0]
			await compareQuotes(
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
				pricer,
				toWei("0")
			)
			// response from contract should match non-iv-override quote
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.within(
				nonIvOverrideQuote - 0.001,
				nonIvOverrideQuote + 0.001
			)
		})
	})

	describe("Get quotes successfully for small and big puts", async () => {
		let proposedSeries: any
		let singleBuyQuote: BigNumber
		let singleSellQuote: BigNumber
		it("SUCCEEDS: get quote for 1 option when buying", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2600"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
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
				optionProtocol,
				volFeed,
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
				volFeed,
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
				optionProtocol,
				volFeed,
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
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.lt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 1000 options when buying", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
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
				optionProtocol,
				volFeed,
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
			// slippage should push price up
			expect(singleBuyQuote).to.be.lt(quoteResponse[0].div(1000))
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.gt(localQuoteNoSpread)
		})
		it("SUCCEEDS: get quote for 1000 options when selling", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			const localQuoteNoSpread = await calculateOptionQuoteLocally(
				liquidityPool,
				volFeed,
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
				optionProtocol,
				volFeed,
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
			expect(singleSellQuote).to.be.gt(quoteResponse[0].div(1000))
			expect(parseFloat(fromUSDC(quoteResponse[0]))).to.be.lt(localQuoteNoSpread)
		})
	})
	let proposedSeries1
	let proposedSeries2
	let proposedSeries3
	let proposedSeries4
	let proposedSeries5
	let proposedSeries6
	let proposedSeries7
	let proposedSeries8
	let proposedSeries9
	let proposedSeries10
	let proposedSeries11
	let proposedSeries12
	let proposedSeries13
	let proposedSeries14
	let proposedSeries15
	let proposedSeries16
	let proposedSeries17
	let proposedSeries18
	let proposedSeries19
	let proposedSeries20
	let delta1
	let delta2
	let delta3
	let delta4
	let delta5
	let delta6
	let delta7
	let delta8
	let delta9
	let delta10
	let delta11
	let delta12
	let delta13
	let delta14
	let delta15
	let delta16
	let delta17
	let delta18
	let delta19
	let delta20

	describe("check interpolation values", async () => {
		it("gets deltas", async () => {
			const amount = toWei("1")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			proposedSeries1 = {
				expiration: expiration,
				strike: priceQuote.add(toWei("200")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries2 = {
				expiration: expiration,
				strike: priceQuote.add(toWei("50")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries3 = {
				expiration: expiration,
				strike: priceQuote.sub(toWei("300")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries4 = {
				expiration: expiration,
				strike: priceQuote.sub(toWei("50")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries5 = {
				expiration: expiration2,
				strike: priceQuote.add(toWei("50")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries6 = {
				expiration: expiration2,
				strike: priceQuote.add(toWei("10")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries7 = {
				expiration: expiration2,
				strike: priceQuote.sub(toWei("20")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries8 = {
				expiration: expiration2,
				strike: priceQuote.sub(toWei("50")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries9 = {
				expiration: expiration3,
				strike: priceQuote.add(toWei("150")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries10 = {
				expiration: expiration3,
				strike: priceQuote.add(toWei("75")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries11 = {
				expiration: expiration3,
				strike: priceQuote.sub(toWei("30")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries12 = {
				expiration: expiration3,
				strike: priceQuote.sub(toWei("150")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries13 = {
				expiration: expiration4,
				strike: priceQuote.add(toWei("300")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries14 = {
				expiration: expiration4,
				strike: priceQuote.add(toWei("150")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries15 = {
				expiration: expiration4,
				strike: priceQuote.sub(toWei("50")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries16 = {
				expiration: expiration4,
				strike: priceQuote.sub(toWei("300")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries17 = {
				expiration: expiration5,
				strike: priceQuote.add(toWei("1000")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries18 = {
				expiration: expiration5,
				strike: priceQuote.add(toWei("400")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries19 = {
				expiration: expiration5,
				strike: priceQuote.sub(toWei("0")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries20 = {
				expiration: expiration5,
				strike: priceQuote.sub(toWei("480")),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			delta1 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries1, amount, false)
			)
			delta2 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries2, amount, false)
			)
			delta3 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries3, amount, false)
			)
			delta4 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries4, amount, false)
			)
			delta5 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries5, amount, false)
			)
			delta6 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries6, amount, false)
			)
			delta7 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries7, amount, false)
			)
			delta8 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries8, amount, false)
			)
			delta9 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries9, amount, false)
			)
			delta10 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries10, amount, false)
			)
			delta11 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries11, amount, false)
			)
			delta12 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries12, amount, false)
			)
			delta13 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries13, amount, false)
			)
			delta14 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries14, amount, false)
			)
			delta15 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries15, amount, false)
			)
			delta16 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries16, amount, false)
			)
			delta17 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries17, amount, false)
			)
			delta18 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries18, amount, false)
			)
			delta19 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries19, amount, false)
			)
			delta20 = fromWei(
				await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries20, amount, false)
			)
			console.log({
				delta1,
				delta2,
				delta3,
				delta4,
				delta5,
				delta6,
				delta7,
				delta8,
				delta9,
				delta10,
				delta11,
				delta12,
				delta13,
				delta14,
				delta15,
				delta16,
				delta17,
				delta18,
				delta19,
				delta20
			})
		})
		it("checks interpolation on proposedSeries1", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries1.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries1.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta1 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries2", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries2.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries2.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta2 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries3", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries3.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries3.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta3 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries4", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries4.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries4.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta4 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries5", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries5.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			console.log({ sqrtTau, tenorWidth, expectedTenor })
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries5.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta5 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries6", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries6.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries6.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta6 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries7", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries7.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries7.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta7 * 100) / parseFloat(fromWei(deltaBandWidth)))
			console.log({ deltaBand, delta7 })
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries8", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries8.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries8.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta8 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries9", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries9.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries9.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta9 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries10", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries10.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries10.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta10 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries11", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries11.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries11.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta11 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries12", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries12.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries12.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta12 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries13", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries13.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries13.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta13 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries14", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries14.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries14.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta14 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries15", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries15.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries15.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta15 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries16", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries16.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries16.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta16 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries17", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries17.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries17.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta17 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries18", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries18.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries18.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta18 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries19", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries19.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries19.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta19 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
		it("checks interpolation on proposedSeries20", async () => {
			const maxTenorValue = await pricer.maxTenorValue()
			const numberOfTenors = await pricer.numberOfTenors()
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const sqrtTau = Math.sqrt(proposedSeries20.expiration - timestamp)
			const tenorWidth = maxTenorValue / (numberOfTenors - 1)
			const expectedTenor = Math.floor(sqrtTau / tenorWidth)
			const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
			const [tenor, remainder] = await getTenorIndexAndRemainder(proposedSeries20.expiration, pricer)
			expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
			expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
			// calculate expected slippage gradient multiplier
			const deltaBandWidth = await pricer.deltaBandWidth()
			const deltaBand = Math.floor((delta20 * 100) / parseFloat(fromWei(deltaBandWidth)))
			const multiplierLowerTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
			)
			const multiplierUpperTenor = parseFloat(
				fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
			)
			const interpolatedValue = await applyLinearInterpolation(
				tenor,
				remainder,
				false,
				deltaBand,
				pricer,
				0
			)

			console.log({ multiplierLowerTenor, multiplierUpperTenor, remainder, interpolatedValue, tenor })
			expect(interpolatedValue).to.eq(
				multiplierLowerTenor + remainder * (multiplierUpperTenor - multiplierLowerTenor)
			)
		})
	})
	describe("set flat IV params", async () => {
		it("set low delta threshold to 0.1", async () => {
			expect(await pricer.lowDeltaThreshold()).to.eq(toWei("0.05"))
			await pricer.setLowDeltaThreshold(toWei("0.1"))
			expect(await pricer.lowDeltaThreshold()).to.eq(toWei("0.1"))
		})
		it("set risk free rate to 3%", async () => {
			expect(await pricer.riskFreeRate()).to.eq(toWei("0"))
			await pricer.setRiskFreeRate(toWei("0.03"))
			expect(await pricer.riskFreeRate()).to.eq(toWei("0.03"))
		})
	})
})
