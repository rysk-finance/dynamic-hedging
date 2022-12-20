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
	increase,
	setOpynOracleExpiryPrice,
	createAndMintOtoken,
	whitelistProduct
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

/* --- end variables to change --- */

const expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000
const expiration2 = moment.utc(expiryDate).add(1, "w").add(8, "h").valueOf() / 1000 // have another batch of options exire 1 week after the first
const expiration3 = moment.utc(expiryDate).add(2, "w").add(8, "h").valueOf() / 1000
const invalidExpirationLong = moment.utc(invalidExpiryDateLong).add(8, "h").valueOf() / 1000
const invalidExpirationShort = moment.utc(invalidExpiryDateShort).add(8, "h").valueOf() / 1000
const abiCode = new AbiCoder()

const CALL_FLAVOR = false
const PUT_FLAVOR = true
const emptySeries = { expiration: 1, strike: 1, isPut: CALL_FLAVOR, collateral: ZERO_ADDRESS, underlying: ZERO_ADDRESS, strikeAsset: ZERO_ADDRESS }
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
		const wethERC20 = deployParams.wethERC20
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
			const balance = await usd.balanceOf(senderAddress)
			await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
			const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
			const liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
			const receipt = await deposit.wait(1)
			const event = receipt?.events?.find(x => x.event == "Deposit")
			const newBalance = await usd.balanceOf(senderAddress)
			expect(event?.event).to.eq("Deposit")
		})
		it("pauses trading and executes epoch", async () => {
			await liquidityPool.pauseTradingAndRequest()
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			await portfolioValuesFeed.fulfill(
				weth.address,
				usd.address,
			)
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
			await exchange.issueNewSeries([{
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
				expiration: expiration2,
				isPut: CALL_FLAVOR,
				strike: toWei("1650"),
				isSellable: true,
				isBuyable: true
			},
			])
		})
		it("LP Writes a ETH/USD call for premium", async () => {
			const [sender] = signers
			const amount = toWei("5")
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
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
			const EthPrice = await oracle.getPrice(weth.address)
			const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const quote = (
				await pricer.quoteOptionPrice(proposedSeries, amount, false)
			)[0]
			await usd.approve(exchange.address, quote)
			const balance = await usd.balanceOf(senderAddress)
			await exchange.operate([
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
						index: 0,
						data: "0x"
					}]
				}])
			const seriesAddress = await exchange.getSeriesWithe18Strike(proposedSeries)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("5"),
				true
			)
			await portfolioValuesFeed.fulfill(
				weth.address,
				usd.address,
			)
			const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
			oTokenUSDCXC = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDCXC
			const putBalance = await optionToken.balanceOf(senderAddress)
			collateralAllocatedToVault1 = await liquidityPool.collateralAllocated()
			const balanceNew = await usd.balanceOf(senderAddress)
			const opynAmount = toOpyn(fromWei(amount))
			expect(putBalance).to.eq(opynAmount)
			// ensure funds are being transfered
			expect(tFormatUSDC(balance.sub(balanceNew)) - tFormatUSDC(quote)).to.be.lt(0.1)
			const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
		})
		it("SETUP: change option buy or sell on series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(ethers.utils.parseUnits("1", 10))
			const tx = await exchange.changeOptionBuyOrSell([{
				expiration: expiration,
				isPut: CALL_FLAVOR,
				strike: formattedStrikePrice,
				isSellable: false,
				isBuyable: false
			}])
		})
		it("REVERTS: sells the options to the exchange on a series not approved for selling", async () => {
			const amount = toWei("4")
			await expect(exchange.operate([
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
				}])).to.be.revertedWith("SeriesNotSellable()")
		})
		it("SETUP: change option buy or sell on series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(ethers.utils.parseUnits("1", 10))
			const tx = await exchange.changeOptionBuyOrSell([{
				expiration: expiration,
				isPut: CALL_FLAVOR,
				strike: formattedStrikePrice,
				isSellable: true,
				isBuyable: false
			}])
		})
		it("SUCCEEDS: sells the options to the exchange", async () => {
			const amount = toWei("4")
			const userOtokenBalanceBefore = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceBefore = await usd.balanceOf(senderAddress)
			const pfListBefore = await portfolioValuesFeed.getAddressSet()
			const storesBefore = await portfolioValuesFeed.storesForAddress(optionToken.address)
			await optionToken.approve(exchange.address, amount)
			await exchange.operate([
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
			const userOtokenBalanceAfter = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceAfter = await usd.balanceOf(senderAddress)
			const pfListAfter = await portfolioValuesFeed.getAddressSet()
			const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
			// expect(liquidityPoolUSDBalanceBefore.sub(liquidityPoolUSDBalanceAfter).sub(userUSDBalanceAfter.sub(userUSDBalanceBefore))).to.be.within(-100, 100)
			expect(pfListBefore.length).to.equal(pfListAfter.length)
			expect(pfListAfter[pfListAfter.length - 1]).to.equal(optionToken.address)
			expect(storesAfter.longExposure).to.equal(storesBefore.longExposure)
			expect(storesBefore.shortExposure.sub(storesAfter.shortExposure)).to.equal(amount)

		})
		it("REVERTS: buy the option positions fails because not approved", async () => {
			const amount = toWei("2")
			await usd.approve(exchange.address, amount)
			await expect(exchange.operate([
				{
					operation: 1,
					operationQueue: [{
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: optionToken.address,
						vaultId: 0,
						amount: amount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("SeriesNotBuyable()")
		})
		it("SETUP: change option buy or sell on series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const formattedStrikePrice = (await exchange.formatStrikePrice(strikePrice, usd.address)).mul(ethers.utils.parseUnits("1", 10))
			const tx = await exchange.changeOptionBuyOrSell([{
				expiration: expiration,
				isPut: CALL_FLAVOR,
				strike: formattedStrikePrice,
				isSellable: true,
				isBuyable: true
			}])
		})
		it("SUCCEEDS: closes the option positions", async () => {
			const amount = toWei("2")
			const userOtokenBalanceBefore = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceBefore = await usd.balanceOf(senderAddress)
			const pfListBefore = await portfolioValuesFeed.getAddressSet()
			const storesBefore = await portfolioValuesFeed.storesForAddress(optionToken.address)
			await usd.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [{
						actionType: 1,
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
			const userOtokenBalanceAfter = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceAfter = await usd.balanceOf(senderAddress)
			const pfListAfter = await portfolioValuesFeed.getAddressSet()
			const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
			expect(userOtokenBalanceAfter.sub(userOtokenBalanceBefore)).to.equal(toOpyn("2"))
			// expect(liquidityPoolUSDBalanceAfter.sub(liquidityPoolUSDBalanceBefore).sub(userUSDBalanceBefore.sub(userUSDBalanceAfter))).to.be.within(-50, 50)
			expect(pfListBefore.length).to.equal(pfListAfter.length)
			expect(storesBefore.longExposure.sub(storesAfter.longExposure)).to.equal(0)
			expect(storesAfter.shortExposure.sub(storesBefore.shortExposure)).to.equal(amount)
		})
		it("LP Sells a ETH/USD call for premium", async () => {
			const [sender] = signers
			const amount = toWei("5")
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = toWei("1750")
			const proposedSeries = {
				expiration: expiration2,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const EthPrice = await oracle.getPrice(weth.address)
			const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const quote = (
				await pricer.quoteOptionPrice(proposedSeries, amount, false)
			)[0]
			const otokenFactory = (await ethers.getContractAt("OtokenFactory", await addressBook.getOtokenFactory())) as OtokenFactory
			const otoken = await otokenFactory.callStatic.createOtoken(proposedSeries.underlying, proposedSeries.strikeAsset, proposedSeries.collateral, (proposedSeries.strike).div(ethers.utils.parseUnits("1", 10)), proposedSeries.expiration, proposedSeries.isPut)
			await otokenFactory.createOtoken(proposedSeries.underlying, proposedSeries.strikeAsset, proposedSeries.collateral, (proposedSeries.strike).div(ethers.utils.parseUnits("1", 10)), proposedSeries.expiration, proposedSeries.isPut)
			const marginRequirement = await (await optionRegistry.getCollateral({
				expiration: proposedSeries.expiration,
				strike: (proposedSeries.strike).div(ethers.utils.parseUnits("1", 10)),
				isPut: proposedSeries.isPut,
				strikeAsset: proposedSeries.strikeAsset,
				underlying: proposedSeries.underlying,
				collateral: proposedSeries.collateral
			}, amount)).add(toUSDC("100"))
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const balance = await usd.balanceOf(senderAddress)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const pfListBefore = await portfolioValuesFeed.getAddressSet()
			/// ADD OPERATOR TODO
			await controller.setOperator(exchange.address, true)
			
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
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
					}]
				},
				{
					operation: 1,
					operationQueue: [{
						actionType: 2,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						index: 0,
						data: "0x"
					}]
				}])
			const seriesAddress = await exchange.getSeriesWithe18Strike(proposedSeries)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("5"),
				true
			)
			const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
			oTokenUSDCSXC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			optionToken = oTokenUSDCSXC
			collateralAllocatedToVault1 = await liquidityPool.collateralAllocated()
			const pfListAfter = await portfolioValuesFeed.getAddressSet()
			const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
			const balanceNew = await usd.balanceOf(senderAddress)
			const opynAmount = toOpyn(fromWei(amount))
			const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
			expect(await optionToken.balanceOf(exchange.address)).to.eq(opynAmount)
			expect(balanceNew.sub(balance).sub(quote).add(marginRequirement)).to.be.within(-10,10)
			expect(poolBalanceDiff.sub(quote)).to.be.within(-10, 10)
			expect(await exchange.heldOtokens(senderAddress, seriesAddress)).to.equal(0)
			expect((pfListAfter.length - pfListBefore.length)).to.equal(1)
			expect(storesAfter.longExposure).to.equal(amount)
			expect(storesAfter.shortExposure).to.equal(0)
			expect(storesAfter.optionSeries.expiration).to.equal(proposedSeries.expiration)
			expect(storesAfter.optionSeries.isPut).to.equal(proposedSeries.isPut)
			expect(storesAfter.optionSeries.collateral).to.equal(proposedSeries.collateral).to.equal(usd.address)
			expect(storesAfter.optionSeries.underlying).to.equal(proposedSeries.underlying).to.equal(weth.address)
			expect(storesAfter.optionSeries.strikeAsset).to.equal(proposedSeries.strikeAsset).to.equal(usd.address)
			expect(storesAfter.optionSeries.strike).to.equal(proposedSeries.strike)
		})
		it("LP Writes a ETH/USD call for premium for an option to be sold", async () => {
			const [sender] = signers
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
			const EthPrice = await oracle.getPrice(weth.address)
			const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const quote = (
				await pricer.quoteOptionPrice(proposedSeries, amount, false)
			)[0]
			await usd.approve(exchange.address, quote)
			const balance = await usd.balanceOf(senderAddress)
			await exchange.operate([
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
						index: 0,
						data: "0x"
					}]
				}])
			const seriesAddress = await exchange.getSeriesWithe18Strike(proposedSeries)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("5"),
				true
			)
			await portfolioValuesFeed.fulfill(
				weth.address,
				usd.address,
			)
			const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
			oTokenUSDCXC = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDCXC
			const putBalance = await optionToken.balanceOf(senderAddress)
			collateralAllocatedToVault1 = await liquidityPool.collateralAllocated()
			const balanceNew = await usd.balanceOf(senderAddress)
			const opynAmount = toOpyn(fromWei(amount))
			expect(putBalance).to.eq(opynAmount)
			// ensure funds are being transfered
			expect(tFormatUSDC(balance.sub(balanceNew)) - tFormatUSDC(quote)).to.be.lt(0.1)
			const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
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
			const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const quote = (
				await pricer.quoteOptionPrice(proposedSeries, amount, false)
			)[0]
			const marginRequirement = await (await optionRegistry.getCollateral({
				expiration: proposedSeries.expiration,
				strike: (proposedSeries.strike).div(ethers.utils.parseUnits("1", 10)),
				isPut: proposedSeries.isPut,
				strikeAsset: proposedSeries.strikeAsset,
				underlying: proposedSeries.underlying,
				collateral: proposedSeries.collateral
			}, amount)).add(toUSDC("100"))
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const balance = await usd.balanceOf(senderAddress)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			const pfListBefore = await portfolioValuesFeed.getAddressSet()
			/// ADD OPERATOR TODO
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
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
					}]
				},
				{
					operation: 1,
					operationQueue: [{
						actionType: 2,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: ZERO_ADDRESS,
						vaultId: 0,
						amount: amount,
						optionSeries: proposedSeries,
						index: 0,
						data: "0x"
					}]
				}])
			const seriesAddress = await exchange.getSeriesWithe18Strike(proposedSeries)
			const localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("5"),
				true
			)
			const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
			oTokenUSDCSXC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			optionToken = oTokenUSDCSXC
			collateralAllocatedToVault1 = await liquidityPool.collateralAllocated()
			const pfListAfter = await portfolioValuesFeed.getAddressSet()
			const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
			const balanceNew = await usd.balanceOf(senderAddress)
			const opynAmount = toOpyn(fromWei(amount))
			const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
			expect(await optionToken.balanceOf(exchange.address)).to.eq(0)
			expect(balanceNew.sub(balance).sub(quote).add(marginRequirement)).to.be.within(-10,10)
			expect(poolBalanceDiff.sub(quote)).to.be.within(-10, 10)
			expect(await exchange.heldOtokens(senderAddress, seriesAddress)).to.equal(0)
			expect((pfListAfter.length - pfListBefore.length)).to.equal(1)
			expect(storesAfter.longExposure).to.equal(amount)
			expect(storesAfter.shortExposure).to.equal(0)
			expect(storesAfter.optionSeries.expiration).to.equal(proposedSeries.expiration)
			expect(storesAfter.optionSeries.isPut).to.equal(proposedSeries.isPut)
			expect(storesAfter.optionSeries.collateral).to.equal(proposedSeries.collateral).to.equal(usd.address)
			expect(storesAfter.optionSeries.underlying).to.equal(proposedSeries.underlying).to.equal(weth.address)
			expect(storesAfter.optionSeries.strikeAsset).to.equal(proposedSeries.strikeAsset).to.equal(usd.address)
			expect(storesAfter.optionSeries.strike).to.equal(proposedSeries.strike)
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
			const otoken = await createAndMintOtoken(addressBook, proposedSeries, usd, weth, weth, amount, signers[0], optionRegistry, "1")
			oTokenETH1500C = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			expect(await oTokenETH1500C.balanceOf(senderAddress)).to.equal(amount.div(ethers.utils.parseUnits("1", 10)))
			optionToken = oTokenETH1500C
		})
		it("SETUP: approve series", async () => {
			await exchange.issueNewSeries([{
				expiration: proposedSeries.expiration,
				isPut: proposedSeries.isPut,
				strike: proposedSeries.strike,
				isSellable: true,
				isBuyable: true
			}
			])
		})

		it("REVERTS: cant write eth options to the liquidity pool", async () => {
			const amount = toWei("4")
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
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("CollateralAssetInvalid()")
		})
		it("SETUP: change option buy or sell on series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const tx = await exchange.changeOptionBuyOrSell([{
				expiration: proposedSeries.expiration,
				isPut: proposedSeries.isPut,
				strike: proposedSeries.strike,
				isSellable: false,
				isBuyable: false
			}])
		})
		it("REVERTS: sells the options to the gamma hedging reactor on a series not approved for selling", async () => {
			const amount = toWei("4")
			await expect(exchange.operate([
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
				}])).to.be.revertedWith("SeriesNotSellable()")
		})
		it("SETUP: change option buy or sell on series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const tx = await exchange.changeOptionBuyOrSell([{
				expiration: proposedSeries.expiration,
				isPut: proposedSeries.isPut,
				strike: proposedSeries.strike,
				isSellable: true,
				isBuyable: false
			}])
		})
		it("SUCCEEDS: sells the options to the gamma hedging reactor", async () => {
			const amount = toWei("4")
			const userOtokenBalanceBefore = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceBefore = await usd.balanceOf(senderAddress)
			const pfListBefore = await portfolioValuesFeed.getAddressSet()
			const storesBefore = await portfolioValuesFeed.storesForAddress(optionToken.address)
			await optionToken.approve(exchange.address, amount)
			await exchange.operate([
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
			const userOtokenBalanceAfter = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceAfter = await usd.balanceOf(senderAddress)
			const pfListAfter = await portfolioValuesFeed.getAddressSet()
			const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
			expect(userOtokenBalanceBefore.sub(userOtokenBalanceAfter)).to.equal(toOpyn(fromWei(amount)))
			expect(reactorOtokenBalanceAfter.sub(reactorOtokenBalanceBefore)).to.equal(toOpyn(fromWei(amount)))
			expect(liquidityPoolUSDBalanceBefore.sub(liquidityPoolUSDBalanceAfter).sub(userUSDBalanceAfter.sub(userUSDBalanceBefore))).to.be.within(-100, 100)
			expect(pfListBefore.length + 1).to.equal(pfListAfter.length)
			expect(pfListAfter[pfListAfter.length - 1]).to.equal(optionToken.address)
			expect(storesAfter.longExposure.sub(storesBefore.longExposure)).to.equal(amount)
			expect(storesAfter.shortExposure).to.equal(storesBefore.shortExposure)
		})
		it("REVERTS: closes the option positions fails because not approved", async () => {
			const amount = toWei("2")
			await usd.approve(exchange.address, amount)
			await expect(exchange.operate([
				{
					operation: 1,
					operationQueue: [{
						actionType: 1,
						owner: ZERO_ADDRESS,
						secondAddress: senderAddress,
						asset: optionToken.address,
						vaultId: 0,
						amount: amount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("SeriesNotBuyable()")
		})
		it("SETUP: change option buy or sell on series", async () => {
			const tx = await exchange.changeOptionBuyOrSell([{
				expiration: proposedSeries.expiration,
				isPut: proposedSeries.isPut,
				strike: proposedSeries.strike,
				isSellable: true,
				isBuyable: true
			}])
		})
		it("SUCCEEDS: closes the option positions", async () => {
			const amount = toWei("2")
			const userOtokenBalanceBefore = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceBefore = await usd.balanceOf(senderAddress)
			const pfListBefore = await portfolioValuesFeed.getAddressSet()
			const storesBefore = await portfolioValuesFeed.storesForAddress(optionToken.address)
			await usd.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [{
						actionType: 1,
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
			const userOtokenBalanceAfter = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceAfter = await usd.balanceOf(senderAddress)
			const pfListAfter = await portfolioValuesFeed.getAddressSet()
			const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
			expect(userOtokenBalanceAfter.sub(userOtokenBalanceBefore)).to.equal(reactorOtokenBalanceBefore.sub(reactorOtokenBalanceAfter))
			expect(liquidityPoolUSDBalanceAfter.sub(liquidityPoolUSDBalanceBefore).sub(userUSDBalanceBefore.sub(userUSDBalanceAfter))).to.be.within(-50, 50)
			expect(pfListBefore.length).to.equal(pfListAfter.length)
			expect(storesBefore.longExposure.sub(storesAfter.longExposure)).to.equal(amount)
			expect(storesAfter.shortExposure).to.equal(storesBefore.shortExposure)
		})
	})
	describe("LP writes more options", async () => {
		let prevalues: any
		let quote: any
		let localDelta: any
		it("LP writes another ETH/USD call that expires later", async () => {
			const [sender] = signers
			const amount = toWei("3")
			const blockNum = await ethers.provider.getBlockNumber()
			const block = await ethers.provider.getBlock(blockNum)
			const { timestamp } = block
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
			const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const lpAllocatedBefore = await liquidityPool.collateralAllocated()
			quote = (await pricer.quoteOptionPrice(proposedSeries, amount, false))[0]
			await usd.approve(exchange.address, quote)
			await exchange.operate([
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
						index: 0,
						data: "0x"
					}]
				}])
			const seriesAddress = await exchange.getSeriesWithe18Strike(proposedSeries)
			const balance = await usd.balanceOf(senderAddress)
			prevalues = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			localDelta = await calculateOptionDeltaLocally(
				liquidityPool,
				priceFeed,
				proposedSeries,
				toWei("3"),
				true
			)
			await portfolioValuesFeed.fulfill(
				weth.address,
				usd.address,
			)
			const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
			oTokenUSDCXCLaterExp2 = (await ethers.getContractAt("Otoken", seriesAddress)) as Otoken
			optionToken = oTokenUSDCXCLaterExp2
			const putBalance = await optionToken.balanceOf(senderAddress)
			const lpAllocatedAfter = await liquidityPool.collateralAllocated()
			const balanceNew = await usd.balanceOf(senderAddress)
			const opynAmount = toOpyn(fromWei(amount))
			expect(putBalance).to.eq(opynAmount)
			// ensure funds are being transfered
			expect(tFormatUSDC(balance.sub(balanceNew)) - tFormatUSDC(quote)).to.be.lt(0.1)
			const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
			const lpAllocatedDiff = lpAllocatedAfter.sub(lpAllocatedBefore)
			expect(tFormatUSDC(poolBalanceDiff) + tFormatUSDC(quote) - tFormatUSDC(lpAllocatedDiff)).to.be.lt(
				0.1
			)
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
			const otoken = await createAndMintOtoken(addressBook, proposedSeries, usd, weth, weth, amount, signers[0], optionRegistry, "1")
			oTokenETH1600C = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			expect(await oTokenETH1600C.balanceOf(senderAddress)).to.equal(amount.div(ethers.utils.parseUnits("1", 10)))
			optionToken = oTokenETH1600C
		})
		it("SETUP: approve series", async () => {
			await exchange.issueNewSeries([{
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
			const tx = await exchange.changeOptionBuyOrSell([{
				expiration: proposedSeries.expiration,
				isPut: proposedSeries.isPut,
				strike: proposedSeries.strike,
				isSellable: true,
				isBuyable: true
			}])
		})
		it("SUCCEEDS: sells the options to the gamma hedging reactor", async () => {
			const amount = toWei("4")
			const userOtokenBalanceBefore = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceBefore = await usd.balanceOf(senderAddress)
			const pfListBefore = await portfolioValuesFeed.getAddressSet()
			const storesBefore = await portfolioValuesFeed.storesForAddress(optionToken.address)
			await optionToken.approve(exchange.address, amount)
			await exchange.operate([
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
			const userOtokenBalanceAfter = await optionToken.balanceOf(senderAddress)
			const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
			const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
			const userUSDBalanceAfter = await usd.balanceOf(senderAddress)
			const pfListAfter = await portfolioValuesFeed.getAddressSet()
			const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
			expect(userOtokenBalanceBefore.sub(userOtokenBalanceAfter)).to.equal(reactorOtokenBalanceAfter.sub(reactorOtokenBalanceBefore))
			expect(liquidityPoolUSDBalanceBefore.sub(liquidityPoolUSDBalanceAfter).sub(userUSDBalanceAfter.sub(userUSDBalanceBefore))).to.be.within(-100, 100)
			expect(pfListBefore.length + 1).to.equal(pfListAfter.length)
			expect(pfListAfter[pfListAfter.length - 1]).to.equal(optionToken.address)
			expect(storesAfter.longExposure.sub(storesBefore.longExposure)).to.equal(amount)
			expect(storesAfter.shortExposure).to.equal(storesBefore.shortExposure)
		})
		describe("Purchase and sell back a busd option", async () => {
			let strikePrice: BigNumber
			let proposedSeries: OptionSeriesStruct
			let busd: MintableERC20
			it("SETUP: mints an otoken", async () => {
				// get a busd whale
				busd = await ethers.getContractAt("MintableERC20", "0x4Fabb145d64652a948d72533023f6E7A623C7C53") as MintableERC20
				await hre.network.provider.request({
					method: "hardhat_impersonateAccount",
					params: ["0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8"]
				})
				const signer = await ethers.getSigner("0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8")
				await busd.connect(signer).transfer(senderAddress, toWei("100000"))
				await whitelistProduct(weth.address, usd.address, busd.address, true, false, newWhitelist.address, newCalculator, productSpotShockValue, timeToExpiry, expiryToValue, controller, oracle, toWei("1"))
				await whitelistProduct(weth.address, usd.address, busd.address, false, true, newWhitelist.address, newCalculator, productSpotShockValue, timeToExpiry, expiryToValue, controller, oracle, toWei("1"))
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
				const otoken = await createAndMintOtoken(addressBook, proposedSeries, usd, weth, busd, amount, signers[0], optionRegistry, "1")
				oTokenBUSD3000P = (await ethers.getContractAt("Otoken", otoken)) as Otoken
				expect(await oTokenBUSD3000P.balanceOf(senderAddress)).to.equal(amount.div(ethers.utils.parseUnits("1", 10)))
				optionToken = oTokenBUSD3000P
			})
			it("SETUP: approve series", async () => {
				await exchange.issueNewSeries([{
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
				const tx = await exchange.changeOptionBuyOrSell([{
					expiration: proposedSeries.expiration,
					isPut: proposedSeries.isPut,
					strike: proposedSeries.strike,
					isSellable: true,
					isBuyable: true
				}])
			})
			it("SUCCEEDS: sells the options to the gamma hedging reactor", async () => {
				const amount = toWei("4")
				const userOtokenBalanceBefore = await optionToken.balanceOf(senderAddress)
				const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
				const userUSDBalanceBefore = await usd.balanceOf(senderAddress)
				const pfListBefore = await portfolioValuesFeed.getAddressSet()
				const storesBefore = await portfolioValuesFeed.storesForAddress(optionToken.address)
				await optionToken.approve(exchange.address, amount)
				await exchange.operate([
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
				const userOtokenBalanceAfter = await optionToken.balanceOf(senderAddress)
				const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
				const userUSDBalanceAfter = await usd.balanceOf(senderAddress)
				const pfListAfter = await portfolioValuesFeed.getAddressSet()
				const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
				expect(userOtokenBalanceBefore.sub(userOtokenBalanceAfter)).to.equal(reactorOtokenBalanceAfter.sub(reactorOtokenBalanceBefore))
				expect(liquidityPoolUSDBalanceBefore.sub(liquidityPoolUSDBalanceAfter).sub(userUSDBalanceAfter.sub(userUSDBalanceBefore))).to.be.within(-100, 100)
				expect(pfListBefore.length + 1).to.equal(pfListAfter.length)
				expect(pfListAfter[pfListAfter.length - 1]).to.equal(optionToken.address)
				expect(storesAfter.longExposure.sub(storesBefore.longExposure)).to.equal(amount)
				expect(storesAfter.shortExposure).to.equal(storesBefore.shortExposure)
			})
			it("SUCCEEDS: closes the option positions", async () => {
				const amount = toWei("2")
				const userOtokenBalanceBefore = await optionToken.balanceOf(senderAddress)
				const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
				const userUSDBalanceBefore = await usd.balanceOf(senderAddress)
				const pfListBefore = await portfolioValuesFeed.getAddressSet()
				const storesBefore = await portfolioValuesFeed.storesForAddress(optionToken.address)
				await usd.approve(exchange.address, amount)
				await exchange.operate([
					{
						operation: 1,
						operationQueue: [{
							actionType: 1,
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
				const userOtokenBalanceAfter = await optionToken.balanceOf(senderAddress)
				const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
				const userUSDBalanceAfter = await usd.balanceOf(senderAddress)
				const pfListAfter = await portfolioValuesFeed.getAddressSet()
				const storesAfter = await portfolioValuesFeed.storesForAddress(optionToken.address)
				expect(userOtokenBalanceAfter.sub(userOtokenBalanceBefore)).to.equal(reactorOtokenBalanceBefore.sub(reactorOtokenBalanceAfter))
				expect(liquidityPoolUSDBalanceAfter.sub(liquidityPoolUSDBalanceBefore).sub(userUSDBalanceBefore.sub(userUSDBalanceAfter))).to.be.within(-50, 50)
				expect(pfListBefore.length).to.equal(pfListAfter.length)
				expect(storesBefore.longExposure.sub(storesAfter.longExposure)).to.equal(amount)
				expect(storesAfter.shortExposure).to.equal(storesBefore.shortExposure)
			})
		})
		it("pauses trading and executes epoch", async () => {
			await liquidityPool.pauseTradingAndRequest()
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			await portfolioValuesFeed.fulfill(
				weth.address,
				usd.address,
			)
			await liquidityPool.executeEpochCalculation()
		})
		describe("Tries to hedge with rebalancePortfolioDelta", async () => {
			it("reverts when non-admin calls rebalance function", async () => {
				const delta = await liquidityPool.getPortfolioDelta()
				await expect(liquidityPool.connect(signers[1]).rebalancePortfolioDelta(delta, 1)).to.be.reverted
			})
			it("hedges negative delta in hedging reactor", async () => {
				const delta = await liquidityPool.getPortfolioDelta()
				const reactorDelta = await exchange.internalDelta()
				await liquidityPool.rebalancePortfolioDelta(delta, 1)
				const newReactorDelta = await exchange.internalDelta()
				const newDelta = await liquidityPool.getPortfolioDelta()
				expect(newDelta).to.equal(delta)
				expect(reactorDelta.sub(newReactorDelta)).to.equal(0)
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
				await portfolioValuesFeed.fulfill(
					weth.address,
					usd.address,
				)
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
				await portfolioValuesFeed.fulfill(
					weth.address,
					usd.address,
				)
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
		})

		describe("Settles and redeems eth otoken", async () => {
			it("SUCCEEDS: redeems options held", async () => {
				optionToken = oTokenETH1500C
				const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
				const redeem = await exchange.redeem([optionToken.address])
				const receipt = await redeem.wait()
				const events = receipt.events
				const redemptionEvent = events?.find(x => x.event == "RedemptionSent")
				const redeemAmount = redemptionEvent?.args?.redeemAmount
				const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
				expect(reactorOtokenBalanceBefore).to.be.gt(0)
				expect(reactorOtokenBalanceAfter).to.equal(0)
				expect(liquidityPoolUSDBalanceAfter.sub(liquidityPoolUSDBalanceBefore).sub(redeemAmount)).to.be.within(-50, 50)
			})
		})
		describe("Settles and redeems eth otoken", async () => {
			it("SETUP: changes spot handling to sell redemption", async () => {
				await exchange.setSellRedemptions(false, spotHedgingReactor.address)
				expect(await exchange.sellRedemptions()).to.be.false
				expect(await exchange.spotHedgingReactor()).to.equal(spotHedgingReactor.address)
			})
			it("SUCCEEDS: redeems options held", async () => {
				optionToken = oTokenETH1600C
				const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
				const redeem = await exchange.redeem([optionToken.address])
				const receipt = await redeem.wait()
				const events = receipt.events
				const redemptionEvent = events?.find(x => x.event == "RedemptionSent")
				const redeemAmount = redemptionEvent?.args?.redeemAmount
				const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
				expect(reactorOtokenBalanceBefore).to.be.gt(0)
				expect(reactorOtokenBalanceAfter).to.equal(0)
				expect(liquidityPoolUSDBalanceAfter).to.equal(liquidityPoolUSDBalanceBefore)
				const wethAsset = (await ethers.getContractAt("MintableERC20", WETH_ADDRESS[chainId])) as MintableERC20
				expect(await wethAsset.balanceOf(exchange.address)).to.equal(0)
				expect(await wethAsset.balanceOf(spotHedgingReactor.address)).to.equal(redeemAmount)
			})
		})
		describe("Settles and redeems busd otoken", async () => {
			it("REVERTS: cannot redeem option when pool fee not set", async () => {
				optionToken = oTokenBUSD3000P
				await expect(exchange.redeem([optionToken.address])).to.be.revertedWith("PoolFeeNotSet()")
			})
			it("SETUP: set pool fee for busd", async () => {
				await exchange.setPoolFee("0x4Fabb145d64652a948d72533023f6E7A623C7C53", 500)
				expect(await exchange.poolFees("0x4Fabb145d64652a948d72533023f6E7A623C7C53")).to.equal(500)
			})
			it("SUCCEEDS: redeems options held", async () => {
				optionToken = oTokenBUSD3000P
				const reactorOtokenBalanceBefore = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
				const redeem = await exchange.redeem([optionToken.address])
				const receipt = await redeem.wait()
				const events = receipt.events
				const redemptionEvent = events?.find(x => x.event == "RedemptionSent")
				const redeemAmount = redemptionEvent?.args?.redeemAmount
				const reactorOtokenBalanceAfter = await optionToken.balanceOf(exchange.address)
				const liquidityPoolUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
				expect(reactorOtokenBalanceBefore).to.be.gt(0)
				expect(reactorOtokenBalanceAfter).to.equal(0)
				expect(liquidityPoolUSDBalanceAfter.sub(liquidityPoolUSDBalanceBefore).sub(redeemAmount)).to.be.within(-50, 50)
				const busd = await ethers.getContractAt("MintableERC20", "0x4Fabb145d64652a948d72533023f6E7A623C7C53") as MintableERC20
				expect(await busd.balanceOf(exchange.address)).to.equal(0)
			})
		})
		describe("Admin functionality", async () => {
			it("SUCCEEDS: set pricer", async () => {
				await exchange.setPricer(senderAddress)
				expect(await exchange.pricer()).to.equal(senderAddress)
			})
			it("REVERTS: set pricer when non governance calls", async () => {
				await expect(exchange.connect(signers[1]).setPricer(senderAddress)).to.be.revertedWith("UNAUTHORIZED()")
				await exchange.setPricer(pricer.address)
				expect(await exchange.pricer()).to.equal(pricer.address)
			})
			it("SUCCEEDS: set sell redemptions", async () => {
				await exchange.setSellRedemptions(false, spotHedgingReactor.address)
				expect(await exchange.sellRedemptions()).to.be.false
				expect(await exchange.spotHedgingReactor()).to.equal(spotHedgingReactor.address)
			})
			it("REVERTS: set sell redemptions when non governance calls", async () => {
				await expect(exchange.connect(signers[1]).setSellRedemptions(true, spotHedgingReactor.address)).to.be.revertedWith("UNAUTHORIZED()")
				await exchange.setSellRedemptions(true, spotHedgingReactor.address)
				expect(await exchange.sellRedemptions()).to.equal(true)
			})
			it("SUCCEEDS: set pool fee", async () => {
				await exchange.setPoolFee(senderAddress, 1000)
				expect(await exchange.poolFees(senderAddress)).to.equal(1000)
			})
			it("REVERTS: set pool fee when non governance calls", async () => {
				await expect(exchange.connect(signers[1]).setPoolFee(senderAddress, 0)).to.be.revertedWith("UNAUTHORIZED()")
				await exchange.setPoolFee(senderAddress, 0)
				expect(await exchange.poolFees(senderAddress)).to.equal(0)
			})
			it("SUCCEEDS: update just returns 0", async () => {
				const update = await exchange.callStatic.update()
				expect(update).to.equal(0)
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
