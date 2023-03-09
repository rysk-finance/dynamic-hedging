import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Signer, utils } from "ethers"
import { AbiCoder } from "ethers/lib/utils"
import hre, { ethers, network } from "hardhat"
import {
	CALL_FLAVOR, emptySeries, fromOpyn, fromWei,
	percentDiff, PUT_FLAVOR, scaleNum, tFormatEth, tFormatUSDC, toOpyn, toUSDC, toWei, ZERO_ADDRESS
} from "../utils/conversion-helper"
//@ts-ignore
import { expect } from "chai"
import { AddressBook, AlphaOptionHandler, AlphaPortfolioValuesFeed, BeyondPricer, LiquidityPool, MintableERC20, MockChainlinkAggregator, NewController, NewMarginCalculator, NewWhitelist, OptionCatalogue, OptionExchange, OptionRegistry, Oracle, Otoken, OtokenFactory, PriceFeed, Protocol, UniswapV3HedgingReactor, VolatilityFeed, WETH } from "../types"

import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { deployOpyn } from "../utils/opyn-deployer"
import { ADDRESS_BOOK, CHAINLINK_WETH_PRICER, MARGIN_POOL, UNISWAP_V3_SWAP_ROUTER, USDC_ADDRESS, WETH_ADDRESS } from "./constants"
import { calculateOptionDeltaLocally, calculateOptionQuoteLocallyAlpha, compareQuotes, createAndMintOtoken, createFakeOtoken, getExchangeParams, getNetDhvExposure, getSeriesWithe18Strike, setOpynOracleExpiryPrice, setupOracle, setupTestOracle, whitelistProduct } from "./helpers"
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
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let newWhitelist: NewWhitelist
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let optionToken: Otoken
let oTokenUSDCXC: Otoken
let oTokenUSDCSXC: Otoken
let oTokenUSDCClose: Otoken
let oTokenETH1500C: Otoken
let oTokenETH1600C: Otoken
let oTokenUSDC1650C: Otoken
let oTokenUSDC1650NC: Otoken
let oTokenBUSD3000P: Otoken
let oTokenUSDCXCLaterExp2: Otoken
let spotHedgingReactor: UniswapV3HedgingReactor
let exchange: OptionExchange
let pricer: BeyondPricer
let authority: string
let catalogue: OptionCatalogue
let handler: AlphaOptionHandler

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = "20"

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "100000"
const liquidityPoolWethDeposit = "1"

// time travel period between each expiry
const productSpotShockValue = scaleNum("0.6", 27)
// array of time to expiry
const day = 60 * 60 * 24
const timeToExpiry = [day * 7, day * 14, day * 28, day * 42, day * 56, day * 84]
// array of upper bound value correspond to time to expiry
const expiryToValue = [
	scaleNum("0.1678", 27),
	scaleNum("0.237", 27),
	scaleNum("0.3326", 27),
	scaleNum("0.4032", 27),
	scaleNum("0.4603", 27),
	scaleNum("0.5", 27)
]

const expiration = dayjs.utc(expiryDate).add(8, "hours").unix()
const expiration2 = dayjs.utc(expiryDate).add(1, "weeks").add(8, "hours").unix()// have another batch of options exire 1 week after the first
const abiCode = new AbiCoder()

describe("Liquidity Pools hedging reactor: gamma", async () => {
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
			optionRegistry,
			portfolioValuesFeed,
			authority
		)
		liquidityPool = lpParams.liquidityPool
		exchange = lpParams.exchange
		catalogue = lpParams.catalogue
		handler = lpParams.handler
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
		it("deploys the spot hedging reactor", async () => {
			const uniswapV3HedgingReactorFactory = await ethers.getContractFactory(
				"UniswapV3HedgingReactor",
				{
					signer: signers[0]
				}
			)

			spotHedgingReactor = (await uniswapV3HedgingReactorFactory.deploy(
				UNISWAP_V3_SWAP_ROUTER[chainId],
				USDC_ADDRESS[chainId],
				WETH_ADDRESS[chainId],
				liquidityPool.address,
				3000,
				priceFeed.address,
				authority
			)) as UniswapV3HedgingReactor
			await spotHedgingReactor.setSlippage(100, 1000)
			expect(spotHedgingReactor).to.have.property("hedgeDelta")
			const minAmount = await spotHedgingReactor.minAmount()
			expect(minAmount).to.equal(ethers.utils.parseUnits("1", 16))
			const reactorAddress = spotHedgingReactor.address

			await liquidityPool.setHedgingReactorAddress(reactorAddress)

			await expect(await liquidityPool.hedgingReactors(0)).to.equal(reactorAddress)
		})
		it("SETUP: sets the exchange as a hedging reactor", async function () {
			await liquidityPool.setHedgingReactorAddress(exchange.address)
			expect(await liquidityPool.hedgingReactors(1)).to.equal(exchange.address)
		})
		it("SETUP: set the pool fee", async function () {
			await exchange.setPoolFee(weth.address, 500)
			expect(await exchange.poolFees(weth.address)).to.equal(500)
		})
		it("can compute portfolio delta", async function () {
			const delta = await liquidityPool.getPortfolioDelta()
			expect(delta).to.equal(0)
		})
	})
	describe("Purchase and sell back an option", async () => {
		it("SETUP: approve series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			await catalogue.issueNewSeries([
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: BigNumber.from(strikePrice),
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
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: toWei("1750"),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: toWei("1650"),
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
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
			const tx = await exchange.operate([
				{
					operation: 1,
					operationQueue: [{
						actionType: 0,
						owner: ZERO_ADDRESS,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: 0,
						optionSeries: proposedSeries,
						index: 0,
						data: "0x"
					}, {
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						index: quote,
						data: "0x"
					}]
				}])
			const logs = await exchange.queryFilter(exchange.filters.OptionsIssued(), 0)
			const issueEvent = logs[0].args
			const logs2 = await exchange.queryFilter(exchange.filters.OptionsBought(), 0)
			const buyEvent = logs2[0].args
			const seriesAddress = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
			expect(issueEvent.series).to.equal(seriesAddress)
			expect(buyEvent.series).to.equal(seriesAddress)
			expect(buyEvent.buyer).to.equal(senderAddress)
			expect(buyEvent.optionAmount).to.equal(amount)
			oTokenUSDCXC = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDCXC
			quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
		it("REVERTS: LP Writes a ETH/USD call fails because unapproved series", async () => {
			const amount = toWei("5")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei("1"))
			const proposedSeries = {
				expiration: expiration,
				strike: BigNumber.from(strikePrice),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			await exchange.createOtoken(proposedSeries)
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, utils.parseEther("-5"))
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, utils.parseEther("-5"))
			let quote = quoteResponse[0].add(quoteResponse[2])
			await usd.approve(exchange.address, quote)
			await expect(exchange.operate([
				{
					operation: 1,
					operationQueue: [{
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						index: quote,
						data: "0x"
					}]
				}])).to.be.revertedWithCustomError(exchange, "UnapprovedSeries")

		})
		it("REVERTS: buys the options from the exchange on a series where premium passes slippage limit", async () => {
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
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, amount)
			let quote = quoteResponse[0].add(quoteResponse[2])
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: quote.sub(1e6),
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "TooMuchSlippage")
		})
		it("REVERTS: sells the options to the exchange on a series where premium passes slippage limit", async () => {
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
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, amount)
			let quote = quoteResponse[0]
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: quote.add(1e6),
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "TooMuchSlippage")
		})
		it("SETUP: set maxMetDhvExposure", async () => {
			await portfolioValuesFeed.setMaxNetDhvExposure(toWei("3"))
			expect(await portfolioValuesFeed.maxNetDhvExposure()).to.equal(toWei("3"))
		})
		it("REVERTS: LP Writes a ETH/USD call fails because above netDhvExposure", async () => {
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
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, utils.parseEther("-5"))
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, utils.parseEther("-5"))
			let quote = quoteResponse[0].add(quoteResponse[2])
			await usd.approve(exchange.address, quote)
			await expect(exchange.operate([
				{
					operation: 1,
					operationQueue: [{
						actionType: 0,
						owner: ZERO_ADDRESS,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: 0,
						optionSeries: proposedSeries,
						index: 0,
						data: "0x"
					}, {
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						index: quote,
						data: "0x"
					}]
				}])).to.be.revertedWithCustomError(portfolioValuesFeed, "MaxNetDhvExposureExceeded")

		})
		it("REVERTS: sells the options to the exchange and go below net dhv exposure", async () => {
			const amount = toWei("1")
			await optionToken.approve(exchange.address, amount)
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(portfolioValuesFeed, "MaxNetDhvExposureExceeded")
		})
		it("SETUP: set maxMetDhvExposure", async () => {
			await portfolioValuesFeed.setMaxNetDhvExposure(toWei("50000"))
			expect(await portfolioValuesFeed.maxNetDhvExposure()).to.equal(toWei("50000"))
		})
		let customOrderPrice: any
		let oToken: Otoken
		it("SETUP: Creates a buy order", async () => {
			let customOrderPriceMultiplier = 1
			const [sender, receiver] = signers
			const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
			const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const amount = toWei("10")
			const orderExpiry = 10
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
			const localQuote = await calculateOptionQuoteLocallyAlpha(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				proposedSeries,
				amount
			)
			customOrderPrice = localQuote * customOrderPriceMultiplier
			const createOrder = await handler.createOrder(
				proposedSeries,
				amount,
				toWei(customOrderPrice.toString()).mul(toWei("1")).div(amount),
				orderExpiry,
				senderAddress,
				false,
				[toWei("1"), toWei("1")]
			)
			const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
			const lpUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
			const receipt = await createOrder.wait()
			const events = receipt.events
			const createOrderEvents = events?.find(x => x.event == "OrderCreated")
			const customOrderId = createOrderEvents?.args?.orderId
			const order = await handler.orderStores(customOrderId)
			// check saved order details are correct
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
			expect(order.buyer).to.eq(senderAddress)
			expect(order.upperSpotMovementRange.sub(toWei("1"))).to.equal(priceQuote)
			expect(order.lowerSpotMovementRange.add(toWei("1"))).to.equal(priceQuote)
			expect(order.isBuyBack).to.be.false
			const seriesInfo = await optionRegistry.getSeriesInfo(order.seriesAddress)
			// check series info for OToken is correct
			expect(order.optionSeries.expiration).to.eq(seriesInfo.expiration.toString())
			expect(order.optionSeries.isPut).to.eq(seriesInfo.isPut)
			expect(order.optionSeries.strike).to.eq(seriesInfo.strike)
			expect(await handler.orderIdCounter()).to.eq(1)
			oToken = await ethers.getContractAt("Otoken", order.seriesAddress) as Otoken
			expect(collateralAllocatedBefore).to.eq(collateralAllocatedAfter)
			expect(lpUSDBalanceBefore).to.eq(lpUSDBalanceAfter)
		})
		it("SETUP: Executes a buy order", async () => {
			const [sender, receiver] = signers
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
			const buyerBalBefore = await usd.balanceOf(senderAddress)
			const senderBalBefore = await usd.balanceOf(senderAddress)
			const senderOTokenBalBefore = await oToken.balanceOf(senderAddress)
			const orderDeets = await handler.orderStores(1)
			const prevalues = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			const ephemeralDeltaBefore = await liquidityPool.ephemeralDelta()
			const ephemeralLiabilitiesBefore = await liquidityPool.ephemeralLiabilities()
			const netDhvExposureBefore = await getNetDhvExposure(orderDeets.optionSeries.strike.mul(utils.parseUnits("1", 10)), orderDeets.optionSeries.collateral, catalogue, portfolioValuesFeed, orderDeets.optionSeries.expiration, orderDeets.optionSeries.isPut)
			expect(netDhvExposureBefore).to.equal(toWei("0").sub(toWei("5")))
			const expectedCollateralAllocated = await optionRegistry.getCollateral(
				{
					expiration: orderDeets.optionSeries.expiration,
					isPut: orderDeets.optionSeries.isPut,
					strike: orderDeets.optionSeries.strike, // keep e8
					strikeAsset: orderDeets.optionSeries.strikeAsset,
					underlying: orderDeets.optionSeries.underlying,
					collateral: orderDeets.optionSeries.collateral
				},
				orderDeets.amount
			)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				{
					expiration: orderDeets.optionSeries.expiration.toNumber(),
					strike: orderDeets.optionSeries.strike.mul(10 ** 10), // format to e18
					isPut: orderDeets.optionSeries.isPut,
					underlying: orderDeets.optionSeries.underlying,
					strikeAsset: orderDeets.optionSeries.strikeAsset,
					collateral: orderDeets.optionSeries.collateral
				},
				orderDeets.amount,
				true
			)
			const deltaBefore = tFormatEth(await liquidityPool.getPortfolioDelta())
			const localQuote = await calculateOptionQuoteLocallyAlpha(
				liquidityPool,
				optionRegistry,
				usd,
				priceFeed,
				{
					expiration: orderDeets.optionSeries.expiration.toNumber(),
					strike: orderDeets.optionSeries.strike.mul(10 ** 10), // format to e18
					isPut: orderDeets.optionSeries.isPut,
					underlying: orderDeets.optionSeries.underlying,
					strikeAsset: orderDeets.optionSeries.strikeAsset,
					collateral: orderDeets.optionSeries.collateral
				},
				orderDeets.amount,
				false
			)
			await usd.approve(handler.address, 100000000000)
			await oToken.approve(handler.address, toOpyn(fromWei(orderDeets.amount)))
			await handler.executeOrder(1)
			// check ephemeral values update correctly
			const ephemeralLiabilitiesDiff =
				tFormatEth(await liquidityPool.ephemeralLiabilities()) - tFormatEth(ephemeralLiabilitiesBefore)
			// const ephemeralDeltaDiff =
			// 	tFormatEth(await liquidityPool.ephemeralDelta()) - tFormatEth(ephemeralDeltaBefore)
			// expect(ephemeralDeltaDiff - tFormatEth(localDelta)).to.be.within(-0.01, 0.01)
			expect(percentDiff(ephemeralLiabilitiesDiff, localQuote)).to.be.within(-0.1, 0.1)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const deltaAfter = tFormatEth(await liquidityPool.getPortfolioDelta())

			// expect ephemeral values to be reset
			expect(await liquidityPool.ephemeralDelta()).to.eq(0)
			expect(await liquidityPool.ephemeralLiabilities()).to.eq(0)
			const senderOTokenBalAfter = await oToken.balanceOf(senderAddress)
			const lpUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
			const lpOTokenBalAfter = await oToken.balanceOf(liquidityPool.address)
			const buyerBalAfter = await usd.balanceOf(senderAddress)
			const senderBalAfter = await usd.balanceOf(senderAddress)
			const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
			const netDhvExposureAfter = await getNetDhvExposure(orderDeets.optionSeries.strike.mul(utils.parseUnits("1", 10)), orderDeets.optionSeries.collateral, catalogue, portfolioValuesFeed, orderDeets.optionSeries.expiration, orderDeets.optionSeries.isPut)
			const collateralAllocatedDiff = tFormatUSDC(
				collateralAllocatedAfter.sub(collateralAllocatedBefore)
			)
			const buyerUSDBalanceDiff = buyerBalBefore.sub(buyerBalAfter)
			const lpUSDBalanceDiff = lpUSDBalanceAfter.sub(lpUSDBalanceBefore)

			const order = await handler.orderStores(0)
			// order should be non existant
			expect(order.buyer).to.eq(ZERO_ADDRESS)
			// check buyer's OToken balance increases by correct amount
			expect(fromOpyn(senderOTokenBalAfter.sub(senderOTokenBalBefore).toString())).to.eq(
				fromWei(orderDeets.amount.toString())
			)
			// liquidity pool holds no tokens
			expect(lpOTokenBalAfter).to.eq(0)
			expect(
				tFormatUSDC(buyerUSDBalanceDiff) -
				parseFloat(fromWei(orderDeets.amount)) * tFormatEth(orderDeets.price)
			).to.be.within(-0.01, 0.01)
			// check collateralAllocated is correct
			expect(collateralAllocatedDiff).to.eq(tFormatUSDC(expectedCollateralAllocated))
			// check buyer's USD balance decreases by correct amount
			expect(
				senderBalBefore
					.sub(senderBalAfter)
					.sub(BigNumber.from(Math.floor(customOrderPrice * 10 ** 6).toString()))
			).to.be.within(-1, 1)
			// check liquidity pool USD balance increases by agreed price minus collateral
			expect(
				tFormatUSDC(lpUSDBalanceDiff) -
				(tFormatEth(orderDeets.amount) * tFormatEth(orderDeets.price) -
					tFormatUSDC(expectedCollateralAllocated))
			).to.be.within(-0.015, 0.015)
			// check delta changes by expected amount
			expect(deltaAfter.toPrecision(2)).to.eq((deltaBefore + tFormatEth(localDelta)).toPrecision(2))
			expect(await portfolioValuesFeed.addressSetLength()).to.equal(1)
			expect(netDhvExposureBefore.sub(netDhvExposureAfter)).to.equal(orderDeets.amount)
		})
		it("SETUP: change option buy or sell on series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
				ethers.utils.parseUnits("1", 10)
			)
			const tx = await catalogue.changeOptionBuyOrSell([
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: formattedStrikePrice,
					isSellable: false,
					isBuyable: false
				}
			])
		})
		it("REVERTS: sells the options to the exchange on a series where amount is too small", async () => {
			const amount = toWei("0.009")
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "TradeTooSmall")
		})
		it("REVERTS: buys the options from the exchange on a series where amount is too small", async () => {
			const amount = toWei("0.009")
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: amount,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "TradeTooSmall")
		})
		it("REVERTS: sells the options to the exchange on a series where amount is too large", async () => {
			const amount = toWei("1000.001")
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "TradeTooLarge")
		})
		it("REVERTS: buys the options from the exchange on a series where amount is too large", async () => {
			const amount = toWei("1000.001")
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: amount,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "TradeTooLarge")
		})
		it("REVERTS: sells the options to the exchange on a series not approved for selling", async () => {
			const amount = toWei("4")
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
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
			const strikePrice = priceQuote.add(toWei(strike))
			const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
				ethers.utils.parseUnits("1", 10)
			)
			const tx = await catalogue.changeOptionBuyOrSell([
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: formattedStrikePrice,
					isSellable: true,
					isBuyable: false
				}
			])
		})
		it("SUCCEEDS: sells the options to the exchange", async () => {
			const amount = toWei("4")
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
			await optionToken.approve(exchange.address, amount)
			const tx = await exchange.operate([
				{
					operation: 1,
					operationQueue: [{
						actionType: 2,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: optionToken.address,
						vaultId: 0,
						amount: amount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])
			const logs = await exchange.queryFilter(exchange.filters.OptionsSold(), 0)
			const soldEvent = logs[0].args
			expect(soldEvent.series).to.equal(optionToken.address)
			expect(soldEvent.optionAmount).to.equal(amount)
			expect(soldEvent.seller).to.equal(senderAddress)
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
			const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address)).optionSeries
			let quoteResponse = (await pricer.quoteOptionPrice(proposedSeries, amount, true, before.netDhvExposure))
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			let quote = quoteResponse[0].sub(quoteResponse[2])
			expect(before.senderOtokenBalance.sub(after.senderOtokenBalance)).to.eq(after.opynAmount)
			expect(after.senderUSDBalance.sub(before.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.sub(quote)
					.sub(after.collateralAllocated.sub(before.collateralAllocated))
			).to.be.within(-10, 10)
			expect(after.exchangeOTokenBalance).to.equal(0)
			expect(after.pfList.length - before.pfList.length).to.equal(0)
			expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
			expect(after.seriesStores.longExposure).to.equal(before.seriesStores.longExposure)
			expect(before.seriesStores.shortExposure.sub(after.seriesStores.shortExposure)).to.equal(amount)
			expect(after.netDhvExposure.sub(before.netDhvExposure)).to.equal(amount)
		})
		it("REVERTS: tries to write an otoken that is not approved", async () => {
			const amount = toWei("2")
			const proposedSeries = {
				expiration: expiration,
				strike: toWei("1000"),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			await usd.approve(exchange.address, amount)
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
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
			).to.be.revertedWithCustomError(exchange, "NonExistentOtoken")
		})
		it("REVERTS: buy the option positions fails because not approved", async () => {
			const amount = toWei("2")
			await usd.approve(exchange.address, amount)
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "SeriesNotBuyable")
		})
		it("SETUP: change option buy or sell on series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(
				ethers.utils.parseUnits("1", 10)
			)
			const tx = await catalogue.changeOptionBuyOrSell([
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: formattedStrikePrice,
					isSellable: true,
					isBuyable: true
				}
			])
		})
		it("SUCCEEDS: buys option positions", async () => {
			const amount = toWei("2")
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
			await usd.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: optionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: emptySeries,
							index: amount,
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
				optionToken,
				senderAddress,
				amount
			)
			const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address))
				.optionSeries
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			let quote = quoteResponse[0].add(quoteResponse[2])
			expect(after.senderOtokenBalance.sub(before.senderOtokenBalance)).to.eq(after.opynAmount)
			expect(before.senderUSDBalance.sub(after.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
			expect(
				after.poolUSDBalance
					.sub(before.poolUSDBalance)
					.sub(quote)
					.sub(before.collateralAllocated.sub(after.collateralAllocated))
			).to.be.within(-10, 10)
			expect(after.exchangeOTokenBalance).to.equal(0)
			expect(after.pfList.length - before.pfList.length).to.equal(0)
			expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
			expect(after.seriesStores.longExposure).to.equal(before.seriesStores.longExposure)
			expect(after.seriesStores.shortExposure.sub(before.seriesStores.shortExposure)).to.equal(amount)
			expect(before.netDhvExposure.sub(after.netDhvExposure)).to.equal(amount)
		})
		it("SUCCEEDS: Sender sets exchange as an operator", async () => {
			await controller.setOperator(exchange.address, true)
			expect(await controller.isOperator(senderAddress, exchange.address))
		})
		it("SUCCEEDS: LP Sells a ETH/USD call for premium with otoken created outside", async () => {
			const amount = toWei("5")
			const strikePrice = toWei("1750")
			const proposedSeries = {
				expiration: expiration,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
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
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
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
			oTokenUSDCSXC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			optionToken = oTokenUSDCSXC
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
				expiration: expiration,
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
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
							index: quote,
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
		it("SUCCEEDS: Check action series address to see that series address is prioritised over optionSeries", async () => {
			const amount = toWei("2")
			const strikePrice = toWei("1650")
			const proposedSeries = {
				expiration: expiration,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikeP = priceQuote.add(toWei(strike))
			const actualProposedSeries = {
				expiration: expiration,
				strike: BigNumber.from(strikeP),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const structBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				optionToken,
				senderAddress,
				amount
			)
			const seriesBefore = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				oTokenUSDCXC,
				senderAddress,
				amount
			)
			let quoteResponse = await pricer.quoteOptionPrice(actualProposedSeries, amount, false, seriesBefore.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, actualProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, seriesBefore.netDhvExposure)
			let quote = quoteResponse[0].add(quoteResponse[2])
			await usd.approve(exchange.address, quote)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: oTokenUSDCXC.address,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries,
							index: quote,
							data: "0x"
						}
					]
				}
			])
			quoteResponse = await pricer.quoteOptionPrice(actualProposedSeries, amount, false, seriesBefore.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, actualProposedSeries, amount, false, exchange, optionRegistry, usd, pricer, seriesBefore.netDhvExposure)
			quote = quoteResponse[0].add(quoteResponse[2])
			const structAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				optionToken,
				senderAddress,
				amount
			)
			const seriesAfter = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				oTokenUSDCXC,
				senderAddress,
				amount
			)
			expect(structAfter.senderOtokenBalance).to.eq(structBefore.senderOtokenBalance)
			expect(structAfter.exchangeOTokenBalance).to.eq(structBefore.exchangeOTokenBalance)
			expect(seriesAfter.senderOtokenBalance.sub(seriesBefore.senderOtokenBalance)).to.eq(
				seriesAfter.opynAmount
			)
			expect(seriesAfter.exchangeOTokenBalance.sub(seriesBefore.exchangeOTokenBalance)).to.eq(0)
			expect(seriesBefore.senderUSDBalance.sub(seriesAfter.senderUSDBalance).sub(quote)).to.be.within(
				-10,
				10
			)
			expect(
				seriesBefore.poolUSDBalance
					.sub(seriesAfter.poolUSDBalance)
					.add(quote)
					.add(seriesBefore.collateralAllocated.sub(seriesAfter.collateralAllocated))
			).to.be.within(-10, 10)
			expect(structAfter.pfList.length - structBefore.pfList.length).to.equal(0)
			expect(structAfter.seriesStores.longExposure).to.equal(structBefore.seriesStores.longExposure)
			expect(structAfter.seriesStores.shortExposure).to.equal(structBefore.seriesStores.shortExposure)
			expect(
				seriesAfter.seriesStores.longExposure.sub(seriesBefore.seriesStores.longExposure)
			).to.equal(0)
			expect(
				seriesAfter.seriesStores.shortExposure.sub(seriesBefore.seriesStores.shortExposure)
			).to.equal(amount)
			expect(structBefore.netDhvExposure.sub(structAfter.netDhvExposure)).to.equal(0)
			expect(seriesBefore.netDhvExposure.sub(seriesAfter.netDhvExposure)).to.equal(amount)
		})
		it("REVERTS: LP Sells a ETH/USD call using temp holdings and doesnt sell enough", async () => {
			const amount = toWei("10")
			const strikePrice = toWei("1650")
			const proposedSeries = {
				expiration: expiration,
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
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			/// ADD OPERATOR TODO
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
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
								amount: amount.div(2),
								optionSeries: proposedSeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "TokenImbalance")
		})
		it("REVERTS: LP Sells a ETH/USD call using temp holdings and sells too much", async () => {
			const amount = toWei("10")
			const strikePrice = toWei("1650")
			const proposedSeries = {
				expiration: expiration,
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
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			/// ADD OPERATOR TODO
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
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
								amount: amount.mul(2),
								optionSeries: proposedSeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWith("ERC20: transfer amount exceeds balance")
		})
		it("SUCCEEDS: LP Sells a ETH/USD call for premium creating otoken in tx", async () => {
			const amount = toWei("10")
			const strikePrice = toWei("1650")
			const proposedSeries = {
				expiration: expiration,
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
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			/// ADD OPERATOR TODO
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)

			await exchange.createOtoken(proposedSeries)
			oTokenUSDC1650NC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			const before = await getExchangeParams(
				liquidityPool,
				exchange,
				usd,
				wethERC20,
				portfolioValuesFeed,
				oTokenUSDC1650NC,
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
							amount: amount.div(2),
							optionSeries: proposedSeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount.div(2),
							optionSeries: proposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
			optionToken = oTokenUSDC1650NC
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
			const quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			const quote = quoteResponse[0].sub(quoteResponse[2])
			expect(after.exchangeOTokenBalance.sub(before.exchangeOTokenBalance)).to.eq(
				after.opynAmount.div(2)
			)
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
			expect(after.seriesStores.longExposure).to.equal(amount.div(2))
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

	describe("Purchase and sell back an ETH option", async () => {
		let strikePrice: BigNumber
		let proposedSeries: OptionSeriesStruct
		it("SETUP: mints an otoken", async () => {
			strikePrice = toWei("1500")
			proposedSeries = {
				expiration: expiration,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: weth.address
			}
			const amount = toWei("5")
			const otoken = await createAndMintOtoken(
				addressBook,
				proposedSeries,
				usd,
				weth,
				weth,
				amount,
				signers[0],
				optionRegistry,
				"1"
			)
			oTokenETH1500C = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			expect(await oTokenETH1500C.balanceOf(senderAddress)).to.equal(
				amount.div(ethers.utils.parseUnits("1", 10))
			)
			optionToken = oTokenETH1500C
		})
		it("SETUP: approve series", async () => {
			await catalogue.issueNewSeries([
				{
					expiration: proposedSeries.expiration,
					isPut: proposedSeries.isPut,
					strike: proposedSeries.strike,
					isSellable: true,
					isBuyable: true
				}
			])
		})
		it("REVERT: approve series fails if expiration is not at 8am", async () => {
			await expect(catalogue.issueNewSeries([
				{
					expiration: proposedSeries.expiration + 1,
					isPut: proposedSeries.isPut,
					strike: proposedSeries.strike,
					isSellable: true,
					isBuyable: true
				}
			])).to.be.revertedWithCustomError(catalogue, "InvalidExpiry")
		})
		it("REVERTS: cant write eth options to the liquidity pool", async () => {
			const amount = toWei("4")
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			let quote = quoteResponse[0].add(quoteResponse[2])
			await usd.approve(exchange.address, quote.add(100))
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: ZERO_ADDRESS,
								vaultId: 0,
								amount: amount,
								optionSeries: proposedSeries,
								index: quote,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "CollateralAssetInvalid")
		})
		it("SETUP: change option buy or sell on series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const tx = await catalogue.changeOptionBuyOrSell([
				{
					expiration: proposedSeries.expiration,
					isPut: proposedSeries.isPut,
					strike: proposedSeries.strike,
					isSellable: false,
					isBuyable: false
				}
			])
		})
		it("REVERTS: sells the options to the exhange on a series not approved for selling", async () => {
			const amount = toWei("4")
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
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
			const strikePrice = priceQuote.add(toWei(strike))
			const tx = await catalogue.changeOptionBuyOrSell([
				{
					expiration: proposedSeries.expiration,
					isPut: proposedSeries.isPut,
					strike: proposedSeries.strike,
					isSellable: true,
					isBuyable: false
				}
			])
		})
		it("SUCCEEDS: sells the options to the exchange", async () => {
			const amount = toWei("4")
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
			await optionToken.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: optionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
			const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address))
				.optionSeries
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			let quote = quoteResponse[0].sub(quoteResponse[2])
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
			expect(before.senderOtokenBalance.sub(after.senderOtokenBalance)).to.eq(after.opynAmount)
			expect(after.senderUSDBalance.sub(before.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
			expect(
				after.poolUSDBalance
					.sub(before.poolUSDBalance)
					.add(quote)
					.sub(after.collateralAllocated.sub(before.collateralAllocated))
			).to.be.within(-10, 10)
			expect(after.exchangeOTokenBalance.sub(before.exchangeOTokenBalance)).to.equal(after.opynAmount)
			expect(after.pfList.length - before.pfList.length).to.equal(1)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.sub(after.senderUSDBalance.sub(before.senderUSDBalance))
			).to.be.within(-10, 10)
			expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
			expect(after.seriesStores.longExposure.sub(before.seriesStores.longExposure)).to.equal(amount)
			expect(before.seriesStores.shortExposure).to.equal(after.seriesStores.shortExposure)
			expect(after.netDhvExposure.sub(before.netDhvExposure)).to.equal(amount)
		})
		it("REVERTS: closes the option positions fails because not approved", async () => {
			const amount = toWei("2")
			await usd.approve(exchange.address, amount)
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "SeriesNotBuyable")
		})
		it("SETUP: change option buy or sell on series", async () => {
			const tx = await catalogue.changeOptionBuyOrSell([
				{
					expiration: proposedSeries.expiration,
					isPut: proposedSeries.isPut,
					strike: proposedSeries.strike,
					isSellable: true,
					isBuyable: true
				}
			])
		})
		it("SUCCEEDS: closes the option positions", async () => {
			const amount = toWei("2")
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
			await usd.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: optionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: emptySeries,
							index: amount,
							data: "0x"
						}
					]
				}
			])
			const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address))
				.optionSeries
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			let quote = quoteResponse[0].add(quoteResponse[2])
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
			expect(after.senderOtokenBalance.sub(before.senderOtokenBalance)).to.eq(after.opynAmount)
			expect(before.senderUSDBalance.sub(after.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
			expect(
				after.poolUSDBalance
					.sub(before.poolUSDBalance)
					.sub(quote)
					.sub(before.collateralAllocated.sub(after.collateralAllocated))
			).to.be.within(-10, 10)
			expect(before.exchangeOTokenBalance.sub(after.exchangeOTokenBalance)).to.equal(after.opynAmount)
			expect(after.pfList.length - before.pfList.length).to.equal(0)
			expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
			expect(before.seriesStores.longExposure.sub(after.seriesStores.longExposure)).to.equal(amount)
			expect(after.seriesStores.shortExposure.sub(before.seriesStores.shortExposure)).to.equal(0)
			expect(before.netDhvExposure.sub(after.netDhvExposure)).to.equal(amount)
		})
	})
	describe("LP writes more options", async () => {
		let localDelta: any
		it("LP writes another ETH/USD call that expires later", async () => {
			const amount = toWei("8")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: expiration2,
				strike: BigNumber.from(strikePrice),
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
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
							index: quote,
							data: "0x"
						}
					]
				}
			])
			const seriesAddress = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
			quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
			quote = quoteResponse[0].add(quoteResponse[2])
			localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("3"),
				true
			)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			oTokenUSDCXCLaterExp2 = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDCXCLaterExp2
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
		it("SETUP: sets fee to 0", async () => {
			await pricer.setFeePerContract(0)
			expect(await pricer.feePerContract()).to.equal(0)
		})
		it("LP writes another ETH/USD call that expires later with fee at 0", async () => {
			const amount = toWei("2")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: expiration2,
				strike: BigNumber.from(strikePrice),
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
				optionToken,
				senderAddress,
				amount
			)
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
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
							index: quote,
							data: "0x"
						}
					]
				}
			])
			const seriesAddress = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
			quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			quote = quoteResponse[0].add(quoteResponse[2])
			localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("3"),
				true
			)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
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
			expect(after.seriesStores.shortExposure.sub(before.seriesStores.shortExposure)).to.equal(amount)
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
			expect(before.netDhvExposure.sub(after.netDhvExposure)).to.equal(amount)
		})
		it("SETUP: sets fee back to 3e5", async () => {
			await pricer.setFeePerContract(toUSDC("0.3"))
			expect(await pricer.feePerContract()).to.equal(toUSDC("0.3"))
		})
		it("SUCCEEDS: LP Sells a ETH/USD call with a mix of temp holdings and wallet holdings", async () => {
			const amount = toWei("10")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: expiration2,
				strike: BigNumber.from(strikePrice),
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
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			await optionToken.approve(exchange.address, toOpyn("1"))
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
							asset: optionToken.address,
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
							amount: amount.add(toWei("1")),
							optionSeries: proposedSeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
			let quoteResponse = await pricer.quoteOptionPrice(
				proposedSeries,
				amount.add(toWei("1")),
				true,
				before.netDhvExposure
			)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount.add(toWei("1")), true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			let quote = quoteResponse[0].sub(quoteResponse[2])
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
			expect(after.exchangeOTokenBalance.sub(before.exchangeOTokenBalance)).to.eq(toOpyn("1"))
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
			expect(after.seriesStores.longExposure).to.equal(toWei("1"))
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
			expect(after.netDhvExposure.sub(before.netDhvExposure)).to.equal(amount.add(toWei("1")))
		})
		it("REVERTS: LP tries to write an ETH/USD call that is not from the correct otoken factory", async () => {
			const amount = toWei("3")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: expiration2,
				strike: toOpyn(fromWei(strikePrice)),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const fakeOtoken = await createFakeOtoken(senderAddress, proposedSeries, addressBook)
			let quoteResponse = await pricer.quoteOptionPrice({
				expiration: expiration2,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, {
				expiration: expiration2,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: fakeOtoken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: proposedSeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "NonWhitelistedOtoken")
		})
		it("REVERTS: LP tries to write an ETH/USD call that is not a valid otoken", async () => {
			const amount = toWei("3")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: 0,
				strike: toOpyn(fromWei(strikePrice)),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const fakeOtoken = await createFakeOtoken(senderAddress, proposedSeries, addressBook)
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
			await usd.approve(exchange.address, toWei("1000"))
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: fakeOtoken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: proposedSeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "NonExistentOtoken")
			await usd.approve(exchange.address, 0)
		})
	})
	describe("Write positions and close them", async () => {
		it("SETUP: approve series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			await catalogue.issueNewSeries([
				{
					expiration: expiration,
					isPut: PUT_FLAVOR,
					strike: toWei("1500"),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: PUT_FLAVOR,
					strike: toWei("2500"),
					isSellable: true,
					isBuyable: true
				}
			])
		})
		it("SUCCEED: LP Writes a ETH/USD put for premium", async () => {
			const amount = toWei("5")
			const proposedSeries = {
				expiration: expiration,
				strike: toWei("1500"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
							index: quote,
							data: "0x"
						}
					]
				}
			])
			const seriesAddress = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
			oTokenUSDCClose = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDCClose
			quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
		it("SUCCEEDS: LP Sells a ETH/USD call with a mix of temp holdings and wallet holdings", async () => {
			const amount = toWei("10")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: expiration2,
				strike: BigNumber.from(strikePrice),
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
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			await optionToken.approve(exchange.address, toOpyn("1"))
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
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
								asset: optionToken.address,
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
								actionType: 3,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: ZERO_ADDRESS,
								vaultId: 0,
								amount: amount.add(toWei("1")),
								optionSeries: proposedSeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "NothingToClose")
		})
		it("REVERTS: closes the options on the exchange when size to close is too large", async () => {
			const amount = toWei("10")
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
			await optionToken.approve(exchange.address, amount)
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 3,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "CloseSizeTooLarge")
		})
		it("SUCCEEDS: closes the options on the exchange", async () => {
			const amount = toWei("4")
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
			await optionToken.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 3,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: optionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
			const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address))
				.optionSeries
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			// do not subtract the fee as we expect it to be waived
			let quote = quoteResponse[0]
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
			expect(before.senderOtokenBalance.sub(after.senderOtokenBalance)).to.eq(after.opynAmount)
			expect(after.senderUSDBalance.sub(before.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
			expect(
				after.poolUSDBalance
					.sub(before.poolUSDBalance)
					.add(quote)
					.sub(before.collateralAllocated.sub(after.collateralAllocated))
			).to.be.within(-10, 10)
			expect(after.exchangeOTokenBalance.sub(before.exchangeOTokenBalance)).to.equal(0)
			expect(after.pfList.length - before.pfList.length).to.equal(0)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.sub(
						after.senderUSDBalance
							.sub(before.senderUSDBalance)
							.sub(before.collateralAllocated.sub(after.collateralAllocated))
					)
			).to.be.within(-10, 10)
			expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
			expect(after.seriesStores.longExposure.sub(before.seriesStores.longExposure)).to.equal(0)
			expect(before.seriesStores.shortExposure.sub(after.seriesStores.shortExposure)).to.equal(amount)
			expect(after.netDhvExposure.sub(before.netDhvExposure)).to.equal(amount)
		})
		it("SUCCEED: LP Writes a ETH/USD put for premium", async () => {
			const amount = toWei("5")
			const proposedSeries = {
				expiration: expiration,
				strike: toWei("2500"),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
							index: quote,
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
			oTokenUSDCClose = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDCClose
			quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, toWei("0"))
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
		it("SUCCEEDS: closes the options on the exchange", async () => {
			const amount = toWei("4")
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
			await optionToken.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 3,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: optionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
			const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address))
				.optionSeries
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, before.netDhvExposure)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
			let quote = quoteResponse[0].sub(quoteResponse[2])
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
			expect(before.senderOtokenBalance.sub(after.senderOtokenBalance)).to.eq(after.opynAmount)
			expect(after.senderUSDBalance.sub(before.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
			expect(
				after.poolUSDBalance
					.sub(before.poolUSDBalance)
					.add(quote)
					.sub(before.collateralAllocated.sub(after.collateralAllocated))
			).to.be.within(-10, 10)
			expect(after.exchangeOTokenBalance.sub(before.exchangeOTokenBalance)).to.equal(0)
			expect(after.pfList.length - before.pfList.length).to.equal(0)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.sub(
						after.senderUSDBalance
							.sub(before.senderUSDBalance)
							.sub(before.collateralAllocated.sub(after.collateralAllocated))
					)
			).to.be.within(-10, 10)
			expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
			expect(after.seriesStores.longExposure.sub(before.seriesStores.longExposure)).to.equal(0)
			expect(before.seriesStores.shortExposure.sub(after.seriesStores.shortExposure)).to.equal(amount)
			expect(after.netDhvExposure.sub(before.netDhvExposure)).to.equal(amount)
		})
	})
	describe("Purchase and sell back an ETH option", async () => {
		let strikePrice: BigNumber
		let proposedSeries: OptionSeriesStruct
		it("SETUP: mints an otoken", async () => {
			strikePrice = toWei("1600")
			proposedSeries = {
				expiration: expiration,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: weth.address
			}
			const amount = toWei("5")
			const otoken = await createAndMintOtoken(
				addressBook,
				proposedSeries,
				usd,
				weth,
				weth,
				amount,
				signers[0],
				optionRegistry,
				"1"
			)
			oTokenETH1600C = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			expect(await oTokenETH1600C.balanceOf(senderAddress)).to.equal(
				amount.div(ethers.utils.parseUnits("1", 10))
			)
			optionToken = oTokenETH1600C
		})
		it("SETUP: approve series", async () => {
			await catalogue.issueNewSeries([
				{
					expiration: proposedSeries.expiration,
					isPut: proposedSeries.isPut,
					strike: proposedSeries.strike,
					isSellable: true,
					isBuyable: true
				}
			])
		})
		it("REVERTS: buys the option positions fails because no balance", async () => {
			const amount = toWei("2")
			await usd.approve(exchange.address, amount)
			await expect(
				exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: amount,
								data: "0x"
							}
						]
					}
				])
			).to.be.revertedWithCustomError(exchange, "CollateralAssetInvalid")
		})
		it("SUCCEEDS: sells the options to the exchange", async () => {
			const amount = toWei("4")
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
			await optionToken.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: optionToken.address,
							vaultId: 0,
							amount: amount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}
					]
				}
			])
			const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address))
				.optionSeries
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
			let quote = quoteResponse[0].sub(quoteResponse[2])
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
			expect(before.senderOtokenBalance.sub(after.senderOtokenBalance)).to.eq(after.opynAmount)
			expect(after.senderUSDBalance.sub(before.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
			expect(
				after.poolUSDBalance
					.sub(before.poolUSDBalance)
					.add(quote)
					.sub(after.collateralAllocated.sub(before.collateralAllocated))
			).to.be.within(-10, 10)
			expect(after.exchangeOTokenBalance.sub(before.exchangeOTokenBalance)).to.equal(after.opynAmount)
			expect(after.pfList.length - before.pfList.length).to.equal(1)
			expect(
				before.poolUSDBalance
					.sub(after.poolUSDBalance)
					.sub(after.senderUSDBalance.sub(before.senderUSDBalance))
			).to.be.within(-10, 10)
			expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
			expect(after.seriesStores.longExposure.sub(before.seriesStores.longExposure)).to.equal(amount)
			expect(before.seriesStores.shortExposure).to.equal(after.seriesStores.shortExposure)
			expect(after.netDhvExposure.sub(before.netDhvExposure)).to.equal(amount)
		})
		describe("Purchase and sell back a busd option", async () => {
			let strikePrice: BigNumber
			let proposedSeries: OptionSeriesStruct
			let busd: MintableERC20
			it("SETUP: mints an otoken", async () => {
				// get a busd whale
				busd = (await ethers.getContractAt(
					"MintableERC20",
					"0x4Fabb145d64652a948d72533023f6E7A623C7C53"
				)) as MintableERC20
				await hre.network.provider.request({
					method: "hardhat_impersonateAccount",
					params: ["0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8"]
				})
				const signer = await ethers.getSigner("0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8")
				await busd.connect(signer).transfer(senderAddress, toWei("100000"))
				await whitelistProduct(
					weth.address,
					usd.address,
					busd.address,
					true,
					false,
					newWhitelist.address,
					newCalculator,
					productSpotShockValue,
					timeToExpiry,
					expiryToValue,
					controller,
					oracle,
					toWei("1")
				)
				await whitelistProduct(
					weth.address,
					usd.address,
					busd.address,
					false,
					true,
					newWhitelist.address,
					newCalculator,
					productSpotShockValue,
					timeToExpiry,
					expiryToValue,
					controller,
					oracle,
					toWei("1")
				)
				strikePrice = toWei("3000")
				proposedSeries = {
					expiration: expiration,
					strike: strikePrice,
					isPut: PUT_FLAVOR,
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: busd.address
				}
				const amount = toWei("5")
				const otoken = await createAndMintOtoken(
					addressBook,
					proposedSeries,
					usd,
					weth,
					busd,
					amount,
					signers[0],
					optionRegistry,
					"1"
				)
				oTokenBUSD3000P = (await ethers.getContractAt("Otoken", otoken)) as Otoken
				expect(await oTokenBUSD3000P.balanceOf(senderAddress)).to.equal(
					amount.div(ethers.utils.parseUnits("1", 10))
				)
				optionToken = oTokenBUSD3000P
			})
			it("SETUP: approve series", async () => {
				await catalogue.issueNewSeries([
					{
						expiration: proposedSeries.expiration,
						isPut: proposedSeries.isPut,
						strike: proposedSeries.strike,
						isSellable: true,
						isBuyable: true
					}
				])
			})
			it("SETUP: change option buy or sell on series", async () => {
				const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
				const strikePrice = priceQuote.add(toWei(strike))
				const tx = await catalogue.changeOptionBuyOrSell([
					{
						expiration: proposedSeries.expiration,
						isPut: proposedSeries.isPut,
						strike: proposedSeries.strike,
						isSellable: true,
						isBuyable: true
					}
				])
			})
			it("SUCCEEDS: sells the options to the exchange fails if collateral is not approved", async () => {
				const amount = toWei("4")
				await expect(exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])).to.be.revertedWithCustomError(exchange, "CollateralAssetInvalid")
			})
			it("SUCCEEDS: approve busd as collateral for puts", async () => {
				expect(await exchange.approvedCollateral(busd.address, true)).to.be.false
				const tx = await exchange.changeApprovedCollateral(busd.address, true, true)
				expect(await exchange.approvedCollateral(busd.address, true)).to.be.true
				const receipt = await tx.wait()
				const events = receipt.events
				const txEvents = events?.find(x => x.event == "CollateralApprovalChanged")
				expect(txEvents?.args?.collateral).to.equal(busd.address)
				expect(txEvents?.args?.isPut).to.equal(true)
				expect(txEvents?.args?.isApproved).to.equal(true)
			})
			it("REVERTS: approve busd as collateral for puts fails by non-gov", async () => {
				await expect(exchange.connect(signers[1]).changeApprovedCollateral(busd.address, true, true)).to.be.revertedWithCustomError(exchange, "UNAUTHORIZED")
			})
			it("SUCCEEDS: sells the options to the exchange", async () => {
				const amount = toWei("4")
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
				await optionToken.approve(exchange.address, amount)
				await exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 2,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					}
				])
				const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address))
					.optionSeries
				let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
				await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, toWei("0"))
				let quote = quoteResponse[0].sub(quoteResponse[2])
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
				expect(before.senderOtokenBalance.sub(after.senderOtokenBalance)).to.eq(after.opynAmount)
				expect(after.senderUSDBalance.sub(before.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
				expect(
					after.poolUSDBalance
						.sub(before.poolUSDBalance)
						.add(quote)
						.sub(after.collateralAllocated.sub(before.collateralAllocated))
				).to.be.within(-10, 10)
				expect(after.exchangeOTokenBalance.sub(before.exchangeOTokenBalance)).to.equal(after.opynAmount)
				expect(after.pfList.length - before.pfList.length).to.equal(1)
				expect(
					before.poolUSDBalance
						.sub(after.poolUSDBalance)
						.sub(after.senderUSDBalance.sub(before.senderUSDBalance))
				).to.be.within(-10, 10)
				expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
				expect(after.seriesStores.longExposure.sub(before.seriesStores.longExposure)).to.equal(amount)
				expect(before.seriesStores.shortExposure).to.equal(after.seriesStores.shortExposure)
				expect(after.netDhvExposure.sub(before.netDhvExposure)).to.equal(amount)
			})
			it("SUCCEEDS: buys the option positions", async () => {
				const amount = toWei("2")
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
				await usd.approve(exchange.address, amount)
				await exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionToken.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: amount,
								data: "0x"
							}
						]
					}
				])
				const proposedSeries = (await portfolioValuesFeed.storesForAddress(optionToken.address))
					.optionSeries
				let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, before.netDhvExposure)
				await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
				let quote = quoteResponse[0].add(quoteResponse[2])
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
				expect(after.senderOtokenBalance.sub(before.senderOtokenBalance)).to.eq(after.opynAmount)
				expect(before.senderUSDBalance.sub(after.senderUSDBalance).sub(quote)).to.be.within(-10, 10)
				expect(
					after.poolUSDBalance
						.sub(before.poolUSDBalance)
						.sub(quote)
						.sub(before.collateralAllocated.sub(after.collateralAllocated))
				).to.be.within(-10, 10)
				expect(before.exchangeOTokenBalance.sub(after.exchangeOTokenBalance)).to.equal(after.opynAmount)
				expect(after.pfList.length - before.pfList.length).to.equal(0)
				expect(after.pfList[after.pfList.length - 1]).to.equal(optionToken.address)
				expect(before.seriesStores.longExposure.sub(after.seriesStores.longExposure)).to.equal(amount)
				expect(after.seriesStores.shortExposure.sub(before.seriesStores.shortExposure)).to.equal(0)
				expect(before.netDhvExposure.sub(after.netDhvExposure)).to.equal(amount)
			})
		})
		it("pauses trading and executes epoch", async () => {
			await liquidityPool.pauseTradingAndRequest()
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			await liquidityPool.executeEpochCalculation()
		})
		describe("Tries to hedge with rebalancePortfolioDelta", async () => {
			it("reverts when non-admin calls rebalance function", async () => {
				const delta = await liquidityPool.getPortfolioDelta()
				await expect(liquidityPool.connect(signers[1]).rebalancePortfolioDelta(delta, 1)).to.be.reverted
			})
			it("hedges negative delta in hedging reactor", async () => {
				const delta = await liquidityPool.getPortfolioDelta()
				await expect(liquidityPool.rebalancePortfolioDelta(delta, 1)).to.be.reverted
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
			let optionTokenAlt: Otoken
			it("SUCCEEDS: LP Sells a ETH/USD call for premium with otoken created outside", async () => {
				const amount = toWei("5")
				const strikePrice = toWei("1750")
				const proposedSeries = {
					expiration: expiration,
					strike: strikePrice,
					isPut: CALL_FLAVOR,
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: usd.address
				}
				const otoken = await exchange.callStatic.createOtoken(proposedSeries)
				optionTokenAlt = (await ethers.getContractAt("Otoken", otoken)) as Otoken
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
				await usd.approve(MARGIN_POOL[chainId], marginRequirement)
				const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
				const before = await getExchangeParams(
					liquidityPool,
					exchange,
					usd,
					wethERC20,
					portfolioValuesFeed,
					optionTokenAlt,
					senderAddress,
					amount
				)
				let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, before.netDhvExposure)
				await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
				let quote = quoteResponse[0].sub(quoteResponse[2])
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
								asset: optionTokenAlt.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
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
					optionTokenAlt,
					senderAddress,
					amount
				)
				quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, before.netDhvExposure)
				await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, true, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
				quote = quoteResponse[0].sub(quoteResponse[2])
				expect(after.senderOtokenBalance).to.eq(0)
				expect(after.senderUSDBalance.sub(before.senderUSDBalance).add(marginRequirement).sub(quote)).to.be.within(
					-10,
					10
				)
				expect(after.poolUSDBalance.sub(before.poolUSDBalance).add(quote)).to.be.within(-10, 10)
				expect(after.exchangeOTokenBalance.sub(before.exchangeOTokenBalance)).to.equal(after.opynAmount)
				expect(after.pfList.length - before.pfList.length).to.equal(0)
				expect(after.seriesStores.longExposure.sub(before.seriesStores.longExposure)).to.equal(amount)
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
			it("SUCCEEDS: LP Buys back their position and withdraws collateral", async () => {
				const amount = toWei("5")
				const strikePrice = toWei("1750")
				const proposedSeries = {
					expiration: expiration,
					strike: strikePrice,
					isPut: CALL_FLAVOR,
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: usd.address
				}
				const vaultId = await controller.getAccountVaultCounter(senderAddress)
				const vaultBalance = (await controller.getVault(senderAddress, vaultId)).collateralAmounts[0]
				const before = await getExchangeParams(
					liquidityPool,
					exchange,
					usd,
					wethERC20,
					portfolioValuesFeed,
					optionTokenAlt,
					senderAddress,
					amount
				)
				let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, before.netDhvExposure)
				await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
				let quote = quoteResponse[0].add(quoteResponse[2])
				await optionTokenAlt.approve(MARGIN_POOL[chainId], 0)
				await exchange.operate([
					{
						operation: 1,
						operationQueue: [
							{
								actionType: 1,
								owner: ZERO_ADDRESS,
								secondAddress: senderAddress,
								asset: optionTokenAlt.address,
								vaultId: 0,
								amount: amount,
								optionSeries: emptySeries,
								index: 0,
								data: "0x"
							}
						]
					},
					{
						operation: 0,
						operationQueue: [
							{
								actionType: 2,
								owner: senderAddress,
								secondAddress: senderAddress,
								asset: optionTokenAlt.address,
								vaultId: vaultId,
								amount: amount.div(ethers.utils.parseUnits("1", 10)),
								optionSeries: emptySeries,
								index: 0,
								data: ZERO_ADDRESS
							},
							{
								actionType: 6,
								owner: senderAddress,
								secondAddress: senderAddress,
								asset: usd.address,
								vaultId: vaultId,
								amount: vaultBalance,
								optionSeries: emptySeries,
								index: 0,
								data: ZERO_ADDRESS
							},
						]
					},
				])
				const after = await getExchangeParams(
					liquidityPool,
					exchange,
					usd,
					wethERC20,
					portfolioValuesFeed,
					optionTokenAlt,
					senderAddress,
					amount
				)
				quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, before.netDhvExposure)
				await compareQuotes(quoteResponse, liquidityPool, volFeed, priceFeed, proposedSeries, amount, false, exchange, optionRegistry, usd, pricer, before.netDhvExposure)
				quote = quoteResponse[0].add(quoteResponse[2])
				expect(after.senderOtokenBalance).to.eq(0)
				expect(after.senderUSDBalance.sub(before.senderUSDBalance).sub(vaultBalance).add(quote)).to.be.within(
					-10,
					10
				)
				expect(after.poolUSDBalance.sub(before.poolUSDBalance).sub(quote)).to.be.within(-10, 10)
				expect(before.exchangeOTokenBalance.sub(after.exchangeOTokenBalance)).to.equal(after.opynAmount)
				expect(after.pfList.length - before.pfList.length).to.equal(0)
				expect(before.seriesStores.longExposure.sub(after.seriesStores.longExposure)).to.equal(amount)
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
				expect(before.netDhvExposure.sub(after.netDhvExposure)).to.equal(amount)
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
				const collateralAllocatedToVault1 = (await controller.getVault(optionRegistry.address, 1))
					.collateralAmounts[0]
				// settle the vault
				const settleVault = await liquidityPool.settleVault(optionToken.address)
				let receipt = await settleVault.wait()
				const events = receipt.events
				const settleEvent = events?.find(x => x.event == "SettleVault")
				const collateralReturned = settleEvent?.args?.collateralReturned
				const collateralLost = settleEvent?.args?.collateralLost
				// puts expired ITM, so the amount ITM will be subtracted and used to pay out option holders
				const optionITMamount = settlePrice.sub(strikePrice)
				const amount = parseFloat(utils.formatUnits(await optionToken.totalSupply(), 8))
				// format from e8 oracle price to e6 USDC decimals
				expect(collateralReturned).to.equal(
					collateralAllocatedToVault1.sub(optionITMamount.div(100).mul(amount))
				)
				expect(await liquidityPool.collateralAllocated()).to.equal(
					totalCollateralAllocated.sub(collateralReturned).sub(collateralLost)
				)
			})
			it("SUCCEEDS: sells the options to the exchange", async () => {
				const amount = toWei("4")
				const before = await getExchangeParams(
					liquidityPool,
					exchange,
					usd,
					wethERC20,
					portfolioValuesFeed,
					oTokenUSDCSXC,
					senderAddress,
					amount
				)
				await oTokenUSDCSXC.approve(exchange.address, amount)
				await expect(
					exchange.operate([
						{
							operation: 1,
							operationQueue: [
								{
									actionType: 2,
									owner: ZERO_ADDRESS,
									secondAddress: senderAddress,
									asset: oTokenUSDCSXC.address,
									vaultId: 0,
									amount: amount,
									optionSeries: emptySeries,
									index: 0,
									data: "0x"
								}
							]
						}
					])
				).to.be.revertedWithCustomError(exchange, "OptionExpiryInvalid")
			})
			it("SUCCEEDS: redeems options held", async () => {
				optionToken = oTokenUSDC1650C
				const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
				const redeem = await exchange.redeem([optionToken.address], [0])
				const receipt = await redeem.wait()
				const events = receipt.events
				const redemptionEvent = events?.find(x => x.event == "RedemptionSent")
				const redeemAmount = redemptionEvent?.args?.redeemAmount
				const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
				expect(reactorOtokenBalanceBefore).to.be.gt(0)
				expect(reactorOtokenBalanceAfter).to.equal(0)
				expect(
					liquidityPoolUSDBalanceAfter.sub(liquidityPoolUSDBalanceBefore).sub(redeemAmount)
				).to.be.within(-50, 50)
			})
		})

		describe("Settles and redeems eth otoken", async () => {
			it("REVERTS: redeems options held fails because past AmountOutMinimum", async () => {
				optionToken = oTokenETH1500C
				await expect(exchange.redeem([optionToken.address], [toWei("10000")])).to.be.revertedWith("Too little received")
			})
			it("SUCCEEDS: redeems options held", async () => {
				optionToken = oTokenETH1500C
				const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
				const redeem = await exchange.redeem([optionToken.address], [0])
				const receipt = await redeem.wait()
				const events = receipt.events
				const redemptionEvent = events?.find(x => x.event == "RedemptionSent")
				const redeemAmount = redemptionEvent?.args?.redeemAmount
				const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
				expect(reactorOtokenBalanceBefore).to.be.gt(0)
				expect(reactorOtokenBalanceAfter).to.equal(0)
				expect(
					liquidityPoolUSDBalanceAfter.sub(liquidityPoolUSDBalanceBefore).sub(redeemAmount)
				).to.be.within(-50, 50)
			})
		})
		describe("Settles and redeems busd otoken", async () => {
			it("REVERTS: cannot redeem option when pool fee not set", async () => {
				optionToken = oTokenBUSD3000P
				await expect(exchange.redeem([optionToken.address], [0])).to.be.revertedWithCustomError(exchange, "PoolFeeNotSet")
			})
			it("SETUP: set pool fee for busd", async () => {
				await exchange.setPoolFee("0x4Fabb145d64652a948d72533023f6E7A623C7C53", 500)
				expect(await exchange.poolFees("0x4Fabb145d64652a948d72533023f6E7A623C7C53")).to.equal(500)
			})
			it("SUCCEEDS: redeems options held", async () => {
				optionToken = oTokenBUSD3000P
				const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
				const redeem = await exchange.redeem([optionToken.address], [0])
				const receipt = await redeem.wait()
				const events = receipt.events
				const redemptionEvent = events?.find(x => x.event == "RedemptionSent")
				const redeemAmount = redemptionEvent?.args?.redeemAmount
				const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
				expect(reactorOtokenBalanceBefore).to.be.gt(0)
				expect(reactorOtokenBalanceAfter).to.equal(0)
				expect(
					liquidityPoolUSDBalanceAfter.sub(liquidityPoolUSDBalanceBefore).sub(redeemAmount)
				).to.be.within(-50, 50)
				const busd = (await ethers.getContractAt(
					"MintableERC20",
					"0x4Fabb145d64652a948d72533023f6E7A623C7C53"
				)) as MintableERC20
				expect(await busd.balanceOf(exchange.address)).to.equal(0)
			})
		})
		describe("Test migration functionality", async () => {
			let migExchange: OptionExchange
			it("SUCCEEDS: deploy new option exchange", async () => {
				const interactionsFactory = await hre.ethers.getContractFactory("OpynInteractions")
				const interactions = await interactionsFactory.deploy()
				const exchangeFactory = await ethers.getContractFactory("OptionExchange", {
					libraries: {
						OpynInteractions: interactions.address
					}
				})
				migExchange = (await exchangeFactory.deploy(
					authority,
					optionProtocol.address,
					liquidityPool.address,
					pricer.address,
					ADDRESS_BOOK[chainId],
					UNISWAP_V3_SWAP_ROUTER[chainId],
					liquidityPool.address,
					catalogue.address
				)) as OptionExchange
			})
			it("REVERTS: migrate options if not governor", async () => {
				await expect(exchange.connect(signers[1]).migrateOtokens(migExchange.address, [oTokenUSDC1650NC.address, oTokenETH1600C.address, oTokenUSDCSXC.address])).to.be.revertedWithCustomError(exchange, "UNAUTHORIZED")
			})
			it("SUCCEEDS: migrate options", async () => {
				const otokens = [oTokenUSDCSXC]
				const otokenArray = [oTokenUSDCSXC.address]
				let otokenBalancesEx = [toWei("0"), 0, 0]
				let otokenBalancesMigEx = [toWei("0"), 0, 0]
				for (let i = 0; i < otokenArray.length; i++) {
					expect(await otokens[i].balanceOf(exchange.address)).to.be.gt(0)
					otokenBalancesEx[i] = (await otokens[i].balanceOf(exchange.address))
					otokenBalancesMigEx[i] = (await otokens[i].balanceOf(migExchange.address))
				}
				const tx = await exchange.migrateOtokens(migExchange.address, otokenArray)
				for (let i = 0; i < otokenArray.length; i++) {
					expect(otokenBalancesEx[i].sub(await otokens[i].balanceOf(migExchange.address))).to.equal(0)
					expect(await otokens[i].balanceOf(exchange.address)).to.equal(0)
				}
				const receipt = await tx.wait()
				const events = receipt.events
				const migrateEvent = events?.find(x => x.event == "OtokenMigrated")
				expect(migrateEvent?.args?.newOptionExchange).to.equal(migExchange.address)
				expect(migrateEvent?.args?.otoken).to.equal(oTokenUSDCSXC.address)
				expect(migrateEvent?.args?.amount).to.equal(otokenBalancesEx[0])
			})
		})
		describe("Admin functionality", async () => {
			it("SUCCEEDS: set pricer", async () => {
				await exchange.setPricer(senderAddress)
				expect(await exchange.pricer()).to.equal(senderAddress)
			})
			it("REVERTS: set pricer when non governance calls", async () => {
				await expect(exchange.connect(signers[1]).setPricer(senderAddress)).to.be.revertedWithCustomError(exchange, 
					"UNAUTHORIZED"
				)
				await exchange.setPricer(pricer.address)
				expect(await exchange.pricer()).to.equal(pricer.address)
			})
			it("SUCCEEDS: set catalogue", async () => {
				await exchange.setOptionCatalogue(senderAddress)
				expect(await exchange.catalogue()).to.equal(senderAddress)
			})
			it("REVERTS: set catalogue when non governance calls", async () => {
				await expect(exchange.connect(signers[1]).setOptionCatalogue(senderAddress)).to.be.revertedWithCustomError(exchange, 
					"UNAUTHORIZED"
				)
				await exchange.setOptionCatalogue(catalogue.address)
				expect(await exchange.catalogue()).to.equal(catalogue.address)
			})
			it("SUCCEEDS: set trade size limits", async () => {
				await exchange.setTradeSizeLimits(toWei("1000"), toWei("10000"))
				expect(await exchange.maxTradeSize()).to.equal(toWei("10000"))
				expect(await exchange.minTradeSize()).to.equal(toWei("1000"))
			})
			it("REVERTS: set trade size limits when non governance calls", async () => {
				await expect(exchange.connect(signers[1]).setTradeSizeLimits(0, 0)).to.be.revertedWithCustomError(exchange, 
					"UNAUTHORIZED"
				)
				await exchange.setTradeSizeLimits(toWei("0.01"), toWei("1000"))
				expect(await exchange.maxTradeSize()).to.equal(toWei("1000"))
				expect(await exchange.minTradeSize()).to.equal(toWei("0.01"))
			})
			it("SUCCEEDS: set delta band width on pricer", async () => {
				await pricer.setDeltaBandWidth(toWei("20"), [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")], [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")])
				expect(await pricer.deltaBandWidth()).to.equal(toWei("20"))
			})
			it("REVERTS: set delta band width on pricer when non governance calls", async () => {
				await expect(pricer.connect(signers[1]).setDeltaBandWidth(toWei("20"), [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")], [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")])).to.be.revertedWithCustomError(pricer, 
					"UNAUTHORIZED"
				)
			})
			it("REVERTS: set delta band width with incorrect length arrays", async () => {
				await expect(pricer.setDeltaBandWidth(toWei("5"), [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")], [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")])).to.be.revertedWithCustomError(pricer, 
					"InvalidSlippageGradientMultipliersArrayLength"
				)
			})
			it("REVERTS: set delta band width with incorrect length arrays", async () => {
				await expect(pricer.setDeltaBandWidth(toWei("20"), [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4")], [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")])).to.be.revertedWithCustomError(pricer, 
					"InvalidSlippageGradientMultipliersArrayLength"
				)
			})
			it("REVERTS: set delta band width with a param below 0", async () => {
				await expect(pricer.setDeltaBandWidth(toWei("20"), [toWei("0.9"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")], [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")])).to.be.revertedWithCustomError(pricer,
					"InvalidSlippageGradientMultiplierValue"
				)
			})
			it("SUCCEEDS: set slippage gradient multipliers on pricer", async () => {
				const slippageGradientMultipliers = [utils.parseUnits("1.1", 18), utils.parseUnits("1.2", 18), utils.parseUnits("1.6", 18), utils.parseUnits("1.4", 18), utils.parseUnits("1.5", 18)]
				await pricer.setSlippageGradientMultipliers(slippageGradientMultipliers, slippageGradientMultipliers)
				const acSlippageGradientMultipliers = await pricer.getCallSlippageGradientMultipliers()
				const apSlippageGradientMultipliers = await pricer.getPutSlippageGradientMultipliers()

				for (let i = 0; i < slippageGradientMultipliers.length; i++) {
					expect(acSlippageGradientMultipliers[i]).to.equal(slippageGradientMultipliers[i])
					expect(apSlippageGradientMultipliers[i]).to.equal(slippageGradientMultipliers[i])
				}
			})
			it("REVERTS: set slippage gradients on pricer when non governance calls", async () => {
				await expect(pricer.connect(signers[1]).setSlippageGradientMultipliers([toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")], [toWei("1.1"), toWei("1.2"), toWei("1.3"), toWei("1.4"), toWei("1.5")])).to.be.revertedWithCustomError(pricer,
					"UNAUTHORIZED"
				)
			})
			it("SUCCEEDS: set pool fee", async () => {
				await exchange.setPoolFee(senderAddress, 1000)
				expect(await exchange.poolFees(senderAddress)).to.equal(1000)
			})
			it("REVERTS: set pool fee when non governance calls", async () => {
				await expect(exchange.connect(signers[1]).setPoolFee(senderAddress, 0)).to.be.revertedWithCustomError(exchange,
					"UNAUTHORIZED"
				)
				await exchange.setPoolFee(senderAddress, 0)
				expect(await exchange.poolFees(senderAddress)).to.equal(0)
			})
			it("SUCCEEDS: set fee recipient", async () => {
				await exchange.setFeeRecipient(receiverAddress)
				expect(await exchange.feeRecipient()).to.equal(receiverAddress)
			})
			it("REVERTS: set fee recipient", async () => {
				await expect(exchange.connect(signers[1]).setFeeRecipient(senderAddress)).to.be.revertedWithCustomError(exchange, 
					"UNAUTHORIZED"
				)
				await exchange.setFeeRecipient(senderAddress)
				expect(await exchange.feeRecipient()).to.equal(senderAddress)
			})
			it("REVERTS: set fee recipient to zero address", async () => {
				await expect(exchange.setFeeRecipient(ZERO_ADDRESS)).to.be.reverted
			})
			it("SUCCEEDS: update just returns 0", async () => {
				const update = await exchange.callStatic.update()
				expect(update).to.equal(0)
			})
			it("REVERTS: withdraw when non vault calls", async () => {
				await expect(exchange.withdraw(toWei("10"))).to.be.revertedWith("!vault")
			})
			it("SUCCEEDS: hedge delta", async () => {
				await expect(exchange.hedgeDelta(1)).to.be.reverted
			})
		})
		describe("Unwinds a hedging reactor", async () => {
			it("Succeed: Hedging reactor unwind", async () => {
				await liquidityPool.removeHedgingReactorAddress(1, false)
				expect(await exchange.getDelta()).to.equal(0)
				expect(await liquidityPool.getExternalDelta()).to.equal(0)
				expect(await exchange.getPoolDenominatedValue()).to.eq(0)
				expect(await usd.balanceOf(exchange.address)).to.eq(0)
				// check no hedging reactors exist
				await expect(liquidityPool.hedgingReactors(1)).to.be.reverted
			})
		})
	})
})
