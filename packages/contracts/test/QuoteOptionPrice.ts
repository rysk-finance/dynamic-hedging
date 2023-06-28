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

async function testInterpolation(optionSeries, optionDelta) {
	const maxTenorValue = await pricer.maxTenorValue()
	const numberOfTenors = await pricer.numberOfTenors()
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block
	const sqrtTau = Math.sqrt(optionSeries.expiration - timestamp)
	const tenorWidth = maxTenorValue / (numberOfTenors - 1)
	const expectedTenor = Math.floor(sqrtTau / tenorWidth)
	const expectedRemainder = sqrtTau / tenorWidth - expectedTenor
	const [tenor, remainder] = await getTenorIndexAndRemainder(optionSeries.expiration, pricer)
	expect(tenor.toFixed(10)).to.eq(expectedTenor.toFixed(10))
	expect(remainder.toFixed(10)).to.eq(expectedRemainder.toFixed(10))
	const deltaBandWidth = await pricer.deltaBandWidth()
	const deltaBand = Math.floor((optionDelta * 100) / parseFloat(fromWei(deltaBandWidth)))
	// calculate expected slippage gradient multiplier
	const slippageMultiplierLowerTenor = parseFloat(
		fromWei((await pricer.getCallSlippageGradientMultipliers(tenor))[deltaBand])
	)
	const slippageInterpolatedValue = await applyLinearInterpolation(
		tenor,
		remainder,
		optionSeries.isPut,
		deltaBand,
		pricer,
		0
	)
	if (remainder > 0) {
		const slippageMultiplierUpperTenor = parseFloat(
			fromWei((await pricer.getCallSlippageGradientMultipliers(tenor + 1))[deltaBand])
		)
		expect(slippageInterpolatedValue).to.be.within(
			Math.min(slippageMultiplierLowerTenor, slippageMultiplierUpperTenor),
			Math.max(slippageMultiplierLowerTenor, slippageMultiplierUpperTenor)
		)
		expect(slippageInterpolatedValue).to.eq(
			slippageMultiplierLowerTenor +
				remainder * (slippageMultiplierUpperTenor - slippageMultiplierLowerTenor)
		)
	} else {
		expect(slippageInterpolatedValue).to.eq(slippageMultiplierLowerTenor)
	}
	// calculate spread Collateral mutliplier
	const spreadCollateralMultiplierLowerTenor = parseFloat(
		fromWei((await pricer.getCallSpreadCollateralMultipliers(tenor))[deltaBand])
	)
	const spreadCollateralInterpolatedValue = await applyLinearInterpolation(
		tenor,
		remainder,
		optionSeries.isPut,
		deltaBand,
		pricer,
		2
	)
	if (remainder > 0) {
		const spreadCollateralMultiplierUpperTenor = parseFloat(
			fromWei((await pricer.getCallSpreadCollateralMultipliers(tenor + 1))[deltaBand])
		)
		expect(spreadCollateralInterpolatedValue).to.be.within(
			Math.min(spreadCollateralMultiplierLowerTenor, spreadCollateralMultiplierUpperTenor),
			Math.max(spreadCollateralMultiplierLowerTenor, spreadCollateralMultiplierUpperTenor)
		)
		expect(spreadCollateralInterpolatedValue).to.eq(
			spreadCollateralMultiplierLowerTenor +
				remainder * (spreadCollateralMultiplierUpperTenor - spreadCollateralMultiplierLowerTenor)
		)
	} else {
		expect(spreadCollateralInterpolatedValue).to.eq(spreadCollateralMultiplierLowerTenor)
	}
	// calculate spread Delta mutliplier
	const spreadDeltaMultiplierLowerTenor = parseFloat(
		fromWei((await pricer.getCallSpreadDeltaMultipliers(tenor))[deltaBand])
	)
	const spreadDeltaInterpolatedValue = await applyLinearInterpolation(
		tenor,
		remainder,
		optionSeries.isPut,
		deltaBand,
		pricer,
		1
	)
	if (remainder > 0) {
		const spreadDeltaMultiplierUpperTenor = parseFloat(
			fromWei((await pricer.getCallSpreadDeltaMultipliers(tenor + 1))[deltaBand])
		)
		expect(spreadDeltaInterpolatedValue).to.be.within(
			Math.min(spreadDeltaMultiplierLowerTenor, spreadDeltaMultiplierUpperTenor),
			Math.max(spreadDeltaMultiplierLowerTenor, spreadDeltaMultiplierUpperTenor)
		)
		expect(spreadDeltaInterpolatedValue).to.eq(
			spreadDeltaMultiplierLowerTenor +
				remainder * (spreadDeltaMultiplierUpperTenor - spreadDeltaMultiplierLowerTenor)
		)
	} else {
		expect(spreadDeltaInterpolatedValue).to.eq(spreadDeltaMultiplierLowerTenor)
	}
}

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
			await exchange.pause()
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
			await exchange.unpause()
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
			await exchange.pause()
			await pricer.setCollateralLendingRate(100000) // 10%
			expect(await pricer.collateralLendingRate()).to.eq(100000)
			await pricer.setDeltaBorrowRates({
				sellLong: 150000,
				sellShort: -100000,
				buyLong: 150000,
				buyShort: -100000
			})
			const newBorrowRates = await pricer.deltaBorrowRates()
			await exchange.unpause()
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
			await exchange.pause()
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
			await exchange.unpause()
		})
	})
	describe("Checks the bid on low delta options is set to flat IV set by pricer", async () => {
		let proposedSeries: any
		let singleSellQuote: BigNumber
		it("sets lowDeltaSellOptionFlatIV to 25%", async () => {
			expect(await pricer.lowDeltaSellOptionFlatIV()).to.eq(utils.parseEther("0.35"))
			await exchange.pause()
			await pricer.setLowDeltaSellOptionFlatIV(utils.parseEther("0.25"))
			await exchange.unpause()
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
	let proposedSeries21
	let proposedSeries22
	let proposedSeries23
	let proposedSeries24
	let proposedSeries25
	let proposedSeries26
	let proposedSeries27
	let proposedSeries28
	let proposedSeries29
	let proposedSeries30
	let proposedSeries31
	let proposedSeries32
	let proposedSeries33
	let proposedSeries34
	let proposedSeries35
	let proposedSeries36
	let proposedSeries37
	let proposedSeries38
	let proposedSeries39
	let proposedSeries40
	let proposedSeries41
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
	let delta21
	let delta22
	let delta23
	let delta24
	let delta25
	let delta26
	let delta27
	let delta28
	let delta29
	let delta30
	let delta31
	let delta32
	let delta33
	let delta34
	let delta35
	let delta36
	let delta37
	let delta38
	let delta39
	let delta40
	let delta41

	describe("check interpolation values", async () => {
		it("gets deltas", async () => {
			const amount = toWei("1")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block

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
			await exchange.pause()
			await volFeed.setSabrParameters(proposedSabrParams, timestamp + 4 + 2800 ** 2)
			await exchange.unpause()

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
			proposedSeries21 = {
				expiration: expiration,
				strike: priceQuote.add(toWei("200")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries22 = {
				expiration: expiration,
				strike: priceQuote.add(toWei("50")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries23 = {
				expiration: expiration,
				strike: priceQuote.sub(toWei("300")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries24 = {
				expiration: expiration,
				strike: priceQuote.sub(toWei("50")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries25 = {
				expiration: expiration2,
				strike: priceQuote.add(toWei("50")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries26 = {
				expiration: expiration2,
				strike: priceQuote.add(toWei("10")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries27 = {
				expiration: expiration2,
				strike: priceQuote.sub(toWei("20")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries28 = {
				expiration: expiration2,
				strike: priceQuote.sub(toWei("50")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries29 = {
				expiration: expiration3,
				strike: priceQuote.add(toWei("150")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries30 = {
				expiration: expiration3,
				strike: priceQuote.add(toWei("75")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries31 = {
				expiration: expiration3,
				strike: priceQuote.sub(toWei("30")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries32 = {
				expiration: expiration3,
				strike: priceQuote.sub(toWei("150")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries33 = {
				expiration: expiration4,
				strike: priceQuote.add(toWei("300")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries34 = {
				expiration: expiration4,
				strike: priceQuote.add(toWei("150")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries35 = {
				expiration: expiration4,
				strike: priceQuote.sub(toWei("50")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries36 = {
				expiration: expiration4,
				strike: priceQuote.sub(toWei("300")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries37 = {
				expiration: expiration5,
				strike: priceQuote.add(toWei("1000")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries38 = {
				expiration: expiration5,
				strike: priceQuote.add(toWei("400")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries39 = {
				expiration: expiration5,
				strike: priceQuote.sub(toWei("0")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries40 = {
				expiration: expiration5,
				strike: priceQuote.sub(toWei("480")),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			proposedSeries41 = {
				expiration: timestamp + 4 + 2800 ** 2,
				strike: priceQuote.sub(toWei("480")),
				isPut: PUT_FLAVOR,
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
			delta21 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries21, amount, false)
					)
				)
			)
			delta22 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries22, amount, false)
					)
				)
			)
			delta23 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries23, amount, false)
					)
				)
			)
			delta24 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries24, amount, false)
					)
				)
			)
			delta25 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries25, amount, false)
					)
				)
			)
			delta26 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries26, amount, false)
					)
				)
			)
			delta27 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries27, amount, false)
					)
				)
			)
			delta28 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries28, amount, false)
					)
				)
			)
			delta29 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries29, amount, false)
					)
				)
			)
			delta30 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries30, amount, false)
					)
				)
			)
			delta31 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries31, amount, false)
					)
				)
			)
			delta32 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries32, amount, false)
					)
				)
			)
			delta33 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries33, amount, false)
					)
				)
			)
			delta34 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries34, amount, false)
					)
				)
			)
			delta35 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries35, amount, false)
					)
				)
			)
			delta36 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries36, amount, false)
					)
				)
			)
			delta37 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries37, amount, false)
					)
				)
			)
			delta38 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries38, amount, false)
					)
				)
			)
			delta39 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries39, amount, false)
					)
				)
			)
			delta40 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries40, amount, false)
					)
				)
			)
			delta41 = Math.abs(
				parseFloat(
					fromWei(
						await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries41, amount, false)
					)
				)
			)
		})

		it("checks interpolations on proposedSeries", async () => {
			await testInterpolation(proposedSeries1, delta1)
			await testInterpolation(proposedSeries2, delta2)
			await testInterpolation(proposedSeries3, delta3)
			await testInterpolation(proposedSeries4, delta4)
			await testInterpolation(proposedSeries5, delta5)
			await testInterpolation(proposedSeries6, delta6)
			await testInterpolation(proposedSeries7, delta7)
			await testInterpolation(proposedSeries8, delta8)
			await testInterpolation(proposedSeries9, delta9)
			await testInterpolation(proposedSeries10, delta10)
			await testInterpolation(proposedSeries11, delta11)
			await testInterpolation(proposedSeries12, delta12)
			await testInterpolation(proposedSeries13, delta13)
			await testInterpolation(proposedSeries14, delta14)
			await testInterpolation(proposedSeries15, delta15)
			await testInterpolation(proposedSeries16, delta16)
			await testInterpolation(proposedSeries17, delta17)
			await testInterpolation(proposedSeries18, delta18)
			await testInterpolation(proposedSeries19, delta19)
			await testInterpolation(proposedSeries20, delta20)
			await testInterpolation(proposedSeries21, delta21)
			await testInterpolation(proposedSeries22, delta22)
			await testInterpolation(proposedSeries23, delta23)
			await testInterpolation(proposedSeries24, delta24)
			await testInterpolation(proposedSeries25, delta25)
			await testInterpolation(proposedSeries26, delta26)
			await testInterpolation(proposedSeries27, delta27)
			await testInterpolation(proposedSeries28, delta28)
			await testInterpolation(proposedSeries29, delta29)
			await testInterpolation(proposedSeries30, delta10)
			await testInterpolation(proposedSeries31, delta31)
			await testInterpolation(proposedSeries32, delta32)
			await testInterpolation(proposedSeries33, delta33)
			await testInterpolation(proposedSeries34, delta34)
			await testInterpolation(proposedSeries35, delta35)
			await testInterpolation(proposedSeries36, delta36)
			await testInterpolation(proposedSeries37, delta37)
			await testInterpolation(proposedSeries38, delta38)
			await testInterpolation(proposedSeries39, delta39)
			await testInterpolation(proposedSeries40, delta40)
			await testInterpolation(proposedSeries41, delta41)
		})
	})
	describe("set flat IV params", async () => {
		it("set low delta threshold to 0.1", async () => {
			expect(await pricer.lowDeltaThreshold()).to.eq(toWei("0.05"))
			await exchange.pause()
			await pricer.setLowDeltaThreshold(toWei("0.1"))
			await exchange.unpause()
			expect(await pricer.lowDeltaThreshold()).to.eq(toWei("0.1"))
		})
		it("set risk free rate to 3%", async () => {
			expect(await pricer.riskFreeRate()).to.eq(toWei("0"))
			await exchange.pause()
			await pricer.setRiskFreeRate(toWei("0.03"))
			await exchange.unpause()
			expect(await pricer.riskFreeRate()).to.eq(toWei("0.03"))
		})
	})
})
