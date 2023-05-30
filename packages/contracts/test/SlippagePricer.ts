import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"
import { CALL_FLAVOR, PUT_FLAVOR, toUSDC, toWei } from "../utils/conversion-helper"
//@ts-ignore
import { expect } from "chai"
import {
	AlphaPortfolioValuesFeed,
	BeyondPricer,
	LiquidityPool,
	MintableERC20,
	MockChainlinkAggregator,
	OptionExchange,
	OptionRegistry,
	Oracle,
	PriceFeed,
	Protocol,
	VolatilityFeed,
	WETH
} from "../types"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { deployOpyn } from "../utils/opyn-deployer"
import { CHAINLINK_WETH_PRICER } from "./constants"
import { compareQuotes, setupTestOracle } from "./helpers"

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
let authority: string

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

// edit depending on the chain id to be tested on
const chainId = 1

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "100000"
const liquidityPoolWethDeposit = "1"

const expiration = dayjs.utc(expiryDate).add(8, "hours").unix()
const expiration2 = dayjs.utc(expiryDate).add(1, "weeks").add(8, "hours").unix() // have another batch of options exire 1 week after the first

describe("Slippage Pricer testing", async () => {
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
	describe("Get quotes successfully for small and big calls", async () => {
		let proposedSeries: any
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
		})
		it("SUCCEEDS: get quote for 1 option when selling", async () => {
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
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
		})
		it("SUCCEEDS: get quote for 1000 options when buying", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
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
			expect(singleBuyQuote).to.be.lt(quoteResponse[0].div(1000))
		})
		it("SUCCEEDS: get quote for 1000 options when selling", async () => {
			const feePerContract = await pricer.feePerContract()
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
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
		})
	})
	describe("Get quotes successfully for small and big puts", async () => {
		let proposedSeries: any
		let singleBuyQuote: BigNumber
		let singleSellQuote: BigNumber
		it("SUCCEEDS: get quote for 1 option when buying", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2400"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
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
		})
		it("SUCCEEDS: get quote for 1 option when selling", async () => {
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
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
		})
		it("SUCCEEDS: get quote for 1000 options when buying", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
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
			expect(singleBuyQuote).to.be.lt(quoteResponse[0].div(1000))
		})
		it("SUCCEEDS: get quote for 1000 options when selling", async () => {
			const amount = toWei("1000")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
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
		})
	})
	describe("Compare lots of small quotes to one big quote", async () => {
		let proposedSeries: any
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
					toWei("0").sub(toWei(i.toString()))
				)
				buyQuoteLots = buyQuoteLots.add(quoteResponse.totalPremium)
			}
		})
		it("SUCCEEDS: get quote for 1000 options when selling 100 times", async () => {
			sellQuoteLots = toWei("0")
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
					toWei(i.toString())
				)
				sellQuoteLots = sellQuoteLots.add(quoteResponse.totalPremium)
			}
		})
		it("SUCCEEDS: get quote for 100 options when buying 1 time", async () => {
			const amount = toWei("100")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
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
			expect(buyQuoteLots.sub(quoteResponse[0])).to.be.within(-100, 100)
		})
		it("SUCCEEDS: get quote for 100 options when selling 1 time", async () => {
			const amount = toWei("100")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
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
			expect(sellQuoteLots.sub(quoteResponse[0])).to.be.within(-100, 100)
		})
	})
	describe("Get quotes with no slippage if slippage gradient is zero", async () => {
		let proposedSeries: any
		it("SETUP: sets slippage to zero", async () => {
			await pricer.setSlippageGradient(0)
			expect(await pricer.slippageGradient()).to.equal(0)
		})
		it("SUCCEEDS: get quote for 1 option when buying", async () => {
			proposedSeries = {
				expiration: expiration,
				strike: toWei("2200"),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const amount = toWei("1")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			const singleBuyQuote = quoteResponse[0]
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
		})
	})
})
