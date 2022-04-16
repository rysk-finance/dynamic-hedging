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
//@ts-ignore
import bs from "black-scholes"
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import {deployRage, deployRangeOrder} from "../utils/rage-deployer"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { PerpHedgingReactor } from "../types/PerpHedgingReactor"
import {OracleMock} from "../types/OracleMock"
import {ClearingHouse} from "../types/ClearingHouse"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPool } from "../types/LiquidityPool"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import { Volatility } from "../types/Volatility"
import { NewController } from "../types/NewController"
import { AddressBook } from "../types/AddressBook"
import { Oracle } from "../types/Oracle"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import {
	setupTestOracle,
	setupOracle,
	calculateOptionQuoteLocally,
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
import {deployOpyn} from "../utils/opyn-deployer"
let usd: MintableERC20
let weth: WETH
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let ethLiquidityPool: LiquidityPool
let volatility: Volatility
let priceFeed: PriceFeed
let rate: string
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let putOptionToken: IOToken
let putOptionToken2: IOToken
let collateralAllocatedToVault1: BigNumber
let perpHedgingReactor: PerpHedgingReactor
let vTokenAddress : string
let vQuoteAddress : string
let rageOracle : OracleMock
let clearingHouse: ClearingHouse
let poolId: string
let settlementTokenOracle: OracleMock
let collateralId: string

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
const rfr: string = "0.03"
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
const liquidityPoolUsdcDeposit = "11000"
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

const CALL_FLAVOR = false
const PUT_FLAVOR = true

describe("Liquidity Pools hedging reactor: perps", async () => {
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

		// get the oracle
		const res = await setupTestOracle(await sender.getAddress())
		oracle = res[0] as Oracle
		opynAggregator = res[1] as MockChainlinkAggregator

	})

	it("Deploys the Option Registry", async () => {
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		// deploy libraries
		const constantsFactory = await hre.ethers.getContractFactory("Constants")
		const interactionsFactory = await hre.ethers.getContractFactory("OpynInteractions")
		const constants = await constantsFactory.deploy()
		const interactions = await interactionsFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await hre.ethers.getContractFactory("OptionRegistry", {
			libraries: {
				OpynInteractions: interactions.address
			}
		})
		// get and transfer weth
		weth = (await ethers.getContractAt(
			"contracts/interfaces/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		usd = (await ethers.getContractAt("contracts/tokens/ERC20.sol:ERC20", USDC_ADDRESS[chainId])) as MintableERC20
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		await usd.connect(signer).transfer(senderAddress, toWei("1000").div(oTokenDecimalShift18))
		await weth.deposit({ value: utils.parseEther("99") })
		const _optionRegistry = (await optionRegistryFactory.deploy(
			USDC_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId]
		)) as OptionRegistry
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")
	})
	it("Should deploy price feed", async () => {
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, usd.address, opynAggregator.address)
		await priceFeed.addPriceFeed(weth.address, usd.address, opynAggregator.address)
		// oracle returns price denominated in 1e8
		const oraclePrice = await oracle.getPrice(weth.address)
		// pricefeed returns price denominated in 1e18
		const priceFeedPrice = await priceFeed.getNormalizedRate(weth.address, usd.address)
		expect(oraclePrice.mul(10_000_000_000)).to.equal(priceFeedPrice)
	})

	it("Should deploy option protocol and link to registry/price feed", async () => {
		const protocolFactory = await ethers.getContractFactory("contracts/OptionsProtocol.sol:Protocol")
		optionProtocol = (await protocolFactory.deploy(
			optionRegistry.address,
			priceFeed.address
		)) as Protocol
		expect(await optionProtocol.optionRegistry()).to.equal(optionRegistry.address)
	})

	it("Creates a liquidity pool with USDC (erc20) as strikeAsset", async () => {
		type int7 = [
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish
		]
		type number7 = [number, number, number, number, number, number, number]
		const coefInts: number7 = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		]
		//@ts-ignore
		const coefs: int7 = coefInts.map(x => toWei(x.toString()))

		const normDistFactory = await ethers.getContractFactory("NormalDist", {
			libraries: {}
		})
		const normDist = await normDistFactory.deploy()
		const volFactory = await ethers.getContractFactory("Volatility", {
			libraries: {}
		})
		volatility = (await volFactory.deploy()) as Volatility
		const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
			libraries: {
				NormalDist: normDist.address
			}
		})
		const blackScholesDeploy = await blackScholesFactory.deploy()

		const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
			libraries: {
				BlackScholes: blackScholesDeploy.address
			}
		})
		const lp = (await liquidityPoolFactory.deploy(
			optionProtocol.address,
			usd.address,
			weth.address,
			usd.address,
			toWei(rfr),
			coefs,
			coefs,
			"ETH/USDC",
			"EDP",
			{
				minCallStrikePrice,
				maxCallStrikePrice,
				minPutStrikePrice,
				maxPutStrikePrice,
				minExpiry: minExpiry,
				maxExpiry: maxExpiry
			},
			//@ts-ignore
			await signers[0].getAddress()
		)) as LiquidityPool

		const lpAddress = lp.address
		liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
		optionRegistry.setLiquidityPool(liquidityPool.address)
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
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit), senderAddress)
		const liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const receipt = await deposit.wait(1)
		const event = receipt?.events?.find(x => x.event == "Deposit")
		const newBalance = await usd.balanceOf(senderAddress)
		expect(event?.event).to.eq("Deposit")
		expect(balance.sub(newBalance)).to.eq(toUSDC(liquidityPoolUsdcDeposit))
		expect(liquidityPoolBalance.toString()).to.eq(toWei(liquidityPoolUsdcDeposit))
	})

	it("#deploys rage", async () => {
		let rageParams = await deployRage()
		clearingHouse = rageParams.clearingHouse
		poolId = rageParams.poolId
		collateralId = rageParams.collateralId
		vQuoteAddress = rageParams.vQuoteAddress
		vTokenAddress = rageParams.vTokenAddress
		rageOracle = rageParams.rageOracle
		settlementTokenOracle = rageParams.settlementTokenOracle
	})
	it("#deploys the hedging reactor", async () => {
		const perpHedgingReactorFactory = await ethers.getContractFactory(
			"PerpHedgingReactor",
			{
				signer: signers[0]
			}
		)
		perpHedgingReactor = (await perpHedgingReactorFactory.deploy(
			clearingHouse.address,
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			liquidityPool.address,
			poolId,
			collateralId,
			priceFeed.address
		)) as PerpHedgingReactor

		expect(perpHedgingReactor).to.have.property("hedgeDelta")

	})
	it("initialises the reactor", async () => {
		await usd.approve(perpHedgingReactor.address, 1)
		await perpHedgingReactor.initialiseReactor()
	})
	it('#deploy range order', async () => {
		await deployRangeOrder(signers, clearingHouse, usd, collateralId, vTokenAddress, vQuoteAddress)
	  });
	it("sets reactor address on LP contract", async () => {
		const reactorAddress = perpHedgingReactor.address

		await liquidityPool.setHedgingReactorAddress(reactorAddress)

		await expect(await liquidityPool.hedgingReactors(0)).to.equal(reactorAddress)
	})
	it("Returns a quote for a ETH/USD put with utilization", async () => {
		const amount = toWei("5")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const optionSeries = {
			expiration: expiration,
			isPut: PUT_FLAVOR,
			strike: strikePrice,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}

		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			optionSeries,
			amount
		)

		const quote = (
			await liquidityPool.quotePriceWithUtilizationGreeks(
				{
					expiration: expiration,
					isPut: PUT_FLAVOR,
					strike: BigNumber.from(strikePrice),
					strikeAsset: usd.address,
					underlying: weth.address,
					collateral: usd.address
				},
				amount
			)
		)[0]
		const truncQuote = truncate(localQuote)
		const chainQuote = tFormatEth(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.lt(0.01)
	})

	it("Returns a quote for a ETH/USD put to buy", async () => {
		const thirtyPercentStr = "0.3"
		const thirtyPercent = toWei(thirtyPercentStr)
		await liquidityPool.setBidAskSpread(thirtyPercent)
		const amount = toWei("1")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const optionSeries = {
			expiration: expiration,
			isPut: PUT_FLAVOR,
			strike: strikePrice,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}

		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			optionSeries,
			amount,
			true
		)

		const buyQuotes = await liquidityPool.quotePriceBuying(optionSeries, amount)
		const buyQuote = buyQuotes[0]
		const truncQuote = truncate(localQuote)
		const chainQuote = tFormatEth(buyQuote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.lt(0.01)
	})

	it("reverts when attempting to write ETH/USD puts with expiry outside of limit", async () => {
		const [sender] = signers
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		// series with expiry too long
		const proposedSeries1 = {
			expiration: invalidExpirationLong,
			isPut: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await expect(liquidityPool.issueAndWriteOption(proposedSeries1, amount)).to.be.revertedWith(
			"OptionExpiryInvalid()"
		)
		// series with expiry too short
		const proposedSeries2 = {
			expiration: invalidExpirationShort,
			isPut: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await expect(liquidityPool.issueAndWriteOption(proposedSeries2, amount)).to.be.revertedWith(
			"OptionExpiryInvalid()"
		)
	})
	it("reverts when attempting to write a ETH/USD put with strike outside of limit", async () => {
		const [sender] = signers
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		// Series with strike price too high
		const proposedSeries1 = {
			expiration: expiration,
			isPut: PUT_FLAVOR,
			strike: invalidStrikeHigh,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await expect(liquidityPool.issueAndWriteOption(proposedSeries1, amount)).to.be.revertedWith(
			"OptionStrikeInvalid()"
		)
		// Series with strike price too low

		const proposedSeries2 = {
			expiration: expiration,
			isPut: PUT_FLAVOR,
			strike: invalidStrikeLow,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await expect(liquidityPool.issueAndWriteOption(proposedSeries2, amount)).to.be.revertedWith(
			"OptionStrikeInvalid()"
		)
	})
	it("can compute portfolio delta", async function () {
		const delta = await liquidityPool.getPortfolioDelta()
		expect(delta).to.equal(0)
	})
	it("LP Writes a ETH/USD put for premium", async () => {
		const [sender] = signers
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration,
			isPut: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const EthPrice = await oracle.getPrice(weth.address)
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await usd.approve(liquidityPool.address, quote)
		const balance = await usd.balanceOf(senderAddress)
		const write = await liquidityPool.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		const seriesAddress = writeEvent?.args?.series
		putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		collateralAllocatedToVault1 = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew)) - tFormatEth(quote)).to.be.lt(0.1)
		const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
	})
	it("LP writes another ETH/USD put that expires later", async () => {
		const [sender] = signers
		const amount = toWei("3")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration2,
			isPut: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lpAllocatedBefore = await liquidityPool.collateralAllocated()
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await usd.approve(liquidityPool.address, quote)
		const balance = await usd.balanceOf(senderAddress)
		const write = await liquidityPool.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		const seriesAddress = writeEvent?.args?.series
		putOptionToken2 = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken2.balanceOf(senderAddress)
		const lpAllocatedAfter = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew)) - tFormatEth(quote)).to.be.lt(0.1)
		const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
		const lpAllocatedDiff = lpAllocatedAfter.sub(lpAllocatedBefore)
		expect(tFormatUSDC(poolBalanceDiff) + tFormatEth(quote) - tFormatUSDC(lpAllocatedDiff)).to.be.lt(
			0.1
		)
	})
	it("reverts if option colaterral exceeds buffer limit", async () => {
		const lpBalance = await usd.balanceOf(liquidityPool.address)
		const amount = toWei("5")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration3,
			isPut: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await expect(liquidityPool.issueAndWriteOption(proposedSeries, amount)).to.be.revertedWith(
			"MaxLiquidityBufferReached"
		)
	})

	it("can compute portfolio delta", async function () {
		const delta = await liquidityPool.getPortfolioDelta()
		expect(delta).to.be.gt(0)
	})

	it("reverts when non-admin calls rebalance function", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		await expect(liquidityPool.connect(signers[1]).rebalancePortfolioDelta(delta, 0)).to.be.reverted
	})
	it("returns zero when hedging positive delta in perp hedging reactor", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		const reactorDelta = await perpHedgingReactor.internalDelta()
		await liquidityPool.rebalancePortfolioDelta(delta, 0)
		const newReactorDelta = await perpHedgingReactor.internalDelta()
		const newDelta = await liquidityPool.getPortfolioDelta()
		expect(newDelta).to.be.within(0, 100000000000)
		expect(reactorDelta.sub(newReactorDelta)).to.equal(delta)
	})

	it("Adds additional liquidity from new account", async () => {
		const [sender, receiver] = signers
		const sendAmount = toUSDC("20000")
		const usdReceiver = usd.connect(receiver)
		await usdReceiver.approve(liquidityPool.address, sendAmount)
		const lpReceiver = liquidityPool.connect(receiver)
		const totalSupply = await liquidityPool.totalSupply()
		await lpReceiver.deposit(sendAmount, receiverAddress)
		const newTotalSupply = await liquidityPool.totalSupply()
		const lpBalance = await lpReceiver.balanceOf(receiverAddress)
		const difference = newTotalSupply.sub(lpBalance)
		expect(difference).to.eq(await lpReceiver.balanceOf(senderAddress))
		expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))
	})

	it("LP can redeem shares", async () => {
		const shares = await liquidityPool.balanceOf(senderAddress)
		const totalShares = await liquidityPool.totalSupply()
		//@ts-ignore
		const ratio = 1 / fromWei(totalShares)
		const usdBalance = await usd.balanceOf(liquidityPool.address)
		const withdraw = await liquidityPool.withdraw(shares, senderAddress)
		const receipt = await withdraw.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "Withdraw")
		const strikeAmount = removeEvent?.args?.strikeAmount
		const usdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		//@ts-ignore
		const diff = fromWei(usdBalance) * ratio
		expect(diff).to.be.lt(1)
		expect(strikeAmount).to.be.eq(usdBalance.sub(usdBalanceAfter))
	})

	it("LP can not redeems shares when in excess of liquidity", async () => {
		const [sender, receiver] = signers

		const shares = await liquidityPool.balanceOf(receiverAddress)
		const liquidityPoolReceiver = liquidityPool.connect(receiver)
		const withdraw = liquidityPoolReceiver.withdraw(shares, receiverAddress)
		await expect(withdraw).to.be.revertedWith("WithdrawExceedsLiquidity()")
	})
	it("settles an expired ITM vault", async () => {
		const totalCollateralAllocated = await liquidityPool.collateralAllocated()
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		const strikePrice = await putOptionToken.strikePrice()
		// set price to $80 ITM for put
		const settlePrice = strikePrice.sub(toWei("80").div(oTokenDecimalShift18))
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)
		// settle the vault
		const settleVault = await liquidityPool.settleVault(putOptionToken.address)
		let receipt = await settleVault.wait()
		const events = receipt.events
		const settleEvent = events?.find(x => x.event == "SettleVault")
		const collateralReturned = settleEvent?.args?.collateralReturned
		const collateralLost = settleEvent?.args?.collateralLost
		// puts expired ITM, so the amount ITM will be subtracted and used to pay out option holders
		const optionITMamount = strikePrice.sub(settlePrice)
		const amount = parseFloat(utils.formatUnits(await putOptionToken.totalSupply(), 8))
		// format from e8 oracle price to e6 USDC decimals
		expect(collateralReturned).to.equal(
			collateralAllocatedToVault1.sub(optionITMamount.div(100)).mul(amount)
		)
		expect(await liquidityPool.collateralAllocated()).to.equal(
			totalCollateralAllocated.sub(collateralReturned).sub(collateralLost)
		)
	})

	it("settles an expired OTM vault", async () => {
		const totalCollateralAllocated = await liquidityPool.collateralAllocated()
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		const strikePrice = await putOptionToken.strikePrice()
		// set price to $100 OTM for put
		const settlePrice = strikePrice.add(toWei("100").div(oTokenDecimalShift18))
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration2, settlePrice)
		// settle the vault
		const settleVault = await liquidityPool.settleVault(putOptionToken2.address)
		let receipt = await settleVault.wait()
		const events = receipt.events
		const settleEvent = events?.find(x => x.event == "SettleVault")
		const collateralReturned = settleEvent?.args?.collateralReturned
		const collateralLost = settleEvent?.args?.collateralLost
		// puts expired OTM, so all collateral should be returned
		const amount = parseFloat(utils.formatUnits(await putOptionToken.totalSupply(), 8))
		expect(collateralReturned).to.equal(totalCollateralAllocated) // format from e8 oracle price to e6 USDC decimals
		expect(await liquidityPool.collateralAllocated()).to.equal(0)
		expect(collateralLost).to.equal(0)
	})
})
