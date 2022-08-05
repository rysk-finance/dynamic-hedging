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
	scaleNum
} from "../utils/conversion-helper"
import moment from "moment"
//@ts-ignore
import bs from "black-scholes"
import { deployOpyn } from "../utils/opyn-deployer"
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import { UniswapV3HedgingReactor } from "../types/UniswapV3HedgingReactor"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { AlphaPortfolioValuesFeed } from "../types/AlphaPortfolioValuesFeed"
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
	getBlackScholesQuote,
	increaseTo,
	setOpynOracleExpiryPrice,
	calculateOptionDeltaLocally
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
import { deployLiquidityPool, deploySystem } from "../utils/alpha-system-deployer"
import { ERC20Interface } from "../types/ERC20Interface"
import { AlphaOptionHandler } from "../types/AlphaOptionHandler"
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
let portfolioValuesFeed: AlphaPortfolioValuesFeed
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
let handler: AlphaOptionHandler
let authority: string

const IMPLIED_VOL = "60"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

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
const liquidityPoolUsdcDeposit = "600000"
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

let noOfExpiries = 10
let noOfStrikes = 5

/* --- end variables to change --- */
const expiration2 = moment.utc(expiryDate).add(1, "w").add(8, "h").valueOf() / 1000 // have another batch of options exire 1 week after the first
const invalidExpirationLong = moment.utc(invalidExpiryDateLong).add(8, "h").valueOf() / 1000
const invalidExpirationShort = moment.utc(invalidExpiryDateShort).add(8, "h").valueOf() / 1000

const CALL_FLAVOR = false
const PUT_FLAVOR = true
let predictedQuote = BigNumber.from(0);
let predictedDelta = BigNumber.from(0);

describe("APVF gas tests", async () => {
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
		const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_WHALE]
		})
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		await usdWhaleConnect.transfer(senderAddress, toUSDC("1000000"))
		await usdWhaleConnect.transfer(receiverAddress, toUSDC("1000000"))
	})
	it("SETUP: make all settings lenient", async () => {
		await portfolioValuesFeed.setHandler(senderAddress, true)
		await handler.setCustomOrderBounds(0, toWei("1"), toWei("-1"), 0, 10000)
		await liquidityPool.setNewOptionParams(0, toWei("100000"), 0, toWei("100000"), 0, 10000000000)
	})
	describe("Spin up a bunch of options and try a fulfill", async () => {
		it("SETUP: Spin up a bunch of options", async () => {
			const amount = toWei("2")
			const orderExpiry = 10
			let expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000
			let n = 0;
			for (let i = 0; i < noOfExpiries; i++) {
				// get a new expiry
				expiration += 3*24*60*60
				// set the option type
				const flavour = i & 1 ? true : false
				let strike = await priceFeed.getNormalizedRate(weth.address, usd.address)
				for (let j = 0; j < noOfStrikes; j ++) {
					strike = strike.add(toWei("10"))
					const proposedSeries = {
						expiration: expiration,
						strike: BigNumber.from(strike),
						isPut: flavour,
						strikeAsset: usd.address,
						underlying: weth.address,
						collateral: usd.address
					}
					const orderId = await handler.callStatic.createOrder(proposedSeries,amount,toWei("1"),orderExpiry,receiverAddress,false,[toWei("1"), toWei("1")])
					await handler.createOrder(proposedSeries,amount,toWei("1"),orderExpiry,receiverAddress,false,[toWei("1"), toWei("1")])
					const order = await handler.orderStores(orderId)
					const convertedSeries = {
						expiration: Number(order.optionSeries.expiration),
						strike: order.optionSeries.strike.mul(oTokenDecimalShift18),
						isPut: order.optionSeries.isPut,
						strikeAsset: order.optionSeries.strikeAsset,
						underlying: order.optionSeries.underlying,
						collateral: order.optionSeries.collateral
					}
					// update the stores on the pvFeed
					await portfolioValuesFeed.updateStores(convertedSeries, order.amount, 0, order.seriesAddress)
					// check the options are properly set
					const stores = await portfolioValuesFeed.storesForAddress(order.seriesAddress)
					expect(stores.optionSeries.expiration).to.equal(order.optionSeries.expiration)
					expect(stores.optionSeries.isPut).to.equal(order.optionSeries.isPut)	
					expect(stores.optionSeries.strike).to.equal(convertedSeries.strike)		
					expect(stores.shortExposure).to.equal(order.amount)
					expect(stores.longExposure).to.equal(0)
					expect(await portfolioValuesFeed.addressSetLength()).to.equal(n+1)
					expect(await portfolioValuesFeed.addressAtIndexInSet(n)).to.equal(order.seriesAddress)
					expect(await portfolioValuesFeed.isAddressInSet(order.seriesAddress)).to.be.true
					predictedDelta = predictedDelta.add(await calculateOptionDeltaLocally(liquidityPool, priceFeed, convertedSeries, amount, true))
					predictedQuote = predictedQuote.add((toWei((await getBlackScholesQuote(liquidityPool, optionRegistry, usd, priceFeed, convertedSeries, amount, false)).toString())))
					n += 1
				}
			}
		})
		it("SUCCEEDS: Calls fulfill on the options", async () => {
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pVs = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			expect(tFormatEth(pVs.delta) - tFormatEth(predictedDelta)).to.be.within(-0.1, 0.1)
			expect(tFormatEth(pVs.callPutsValue) - tFormatEth(predictedQuote)).to.be.within(-0.5, 0.5)
		})
	})
	describe("Try a migration with all the options", async () => {
		let migratePortfolioValuesFeed: AlphaPortfolioValuesFeed;
		it("SETUP: Make a new portfolio values feed", async () => {
			const normDistFactory = await ethers.getContractFactory("NormalDist", {
				libraries: {}
			})
			const normDist = await normDistFactory.deploy()
			const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
				libraries: {
					NormalDist: normDist.address
				}
			})
			const blackScholesDeploy = await blackScholesFactory.deploy()
			const portfolioValuesFeedFactory = await ethers.getContractFactory("AlphaPortfolioValuesFeed", {
				libraries: {
					BlackScholes: blackScholesDeploy.address
				}
			})
			migratePortfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
				authority,
			)) as AlphaPortfolioValuesFeed
			await migratePortfolioValuesFeed.setHandler(portfolioValuesFeed.address, true)
			await migratePortfolioValuesFeed.setLiquidityPool(liquidityPool.address)
			await migratePortfolioValuesFeed.setProtocol(optionProtocol.address)
		})
		it("SUCCEEDS: Tries to migrate to a new portfolio values feed", async () => {
			const originalLength = await portfolioValuesFeed.addressSetLength()
			await portfolioValuesFeed.migrate(migratePortfolioValuesFeed.address)
			const newLength = await migratePortfolioValuesFeed.addressSetLength()
			expect(originalLength).to.equal(newLength)
		})
		it("SUCCEEDS: Checks the new fulfill are the same as the old fulfill", async () => {
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pVs = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			await optionProtocol.changePortfolioValuesFeed(migratePortfolioValuesFeed.address)
			await migratePortfolioValuesFeed.fulfill(weth.address, usd.address)
			const mpVs = await migratePortfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			expect(tFormatEth(pVs.delta) - tFormatEth(mpVs.delta)).to.be.within(-0.1, 0.1)
			expect(tFormatEth(pVs.callPutsValue) - tFormatEth(mpVs.callPutsValue)).to.be.within(-0.1, 0.1)
		})
		it("SETUP: reconfigure original portfolio values feed", async () => {
			await optionProtocol.changePortfolioValuesFeed(portfolioValuesFeed.address)
		})
	})
	describe("Expire some of the options and try a clean", async () => {
		it("SETUP: fastforward 3 days so options have expired", async () => {
			const addressAtIndex0 = await portfolioValuesFeed.addressAtIndexInSet(0)
			const ffExpiration = (await portfolioValuesFeed.storesForAddress(addressAtIndex0)).optionSeries.expiration
			increaseTo(ffExpiration.add(100))
		})
		it("SUCCEEDS: Cleans one expired option manually", async () => {
			const originalLength = await portfolioValuesFeed.addressSetLength()
			const addressAtIndex0 = await portfolioValuesFeed.addressAtIndexInSet(0)
			await portfolioValuesFeed.cleanLooperManually(addressAtIndex0)
			const newLength = await portfolioValuesFeed.addressSetLength()
			expect(originalLength.sub(1)).to.equal(newLength)
			expect(await portfolioValuesFeed.isAddressInSet(addressAtIndex0)).to.be.false
		})
		it("FAILS: Cleans one expired option manually with incorrect address", async () => {
			await expect(portfolioValuesFeed.cleanLooperManually(optionRegistry.address)).to.be.revertedWith("IncorrectSeriesToRemove()")
		})
		it("FAILS: Cleans one option that is not expired", async () => {
			const addressAtIndex30 = await portfolioValuesFeed.addressAtIndexInSet(30)
			await expect(portfolioValuesFeed.cleanLooperManually(addressAtIndex30)).to.be.revertedWith("SeriesNotExpired()")
		})
		it("SUCCEEDS: Cleans all expired options", async () => {
			const originalLength = await portfolioValuesFeed.addressSetLength()
			await portfolioValuesFeed.syncLooper()
			const newLength = await portfolioValuesFeed.addressSetLength()
			expect(originalLength.sub(noOfStrikes - 1)).to.equal(newLength)
		})
	})
	describe("Expire some of the options at the end and try a clean", async () => {
		it("SETUP: writes some options at the end of the array that expire soon", async () => {
			const amount = toWei("2")
			const orderExpiry = 10
			let expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000 + 6*60*60*24
			// set the option type
			const flavour = CALL_FLAVOR
			let strike = await priceFeed.getNormalizedRate(weth.address, usd.address)
			for (let j = 0; j < noOfStrikes; j ++) {
				const storeLengthBefore = await portfolioValuesFeed.addressSetLength()
				strike = strike.add(toWei("150"))
				const proposedSeries = {
					expiration: expiration,
					strike: BigNumber.from(strike),
					isPut: flavour,
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: usd.address
				}
				const orderId = await handler.callStatic.createOrder(proposedSeries,amount,toWei("1"),orderExpiry,receiverAddress,false,[toWei("1"), toWei("1")])
				await handler.createOrder(proposedSeries,amount,toWei("1"),orderExpiry,receiverAddress,false,[toWei("1"), toWei("1")])
				const order = await handler.orderStores(orderId)
				const convertedSeries = {
					expiration: Number(order.optionSeries.expiration),
					strike: order.optionSeries.strike.mul(oTokenDecimalShift18),
					isPut: order.optionSeries.isPut,
					strikeAsset: order.optionSeries.strikeAsset,
					underlying: order.optionSeries.underlying,
					collateral: order.optionSeries.collateral
				}
				// update the stores on the pvFeed
				await portfolioValuesFeed.updateStores(convertedSeries, order.amount, 0, order.seriesAddress)
				// check the options are properly set
				const stores = await portfolioValuesFeed.storesForAddress(order.seriesAddress)
				expect(stores.optionSeries.expiration).to.equal(order.optionSeries.expiration)
				expect(stores.optionSeries.isPut).to.equal(order.optionSeries.isPut)	
				expect(stores.optionSeries.strike).to.equal(convertedSeries.strike)		
				expect(stores.shortExposure).to.equal(order.amount)
				expect(stores.longExposure).to.equal(0)
				expect(await portfolioValuesFeed.addressSetLength()).to.equal(storeLengthBefore.add(1))
				expect(await portfolioValuesFeed.addressAtIndexInSet(storeLengthBefore)).to.equal(order.seriesAddress)
				expect(await portfolioValuesFeed.isAddressInSet(order.seriesAddress)).to.be.true
				}
		})
		it("SETUP: increments option series already stored", async () => {
			const amount = toWei("2")
			const orderExpiry = 10
			let expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000 + 6*60*60*24
			// set the option type
			const flavour = CALL_FLAVOR
			let strike = await priceFeed.getNormalizedRate(weth.address, usd.address)
			for (let j = 0; j < noOfStrikes; j ++) {
				const storeLengthBefore = await portfolioValuesFeed.addressSetLength()
				strike = strike.add(toWei("150"))
				const proposedSeries = {
					expiration: expiration,
					strike: BigNumber.from(strike),
					isPut: flavour,
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: usd.address
				}
				const orderId = await handler.callStatic.createOrder(proposedSeries,amount,toWei("1"),orderExpiry,receiverAddress,false,[toWei("1"), toWei("1")])
				await handler.createOrder(proposedSeries,amount,toWei("1"),orderExpiry,receiverAddress,false,[toWei("1"), toWei("1")])
				const order = await handler.orderStores(orderId)
				const convertedSeries = {
					expiration: Number(order.optionSeries.expiration),
					strike: order.optionSeries.strike.mul(oTokenDecimalShift18),
					isPut: order.optionSeries.isPut,
					strikeAsset: order.optionSeries.strikeAsset,
					underlying: order.optionSeries.underlying,
					collateral: order.optionSeries.collateral
				}
				// update the stores on the pvFeed
				await portfolioValuesFeed.updateStores(convertedSeries, order.amount, 0, order.seriesAddress)
				// check the options are properly set
				const stores = await portfolioValuesFeed.storesForAddress(order.seriesAddress)
				expect(stores.optionSeries.expiration).to.equal(order.optionSeries.expiration)
				expect(stores.optionSeries.isPut).to.equal(order.optionSeries.isPut)	
				expect(stores.optionSeries.strike).to.equal(convertedSeries.strike)		
				expect(stores.shortExposure).to.equal(order.amount.mul(2))
				expect(stores.longExposure).to.equal(0)
				expect(await portfolioValuesFeed.addressSetLength()).to.equal(storeLengthBefore)
				expect(await portfolioValuesFeed.isAddressInSet(order.seriesAddress)).to.be.true
				}
		})
		it("SETUP: fastforward 3 days so options have expired", async () => {
			const storeLengthBefore = await portfolioValuesFeed.addressSetLength()
			const addressAtIndexLast = await portfolioValuesFeed.addressAtIndexInSet(storeLengthBefore.sub(1))
			const ffExpiration = (await portfolioValuesFeed.storesForAddress(addressAtIndexLast)).optionSeries.expiration
			increaseTo(ffExpiration.add(100))
		})
		it("SUCCEEDS: Cleans all expired options", async () => {
			const originalLength = await portfolioValuesFeed.addressSetLength()
			await portfolioValuesFeed.syncLooper()
			const newLength = await portfolioValuesFeed.addressSetLength()
			expect(originalLength.sub(noOfStrikes*2)).to.equal(newLength)
		})
	})
	describe("Expire some of the options and try a fulfill without first cleaning", async () => {
		it("SETUP: fastforward 3 days so options have expired", async () => {
			const storeLengthBefore = await portfolioValuesFeed.addressSetLength()
			const addressAtIndexLast = await portfolioValuesFeed.addressAtIndexInSet(10)
			const ffExpiration = (await portfolioValuesFeed.storesForAddress(addressAtIndexLast)).optionSeries.expiration
			increaseTo(ffExpiration.add(100))
		})
		it("FAILS: Fulfill fails because of expired options not cleaned", async () => {
			await expect(portfolioValuesFeed.fulfill(weth.address, usd.address)).to.be.revertedWith('OptionHasExpiredInStores(10, "0x46C14EE9ACF2872F80b5b1242C70AF2CFE4c862C")')
		})
		it("SUCCEEDS: Cleans all expired options", async () => {
			const originalLength = await portfolioValuesFeed.addressSetLength()
			await portfolioValuesFeed.syncLooper()
			const newLength = await portfolioValuesFeed.addressSetLength()
			expect(originalLength.sub(noOfStrikes)).to.equal(newLength)
		})
		it("SUCCEEDS: Fulfills correctly", async () => {
			const addressSet = await portfolioValuesFeed.getAddressSet()
			predictedDelta = BigNumber.from(0)
			predictedQuote = BigNumber.from(0)
			for (let i = 0; i < addressSet.length; i++) {
				const stores = await portfolioValuesFeed.storesForAddress(addressSet[i])
				const proposedSeries = {
					expiration: Number(stores.optionSeries.expiration),
					strike: stores.optionSeries.strike,
					isPut: stores.optionSeries.isPut,
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: usd.address
				}
				predictedDelta = predictedDelta.add(await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries, stores.shortExposure, true))
				predictedQuote = predictedQuote.add((toWei((await getBlackScholesQuote(liquidityPool, optionRegistry, usd, priceFeed, proposedSeries, stores.shortExposure, false)).toString())))
			}
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pVs = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			expect(tFormatEth(pVs.delta) - tFormatEth(predictedDelta)).to.be.within(-0.1, 0.1)
			expect(tFormatEth(pVs.callPutsValue) - tFormatEth(predictedQuote)).to.be.within(-0.1, 0.1)
		})
	})
	describe("Reduce the short exposure on a series and check fulfill", async () => {
		it("SUCCEEDS: reduces the short exposure on a series and checks the fulfill", async () => {
			const addy = await portfolioValuesFeed.addressAtIndexInSet(10)
			const shortExposureChange = toWei("-0.5")
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pv = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			const pvDeltaBefore = pv.delta
			const pvValueBefore = pv.callPutsValue
			const storesBefore = await portfolioValuesFeed.storesForAddress(addy)
			const proposedSeries = {
				expiration: Number(storesBefore.optionSeries.expiration),
				strike: storesBefore.optionSeries.strike,
				isPut: storesBefore.optionSeries.isPut,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const expectedDeltaDiff = await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries, shortExposureChange, true)
			const expectedValueDiff =  (toWei((await getBlackScholesQuote(liquidityPool, optionRegistry, usd, priceFeed, proposedSeries, shortExposureChange, false)).toString()))
			await portfolioValuesFeed.updateStores(storesBefore.optionSeries, shortExposureChange, 0, addy)
			const storesAfter = await portfolioValuesFeed.storesForAddress(addy)
			expect(storesAfter.shortExposure).to.equal(storesBefore.shortExposure.add(shortExposureChange))
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pVs = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			expect(tFormatEth(pVs.delta) - tFormatEth(pvDeltaBefore.add(expectedDeltaDiff))).to.be.within(-0.1, 0.1)
			expect(tFormatEth(pVs.callPutsValue) - tFormatEth(pvValueBefore.add(expectedValueDiff))).to.be.within(-0.1, 0.1)
		})
	})
	describe("Add long exposure and check fulfill", async () => {

		it("SUCCEEDS: increases the long exposure on a series and checks the fulfill", async () => {
			const addy = await portfolioValuesFeed.addressAtIndexInSet(10)
			const longExposureChange = toWei("0.5")
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pv = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			const pvDeltaBefore = pv.delta
			const pvValueBefore = pv.callPutsValue
			const storesBefore = await portfolioValuesFeed.storesForAddress(addy)
			const proposedSeries = {
				expiration: Number(storesBefore.optionSeries.expiration),
				strike: storesBefore.optionSeries.strike,
				isPut: storesBefore.optionSeries.isPut,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const expectedDeltaDiff = await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries, longExposureChange, true)
			const expectedValueDiff =  (toWei((await getBlackScholesQuote(liquidityPool, optionRegistry, usd, priceFeed, proposedSeries, longExposureChange, false)).toString()))
			await portfolioValuesFeed.updateStores(storesBefore.optionSeries, 0, longExposureChange, addy)
			const storesAfter = await portfolioValuesFeed.storesForAddress(addy)
			expect(storesAfter.shortExposure).to.equal(storesBefore.shortExposure)
			expect(storesAfter.longExposure).to.equal(storesBefore.longExposure.add(longExposureChange))
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pVs = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			expect(tFormatEth(pVs.delta) - tFormatEth(pvDeltaBefore.sub(expectedDeltaDiff))).to.be.within(-0.1, 0.1)
			expect(tFormatEth(pVs.callPutsValue) - tFormatEth(pvValueBefore.sub(expectedValueDiff))).to.be.within(-0.1, 0.1)
		})
		it("SETUP: removes all short from index 10", async () => {
			const addy = await portfolioValuesFeed.addressAtIndexInSet(10)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pv = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			const pvDeltaBefore = pv.delta
			const pvValueBefore = pv.callPutsValue
			const storesBefore = await portfolioValuesFeed.storesForAddress(addy)
			const shortExposureChange = storesBefore.shortExposure
			const formattedExposureChange = toWei((-tFormatEth(storesBefore.shortExposure)).toString())
			const proposedSeries = {
				expiration: Number(storesBefore.optionSeries.expiration),
				strike: storesBefore.optionSeries.strike,
				isPut: storesBefore.optionSeries.isPut,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const expectedDeltaDiff = await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries, shortExposureChange, true)
			const expectedValueDiff =  (toWei((await getBlackScholesQuote(liquidityPool, optionRegistry, usd, priceFeed, proposedSeries, shortExposureChange, false)).toString()))
			await portfolioValuesFeed.updateStores(storesBefore.optionSeries, formattedExposureChange, 0, addy)
			const storesAfter = await portfolioValuesFeed.storesForAddress(addy)
			expect(storesAfter.shortExposure).to.equal(0)
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			const pVs = await portfolioValuesFeed.getPortfolioValues(weth.address, usd.address)
			expect(tFormatEth(pVs.delta) - tFormatEth(pvDeltaBefore.sub(expectedDeltaDiff))).to.be.within(-0.1, 0.1)
			expect(tFormatEth(pVs.callPutsValue) - tFormatEth(pvValueBefore.sub(expectedValueDiff))).to.be.within(-0.1, 0.1)
		})
		it("REVERTS: cant account liquidated series with no short", async () => {
			const addy = await portfolioValuesFeed.addressAtIndexInSet(10)
			await expect(portfolioValuesFeed.accountLiquidatedSeries(addy)).to.be.revertedWith("NoShortPositions()")
		})
		it("REVERTS: cant account with no vault", async () => {
			const addy = await portfolioValuesFeed.addressAtIndexInSet(9)
			await expect(portfolioValuesFeed.accountLiquidatedSeries(addy)).to.be.revertedWith("NoVaultForShortPositions()")
		})
	})
	describe("Access Control checks", async () => {
		it("SUCCEEDS: set liquidity pool", async () => {
			await portfolioValuesFeed.setLiquidityPool(optionRegistry.address)
			expect(await portfolioValuesFeed.liquidityPool()).to.equal(optionRegistry.address)
		})
		it("FAILS: set liquidity pool when not approved", async () => {
			await expect(portfolioValuesFeed.connect(signers[1]).setLiquidityPool(optionRegistry.address)).to.be.revertedWith("UNAUTHORIZED()")
		})
		it("SUCCEEDS: set protocol", async () => {
			await portfolioValuesFeed.setProtocol(optionRegistry.address)
			expect(await portfolioValuesFeed.protocol()).to.equal(optionRegistry.address)
		})
		it("FAILS: set protocol when not approved", async () => {
			await expect(portfolioValuesFeed.connect(signers[1]).setProtocol(optionRegistry.address)).to.be.revertedWith("UNAUTHORIZED()")
		})
		it("SUCCEEDS: set rfr", async () => {
			await portfolioValuesFeed.setRFR(0)
			expect(await portfolioValuesFeed.rfr()).to.equal(0)
		})
		it("FAILS: set rfr when not approved", async () => {
			await expect(portfolioValuesFeed.connect(signers[1]).setRFR(0)).to.be.revertedWith("UNAUTHORIZED()")
		})
		it("SUCCEEDS: set keeper", async () => {
			await portfolioValuesFeed.setKeeper(optionRegistry.address, true)
			expect(await portfolioValuesFeed.keeper(optionRegistry.address)).to.be.true
		})
		it("SUCCEEDS: remove keeper", async () => {
			await portfolioValuesFeed.setKeeper(optionRegistry.address, false)
			expect(await portfolioValuesFeed.keeper(optionRegistry.address)).to.be.false
		})
		it("FAILS: set keeper when not approved", async () => {
			await expect(portfolioValuesFeed.connect(signers[1]).setKeeper(optionRegistry.address, true)).to.be.revertedWith("UNAUTHORIZED()")
		})
		it("SUCCEEDS: set handler", async () => {
			await portfolioValuesFeed.setHandler(optionRegistry.address, true)
			expect(await portfolioValuesFeed.handler(optionRegistry.address)).to.be.true
		})
		it("SUCCEEDS: remove handler", async () => {
			await portfolioValuesFeed.setHandler(optionRegistry.address, false)
			expect(await portfolioValuesFeed.handler(optionRegistry.address)).to.be.false
		})
		it("FAILS: set keeper when not approved", async () => {
			await expect(portfolioValuesFeed.connect(signers[1]).setHandler(optionRegistry.address, true)).to.be.reverted
		})
		it("FAILS: update stores if not handler", async () => {
			const proposedSeries = {
				expiration: expiration2,
				strike: BigNumber.from(strike),
				isPut: PUT_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			await expect(portfolioValuesFeed.connect(signers[1]).updateStores(proposedSeries, BigNumber.from(100), 0, optionRegistry.address)).to.be.reverted
		})
		it("FAILS: sync looper if not handler", async () => {
			await expect(portfolioValuesFeed.connect(signers[1]).syncLooper()).to.be.revertedWith("NotKeeper()")
		})
		it("FAILS: clean looper manually if not handler", async () => {
			await expect(portfolioValuesFeed.connect(signers[1]).cleanLooperManually(optionRegistry.address)).to.be.revertedWith("NotKeeper()")
		})
		it("FAILS: migration if not governance", async () => {
			await expect(portfolioValuesFeed.connect(signers[1]).migrate(portfolioValuesFeed.address)).to.be.revertedWith("UNAUTHORIZED")
		})
	})
})
