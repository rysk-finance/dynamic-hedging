import hre, { ethers, network } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber, providers } from "ethers"
import {
	toWei,
	truncate,
	tFormatEth,
	fromWei,
	percentDiff,
	toUSDC,
	fromOpyn,
	toOpyn,
	tFormatUSDC,
	scaleNum,
	fromUSDC
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
import { waitForDebugger } from "inspector"
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
let authority: string

const IMPLIED_VOL = "60"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

const invalidExpiryDateLong: string = "2022-04-22"
const invalidExpiryDateShort: string = "2022-03-01"
// decimal representation of a percentage
const rfr: string = "0.03"
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
const maxExpiry = 86400 * 50

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

/* --- end variables to change --- */

const expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000
const expiration2 = moment.utc(expiryDate).add(1, "w").add(8, "h").valueOf() / 1000 // have another batch of options exire 1 week after the first
const invalidExpirationLong = moment.utc(invalidExpiryDateLong).add(8, "h").valueOf() / 1000
const invalidExpirationShort = moment.utc(invalidExpiryDateShort).add(8, "h").valueOf() / 1000

const CALL_FLAVOR = false
const PUT_FLAVOR = true

let users
let maliciousLiquidityProvider: Signer
let maliciousProviderAddress: string

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
		handler = lpParams.handler
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_WHALE]
		})
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		await usdWhaleConnect.transfer(senderAddress, toUSDC("1000000"))
		await usdWhaleConnect.transfer(receiverAddress, toUSDC("1000000"))
	})
	it("10 users each deposit $10000", async () => {
		users = await (await ethers.getSigners()).slice(0, 10)
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		for (let i = 0; i < users.length; i++) {
			usdWhaleConnect.transfer(users[i].address, toUSDC("10000"))
			const approveTx = await usd.connect(users[i]).approve(liquidityPool.address, toUSDC("10000"))
			await approveTx.wait()
			const balance = await usd.balanceOf(users[i].address)
			const depositTx = await liquidityPool.connect(users[i]).deposit(toUSDC("10000"))
			await depositTx.wait()
		}

		const pendingDeposits = await liquidityPool.pendingDeposits()
		expect(pendingDeposits).to.eq(toUSDC("100000"))
	})
	it("pauses trading and executes epoch", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("1"),
			weth.address,
			usd.address,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(priceQuote)
		)
		const epochBefore = await liquidityPool.epoch()
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await liquidityPool.executeEpochCalculation()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		expect(await liquidityPool.epochPricePerShare(epochBefore)).to.equal(toWei("1"))
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.epoch()).to.equal(epochBefore.add(1))
		expect(pendingDepositBefore.mul(collatDecimalShift)).to.equal(lplpBalanceAfter)
	})
	let customOrderPriceCall: number
	let customOrderPricePut: number
	let customStranglePrice: number
	let strangleCallId: number
	let stranglePutId: number
	let strangleCallToken: IOToken
	let stranglePutToken: IOToken
	it("sells a strangle custom option", async () => {
		let customOrderPriceMultiplier = 1
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const orderIdBefore = await handler.orderIdCounter()
		const strikePriceCall = priceQuote.add(toWei("1400"))
		const strikePricePut = priceQuote.sub(toWei("900"))
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)

		const amount = toWei("25")
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
			optionRegistry,
			usd,
			priceFeed,
			proposedSeriesCall,
			amount
		)
		const localQuotePut = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
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

		const expectedCollateralAllocatedCall = await optionRegistry.getCollateral(
			{
				expiration: proposedSeriesCall.expiration,
				isPut: proposedSeriesCall.isPut,
				strike: proposedSeriesCall.strike.div(10 ** 10), // convert to 1e8 for getCollateral
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			},
			amount
		)
		const expectedCollateralAllocatedPut = await optionRegistry.getCollateral(
			{
				expiration: proposedSeriesPut.expiration,
				isPut: proposedSeriesPut.isPut,
				strike: proposedSeriesPut.strike.div(10 ** 10), // convert to 1e8 for getCollateral
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			},
			amount
		)

		const expectedCollateralAllocated = expectedCollateralAllocatedCall.add(
			expectedCollateralAllocatedPut
		)
		console.log({ expectedCollateralAllocated })

		const receipt = await createStrangle.wait()
		const events = receipt.events
		const createOrderEvents = events?.filter(x => x.event == "OrderCreated") as any
		expect(createOrderEvents?.length).to.eq(2)
		expect(parseInt(createOrderEvents[0].args?.orderId) + 1).to.eq(createOrderEvents[1].args?.orderId)
		strangleCallId = createOrderEvents[0].args?.orderId
		stranglePutId = createOrderEvents[1].args?.orderId
		const callOrder = await handler.orderStores(strangleCallId)
		const putOrder = await handler.orderStores(stranglePutId)
		strangleCallToken = new Contract(callOrder.seriesAddress, Otoken.abi, sender) as IOToken
		stranglePutToken = new Contract(putOrder.seriesAddress, Otoken.abi, sender) as IOToken
		const orderIdAfter = await handler.orderIdCounter()
		const lpUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)

		// check order details are correct
		expect(callOrder.optionSeries.isPut).to.be.false
		expect(putOrder.optionSeries.isPut).to.be.true
		// check expiries are the same
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
		// check order ID increases by 2
		expect(orderIdAfter).to.eq(orderIdBefore.add(2))
		// balances are unchanged
		expect(lpUSDBalanceBefore).to.eq(lpUSDBalanceAfter)
	})
	it("custom order receiver executes strangle order", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const receiverOTokenBalBef = (await strangleCallToken.balanceOf(receiverAddress)).add(
			await stranglePutToken.balanceOf(receiverAddress)
		)
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const receiverUSDBalBefore = await usd.balanceOf(receiverAddress)
		const deltaBefore = tFormatEth(await liquidityPool.getPortfolioDelta())
		const ephemeralDeltaBefore = await liquidityPool.ephemeralDelta()
		const ephemeralLiabilitiesBefore = await liquidityPool.ephemeralLiabilities()

		const orderDeets1 = await handler.orderStores(strangleCallId)
		const orderDeets2 = await handler.orderStores(stranglePutId)
		const prevalues = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
		const localDelta1 = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: orderDeets1.optionSeries.expiration.toNumber(),
				strike: orderDeets1.optionSeries.strike.mul(10 ** 10),
				isPut: orderDeets1.optionSeries.isPut,
				underlying: orderDeets1.optionSeries.underlying,
				strikeAsset: orderDeets1.optionSeries.strikeAsset,
				collateral: orderDeets1.optionSeries.collateral
			},
			orderDeets1.amount,
			true
		)
		const localQuote1 = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			{
				expiration: orderDeets1.optionSeries.expiration.toNumber(),
				strike: orderDeets1.optionSeries.strike.mul(10 ** 10),
				isPut: orderDeets1.optionSeries.isPut,
				underlying: orderDeets1.optionSeries.underlying,
				strikeAsset: orderDeets1.optionSeries.strikeAsset,
				collateral: orderDeets1.optionSeries.collateral
			},
			orderDeets1.amount,
			false
		)
		const localDelta2 = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: orderDeets2.optionSeries.expiration.toNumber(),
				strike: orderDeets2.optionSeries.strike.mul(10 ** 10),
				isPut: orderDeets2.optionSeries.isPut,
				underlying: orderDeets2.optionSeries.underlying,
				strikeAsset: orderDeets2.optionSeries.strikeAsset,
				collateral: orderDeets2.optionSeries.collateral
			},
			orderDeets2.amount,
			true
		)
		const localQuote2 = await calculateOptionQuoteLocally(
			liquidityPool,
			optionRegistry,
			usd,
			priceFeed,
			{
				expiration: orderDeets2.optionSeries.expiration.toNumber(),
				strike: orderDeets2.optionSeries.strike.mul(10 ** 10),
				isPut: orderDeets2.optionSeries.isPut,
				underlying: orderDeets2.optionSeries.underlying,
				strikeAsset: orderDeets2.optionSeries.strikeAsset,
				collateral: orderDeets2.optionSeries.collateral
			},
			orderDeets2.amount,
			false
		)
		const localDelta = localDelta1.add(localDelta2)
		const localQuote = localQuote1 + localQuote2

		console.log({ localQuote1, localQuote2 })
		await usd.connect(receiver).approve(handler.address, toUSDC("10000000"))
		await handler.connect(receiver).executeStrangle(strangleCallId, stranglePutId)

		// check ephemeral values update correctly
		const ephemeralLiabilitiesDiff =
			tFormatEth(await liquidityPool.ephemeralLiabilities()) - tFormatEth(ephemeralLiabilitiesBefore)
		const ephemeralDeltaDiff =
			tFormatEth(await liquidityPool.ephemeralDelta()) - tFormatEth(ephemeralDeltaBefore)
		expect(ephemeralDeltaDiff - tFormatEth(localDelta)).to.be.within(-0.01, 0.01)

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

		// expect ephemeral values to be reset
		expect(await liquidityPool.ephemeralDelta()).to.eq(0)
		expect(await liquidityPool.ephemeralLiabilities()).to.eq(0)
		const receiverUSDBalAfter = await usd.balanceOf(receiverAddress)
		const receiverOTokenBalAfter = (await strangleCallToken.balanceOf(receiverAddress)).add(
			await stranglePutToken.balanceOf(receiverAddress)
		)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const collateralAllocatedDiff = tFormatUSDC(
			collateralAllocatedAfter.sub(collateralAllocatedBefore)
		)
		const lpOTokenBalAfter = (await strangleCallToken.balanceOf(liquidityPool.address)).add(
			await stranglePutToken.balanceOf(liquidityPool.address)
		)
		const lpUSDBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const deltaAfter = tFormatEth(await liquidityPool.getPortfolioDelta())

		const buyerUSDBalanceDiff = receiverUSDBalBefore.sub(receiverUSDBalAfter)
		const lpUSDBalanceDiff = lpUSDBalanceAfter.sub(lpUSDBalanceBefore)

		const orderCall = await handler.orderStores(strangleCallId)
		const orderPut = await handler.orderStores(stranglePutId)
		// order should be non existant
		expect(orderPut.buyer).to.eq(ZERO_ADDRESS)
		expect(orderCall.buyer).to.eq(ZERO_ADDRESS)
		// check buyer's OToken balance increases bycoreect amount
		expect(fromOpyn(receiverOTokenBalAfter.sub(receiverOTokenBalBef).toString())).to.equal(
			fromWei(orderDeets1.amount.add(orderDeets2.amount).toString())
		)

		// liquidity pool holds no tokens
		expect(lpOTokenBalAfter).to.eq(0)

		// check buyer's USDC balance decreases by expected amount
		expect(
			receiverUSDBalBefore
				.sub(receiverUSDBalAfter)
				.sub(BigNumber.from(Math.floor(customStranglePrice * 10 ** 6).toString()))
		).to.be.within(-1, 1)

		expect(
			tFormatUSDC(buyerUSDBalanceDiff) -
				(parseFloat(fromWei(orderDeets1.amount)) * tFormatEth(orderDeets1.price) +
					parseFloat(fromWei(orderDeets2.amount)) * tFormatEth(orderDeets2.price))
		).to.be.within(-0.03, 0.03)
		// check delta changes by expected amount
		expect(deltaAfter.toPrecision(3)).to.eq((deltaBefore + tFormatEth(localDelta)).toPrecision(3))
	})
	it("malicious entity deposits liquidity at high utilisation", async () => {
		maliciousLiquidityProvider = (await ethers.getSigners())[10]
		maliciousProviderAddress = await maliciousLiquidityProvider.getAddress()

		// send USDC to our malicious LP
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		usdWhaleConnect.transfer(maliciousProviderAddress, toUSDC("100000"))

		const approveTx = await usd
			.connect(maliciousLiquidityProvider)
			.approve(liquidityPool.address, toUSDC("100000"))
		await approveTx.wait()
		const depositTx = await liquidityPool.connect(maliciousLiquidityProvider).deposit(toUSDC("50000"))
		await depositTx.wait()
	})
	it("pauses trading and executes epoch again", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		console.log({ customStranglePrice })
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(toWei(customStranglePrice.toString())),
			BigNumber.from(priceQuote)
		)
		const epochBefore = await liquidityPool.epoch()
		await liquidityPool.executeEpochCalculation()
		const NAV = await liquidityPool.getNAV()
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.epoch()).to.equal(epochBefore.add(1))

		const redeemTx = await liquidityPool.connect(maliciousLiquidityProvider).redeem(2 * 256 - 1)
		await redeemTx.wait()

		const lpShares = await liquidityPool.balanceOf(maliciousProviderAddress)
	})
	it("settles OTM expired vaults", async () => {
		expect(await liquidityPool.collateralAllocated()).to.not.eq(0)
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// set expiry price so both legs expire OTM
		await setOpynOracleExpiryPrice(
			WETH_ADDRESS[chainId],
			oracle,
			expiration,
			toOpyn(fromWei(priceQuote.toString()))
		)
		// settle both vaults
		await liquidityPool.settleVault(strangleCallToken.address)
		await liquidityPool.settleVault(stranglePutToken.address)
		// there should be no more outstanding options
		expect(await liquidityPool.collateralAllocated()).to.eq(0)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(priceQuote)
		)
		const NAV = await liquidityPool.getNAV()
	})
	it("malicious liquidity provider withdraws funds", async () => {
		const usdcBalanceBefore = await usd.balanceOf(maliciousProviderAddress)
		// claim LP shares first
		const unredeemedShares = (await liquidityPool.depositReceipts(maliciousProviderAddress))
			.unredeemedShares
		console.log({ unredeemedShares })
		const redeemTx = await liquidityPool.connect(maliciousLiquidityProvider).redeem(unredeemedShares)
		await redeemTx.wait()
		const lpShares = await liquidityPool.balanceOf(maliciousProviderAddress)
		// withdraw liquidity using all LP shares
		const withdrawTx = await liquidityPool
			.connect(maliciousLiquidityProvider)
			.initiateWithdraw(lpShares)
		await withdrawTx.wait()

		// execute epoch
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("3"),
			weth.address,
			usd.address,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(priceQuote)
		)
		const epochBefore = await liquidityPool.epoch()
		await liquidityPool.executeEpochCalculation()

		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.epoch()).to.equal(epochBefore.add(1))

		// complete withdrawal once epoch is calculated
		const completeWithdrawTx = await liquidityPool
			.connect(maliciousLiquidityProvider)
			.completeWithdraw(lpShares)
		await completeWithdrawTx.wait()

		// check user has no more LP shares
		const lpShares2 = await liquidityPool.balanceOf(maliciousProviderAddress)
		expect(lpShares2).to.eq(0)
		const usdcBalanceAfter = await usd.balanceOf(maliciousProviderAddress)
		// this is the amount of usdc received
		const usdcBalanceDiff = fromUSDC(usdcBalanceAfter.sub(usdcBalanceBefore))
		console.log({ usdcBalanceDiff })
	})
})
