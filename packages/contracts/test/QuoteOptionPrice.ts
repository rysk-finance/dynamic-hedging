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
	applySlippageLocally
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

const expiration = dayjs.utc(expiryDate).add(8, "days").unix()
const expiration2 = dayjs.utc(expiryDate).add(1, "month").add(8, "hours").unix() // have another batch of options exire 1 month after the first

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
	})
	describe("Checks the bid on low delta options is set to flat IV set by pricer", async () => {
		let proposedSeries: any
		let singleSellQuote: BigNumber
		it("sets lowDeltaSellOptionFlatIV to 25%", async () => {
			expect(await pricer.lowDeltaSellOptionFlatIV()).to.eq(utils.parseEther("0.3"))
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
				strike: toWei("2300"),
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
				overrideQuote - 0.1,
				overrideQuote + 0.1
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
