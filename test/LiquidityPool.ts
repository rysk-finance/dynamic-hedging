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
	scaleNum,
	fromWeiToUSDC
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
let volFeed: VolatilityFeed
let priceFeed: PriceFeed
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
const expiration4 = moment.utc(expiryDate).add(3, "w").add(8, "h").valueOf() / 1000
const invalidExpirationLong = moment.utc(invalidExpiryDateLong).add(8, "h").valueOf() / 1000
const invalidExpirationShort = moment.utc(invalidExpiryDateShort).add(8, "h").valueOf() / 1000

const CALL_FLAVOR = false
const PUT_FLAVOR = true

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
	})
	it("#Deploys the Option Registry", async () => {
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
		usd = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDC_ADDRESS[chainId]
		)) as MintableERC20
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
	it("#Should deploy price feed", async () => {
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, usd.address, opynAggregator.address)
		await priceFeed.addPriceFeed(weth.address, usd.address, opynAggregator.address)
		// oracle returns price denominated in 1e8
		const oraclePrice = await oracle.getPrice(weth.address)
		// pricefeed returns price denominated in 1e18
		const priceFeedPrice = await priceFeed.getNormalizedRate(weth.address, usd.address)
		expect(oraclePrice.mul(10_000_000_000)).to.equal(priceFeedPrice)
	})
	it("#Should deploy volatility feed", async () => {
		const volFeedFactory = await ethers.getContractFactory("VolatilityFeed")
		volFeed = (await volFeedFactory.deploy()) as VolatilityFeed
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
		await volFeed.setVolatilitySkew(coefs, true)
		await volFeed.setVolatilitySkew(coefs, false)
	})

	it("Should deploy option protocol and link to registry/price feed", async () => {
		const protocolFactory = await ethers.getContractFactory("contracts/OptionsProtocol.sol:Protocol")
		optionProtocol = (await protocolFactory.deploy(
			optionRegistry.address,
			priceFeed.address,
			volFeed.address
		)) as Protocol
		expect(await optionProtocol.optionRegistry()).to.equal(optionRegistry.address)
	})

	it("Creates a liquidity pool with USDC (erc20) as strikeAsset", async () => {
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
	it("deploys the hedging reactor", async () => {
		const uniswapV3HedgingReactorFactory = await ethers.getContractFactory(
			"UniswapV3HedgingReactor",
			{
				signer: signers[0]
			}
		)

		uniswapV3HedgingReactor = (await uniswapV3HedgingReactorFactory.deploy(
			UNISWAP_V3_SWAP_ROUTER[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			liquidityPool.address,
			3000,
			priceFeed.address
		)) as UniswapV3HedgingReactor

		expect(uniswapV3HedgingReactor).to.have.property("hedgeDelta")
	})
	it("sets reactor address on LP contract", async () => {
		const reactorAddress = uniswapV3HedgingReactor.address

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
		expect(diff).to.be.within(0, 0.01)
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
		expect(diff).to.be.within(0, 0.01)
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
		proposedSeries = {
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
		expect(tFormatUSDC(balance.sub(balanceNew)) - tFormatEth(quote)).to.be.within(0, 0.1)
		const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
	})
	it("can compute portfolio delta", async function () {
		const delta = await liquidityPool.getPortfolioDelta()
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			toWei("1"),
			true
		)
		expect(delta.sub(localDelta)).to.be.within(0, 100000000000)
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
		expect(tFormatUSDC(balance.sub(balanceNew)) - tFormatEth(quote)).to.be.within(-0.1, 0.1)
		const poolBalanceDiff = poolBalanceBefore.sub(poolBalanceAfter)
		const lpAllocatedDiff = lpAllocatedAfter.sub(lpAllocatedBefore)
		expect(
			tFormatUSDC(poolBalanceDiff) + tFormatEth(quote) - tFormatUSDC(lpAllocatedDiff)
		).to.be.within(0, 0.1)
	})
	it("can compute portfolio delta", async function () {
		const delta = await liquidityPool.getPortfolioDelta()
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const wTPuts = await liquidityPool.weightedTimePut()
		const wSPuts = await liquidityPool.weightedStrikePut()
		const wPuts = await liquidityPool.totalAmountPut()

		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			toWei("1"),
			true
		)
		const localDeltaActual = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			{
				expiration: wTPuts.toNumber(),
				isPut: PUT_FLAVOR,
				strike: wSPuts,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			},
			wPuts,
			true
		)
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries2 = {
			expiration: expiration2,
			isPut: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localDelta2 = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries2,
			toWei("3"),
			true
		)
		expect(delta.sub(localDelta.add(localDelta2))).to.be.within(-1e15, 1e15)
		expect(delta.sub(localDeltaActual)).to.be.within(-1e13, 1e13)
	})
	it("reverts if option collaterral exceeds buffer limit", async () => {
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
	it("reverts when non-admin calls rebalance function", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		await expect(liquidityPool.connect(signers[1]).rebalancePortfolioDelta(delta, 0)).to.be.reverted
	})
	it("returns zero when hedging positive delta when reactor has no funds", async () => {
		const delta = await liquidityPool.getPortfolioDelta()
		const reactorDelta = await uniswapV3HedgingReactor.internalDelta()
		const res = (await liquidityPool.rebalancePortfolioDelta(delta, 0)).value
		const newReactorDelta = await uniswapV3HedgingReactor.internalDelta()

		expect(res.toNumber()).to.equal(0)
		expect(reactorDelta).to.equal(newReactorDelta).to.equal(0)
	})
	it("Creates a liquidity pool with ETH as collateralAsset", async () => {
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
		await volFeed.setVolatilitySkew(coefs, true)
		await volFeed.setVolatilitySkew(coefs, false)
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

		const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
			libraries: {
				BlackScholes: blackScholesDeploy.address
			}
		})
		const lp = await liquidityPoolFactory.deploy(
			optionProtocol.address,
			usd.address,
			weth.address,
			weth.address,
			toWei(rfr),
			"weth/usd",
			"wdp",
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
		)
		const lpAddress = lp.address
		ethLiquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
		const collateralAsset = await ethLiquidityPool.collateralAsset()
		expect(collateralAsset).to.eq(weth.address)
	})

	//TODO change to weth deposit contract
	// it('Adds liquidity to the ETH liquidityPool', async () => {
	//     const amount = toWei('10');
	//     await weth.deposit({ value: amount});
	//     await weth.approve(ethLiquidityPool.address, amount);
	//     const addLiquidity = await ethLiquidityPool.addLiquidity(amount);
	//     const liquidityPoolBalance = await ethLiquidityPool.balanceOf(senderAddress);
	//     const addLiquidityReceipt = await addLiquidity.wait(1);
	//     const addLiquidityEvents = addLiquidityReceipt.events;
	//     const addLiquidityEvent = addLiquidityEvents?.find(x => x.event == 'LiquidityAdded');
	//     expect(liquidityPoolBalance).to.eq(amount);
	//     expect(addLiquidityEvent?.event).to.eq('LiquidityAdded');
	// });

	it("Returns a quote for a single ETH/USD call option", async () => {
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block

		const timeToExpiration = genOptionTimeFromUnix(Number(timestamp), expiration)
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// const strikePrice = priceQuote.add(toWei(strike))
		// const optionSeries = {
		//   expiration: fmtExpiration(expiration.unix()),
		//   flavor: CALL_FLAVOR,
		//   strike: strikePrice,
		//   strikeAsset: usd.address,
		//   underlying: weth.address,
		// }
		// const iv = await liquidityPool.getImpliedVolatility(
		//   optionSeries.flavor,
		//   priceQuote,
		//   optionSeries.strike,
		//   optionSeries.expiration,
		// )
		// const localBS = bs.blackScholes(
		//   fromWei(priceQuote),
		//   fromWei(strikePrice),
		//   timeToExpiration,
		//   fromWei(iv),
		//   parseFloat(rfr),
		//   'call',
		// )
		// await priceFeed.addPriceFeed(ETH_ADDRESS, usd.address, ethUSDAggregator.address)
		// const quote = await liquidityPool.quotePrice(optionSeries)
		// expect(Math.round(truncate(localBS))).to.eq(Math.round(tFormatEth(quote.toString())))
	})

	it("Returns a quote for ETH/USD call with utilization", async () => {
		const amount = toWei("5")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.add(toWei(strike))
		const optionSeries = {
			expiration: expiration,
			isPut: CALL_FLAVOR,
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
					isPut: CALL_FLAVOR,
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
		expect(diff).to.be.within(0, 0.01)
	})

	let optionToken: IOToken
	let customOrderPrice: number
	it("Creates a buy order", async () => {
		let customOrderPriceMultiplier = 0.93
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei("700"))
		const amount = toWei("1")
		const orderExpiry = 10
		const proposedSeries = {
			expiration: expiration2,
			isPut: true,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localQuote = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			amount
		)
		customOrderPrice = localQuote * customOrderPriceMultiplier
		await liquidityPool.createOrder(
			proposedSeries,
			amount,
			toWei(customOrderPrice.toString()),
			orderExpiry,
			receiverAddress
		)
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const order = await liquidityPool.orderStores(1)
		expect(order.optionSeries.expiration).to.eq(proposedSeries.expiration)
		expect(order.optionSeries.isPut).to.eq(proposedSeries.isPut)
		expect(order.optionSeries.strike).to.eq(proposedSeries.strike)
		expect(order.optionSeries.underlying).to.eq(proposedSeries.underlying)
		expect(order.optionSeries.strikeAsset).to.eq(proposedSeries.strikeAsset)
		expect(order.optionSeries.collateral).to.eq(proposedSeries.collateral)
		expect(order.amount).to.eq(amount)
		expect(order.price).to.eq(toWei(customOrderPrice.toString()))
		expect(order.buyer).to.eq(receiverAddress)
		const seriesInfo = await optionRegistry.getSeriesInfo(order.seriesAddress)
		expect(order.optionSeries.expiration).to.eq(seriesInfo.expiration.toString())
		expect(order.optionSeries.isPut).to.eq(seriesInfo.isPut)
		// TODO: line below has a rounding error. Why is this?
		// expect(order.optionSeries.strike).to.eq(utils.parseUnits(seriesInfo.strike.toString(), 10))
		expect(await liquidityPool.orderIdCounter()).to.eq(1)
		optionToken = new Contract(order.seriesAddress, Otoken.abi, sender) as IOToken
	})
	let customOrderPriceCall: number
	let customOrderPricePut: number
	let customStranglePrice: number
	let strangleId: number
	let strangleCallToken: IOToken
	let stranglePutToken: IOToken
	it("creates a custom strangle order", async () => {
		let customOrderPriceMultiplier = 0.93
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePriceCall = priceQuote.add(toWei("1500"))
		const strikePricePut = priceQuote.sub(toWei("700"))
		const amount = toWei("1")
		const orderExpiry = 600 // 10 minutes
		const proposedSeriesCall = {
			expiration: expiration,
			isPut: false,
			strike: BigNumber.from(strikePriceCall),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const proposedSeriesPut = {
			expiration: expiration,
			isPut: true,
			strike: BigNumber.from(strikePricePut),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localQuoteCall = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesCall,
			amount
		)
		const localQuotePut = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesPut,
			amount
		)
		customOrderPriceCall = localQuoteCall * customOrderPriceMultiplier
		customOrderPricePut = localQuotePut * customOrderPriceMultiplier
		customStranglePrice = customOrderPriceCall + customOrderPricePut
		const createStrangle = await liquidityPool.createStrangle(
			proposedSeriesCall,
			proposedSeriesPut,
			amount,
			amount,
			toWei(customOrderPriceCall.toString()),
			toWei(customOrderPricePut.toString()),
			orderExpiry,
			receiverAddress
		)

		const receipt = await createStrangle.wait()
		const events = receipt.events
		const createOrderEvents = events?.filter(x => x.event == "OrderCreated") as any
		expect(createOrderEvents?.length).to.eq(2)
		expect(parseInt(createOrderEvents[0].args?.orderId) + 1).to.eq(createOrderEvents[1].args?.orderId)
		const createStrangleEvent = events?.find(x => x.event == "StrangleCreated")
		strangleId = createStrangleEvent?.args?.strangleId
		const callOrder = await liquidityPool.orderStores(createOrderEvents[0].args?.orderId)
		const putOrder = await liquidityPool.orderStores(createOrderEvents[1].args?.orderId)
		strangleCallToken = new Contract(callOrder.seriesAddress, Otoken.abi, sender) as IOToken
		stranglePutToken = new Contract(putOrder.seriesAddress, Otoken.abi, sender) as IOToken

		expect(callOrder.optionSeries.isPut).to.be.false
		expect(putOrder.optionSeries.isPut).to.be.true
		expect(callOrder.optionSeries.expiration).to.eq(proposedSeriesCall.expiration)
		expect(callOrder.optionSeries.expiration).to.eq(putOrder.optionSeries.expiration)
		expect(callOrder.optionSeries.strike).to.eq(proposedSeriesCall.strike)
		expect(putOrder.optionSeries.strike).to.eq(proposedSeriesPut.strike)
		expect(callOrder.optionSeries.strikeAsset).to.eq(proposedSeriesCall.strikeAsset)
		expect(putOrder.optionSeries.strikeAsset).to.eq(proposedSeriesPut.strikeAsset)
		expect(callOrder.optionSeries.collateral).to.eq(proposedSeriesCall.collateral)
		expect(putOrder.optionSeries.collateral).to.eq(proposedSeriesPut.collateral)
		expect(callOrder.amount).to.eq(amount)
		expect(putOrder.amount).to.eq(amount)
	})
	it("Cant make a buy order if not admin", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike).add(100))
		const amount = toWei("1")
		const pricePer = toWei("1000")
		const orderExpiry = 10
		const proposedSeries = {
			expiration: expiration,
			isPut: true,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await expect(
			liquidityPool
				.connect(receiver)
				.createOrder(proposedSeries, amount, pricePer, orderExpiry, receiverAddress)
		).to.be.reverted
	})
	it("cant exercise order if not buyer", async () => {
		await expect(liquidityPool.executeOrder(1)).to.be.revertedWith("InvalidBuyer()")
	})
	it("Executes a buy order", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const amount = toWei("1")
		const receiverOTokenBalBef = await optionToken.balanceOf(receiverAddress)
		const lpOTokenBalBef = await optionToken.balanceOf(liquidityPool.address)
		const lpBalBef = await usd.balanceOf(liquidityPool.address)
		const receiverBalBef = await usd.balanceOf(receiverAddress)

		await usd.connect(receiver).approve(liquidityPool.address, 1000000000)
		await liquidityPool.connect(receiver).executeOrder(1)
		const receiverOTokenBalAft = await optionToken.balanceOf(receiverAddress)
		const lpOTokenBalAft = await optionToken.balanceOf(liquidityPool.address)
		const lpBalAft = await usd.balanceOf(liquidityPool.address)
		const receiverBalAft = await usd.balanceOf(receiverAddress)
		const order = await liquidityPool.orderStores(1)
		expect(order.buyer).to.eq(ZERO_ADDRESS)
		expect(fromOpyn(receiverOTokenBalAft.toString())).to.eq(fromWei(amount.toString()))
		expect(lpOTokenBalAft).to.eq(0)
		const usdDiff = lpBalBef.sub(lpBalAft)
		// expect(usdDiff).to.eq(seriesStrike.div(100).sub(fromWeiToUSDC(pricePer.toString())))
		expect(receiverBalBef.sub(receiverBalAft)).to.eq(
			BigNumber.from(Math.floor(customOrderPrice * 10 ** 6).toString())
		)
	})
	it("executes a strangle", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const amount = toWei("1")
		const receiverOTokenBalBef = (await strangleCallToken.balanceOf(receiverAddress)).add(
			await stranglePutToken.balanceOf(receiverAddress)
		)
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit), senderAddress)
		const receiverBalBef = await usd.balanceOf(receiverAddress)

		await usd.connect(receiver).approve(liquidityPool.address, 1000000000)
		await liquidityPool.connect(receiver).executeStrangle(strangleId)
		const receiverBalAft = await usd.balanceOf(receiverAddress)
		const receiverOTokenBalAft = (await strangleCallToken.balanceOf(receiverAddress)).add(
			await stranglePutToken.balanceOf(receiverAddress)
		)
		const lpOTokenBalAft = (await strangleCallToken.balanceOf(liquidityPool.address)).add(
			await stranglePutToken.balanceOf(liquidityPool.address)
		)
		expect(
			receiverBalBef
				.sub(receiverBalAft)
				.sub(BigNumber.from(Math.floor(customStranglePrice * 10 ** 6).toString()))
		).to.be.within(-1, 1)
		expect(fromOpyn(receiverOTokenBalAft.sub(receiverOTokenBalBef).toString())).to.equal(
			fromWei(amount.mul(2).toString())
		)
		expect(lpOTokenBalAft).to.eq(0)
	})
	it("Cannot complete buy order after expiry", async () => {
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike).add(100))
		const amount = toWei("1")
		const pricePer = toWei("10")
		const orderExpiry = 1200 // order valid for 20 minutes
		const proposedSeries = {
			expiration: expiration,
			isPut: true,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const createOrdertx = await liquidityPool.createOrder(
			proposedSeries,
			amount,
			pricePer,
			orderExpiry,
			receiverAddress
		)
		const receipt = await createOrdertx.wait(1)
		const events = receipt.events
		const createOrderEvent = events?.find(x => x.event == "OrderCreated")
		const orderId = createOrderEvent?.args?.orderId
		const order = await liquidityPool.orderStores(orderId)
		expect(order.optionSeries.expiration).to.eq(proposedSeries.expiration)
		expect(order.optionSeries.isPut).to.eq(proposedSeries.isPut)
		expect(order.optionSeries.strike).to.eq(proposedSeries.strike)
		expect(order.optionSeries.underlying).to.eq(proposedSeries.underlying)
		expect(order.optionSeries.strikeAsset).to.eq(proposedSeries.strikeAsset)
		expect(order.optionSeries.collateral).to.eq(proposedSeries.collateral)
		expect(order.amount).to.eq(amount)
		expect(order.price).to.eq(pricePer)
		expect(order.buyer).to.eq(receiverAddress)
		const seriesInfo = await optionRegistry.getSeriesInfo(order.seriesAddress)
		expect(order.optionSeries.expiration).to.eq(seriesInfo.expiration.toString())
		expect(order.optionSeries.isPut).to.eq(seriesInfo.isPut)
		// TODO: another tiny rounding error below. why?
		// expect(order.optionSeries.strike).to.eq(seriesInfo.strike)
		expect(await liquidityPool.orderIdCounter()).to.eq(orderId)
		optionToken = new Contract(order.seriesAddress, Otoken.abi, sender) as IOToken
		increase(1201)
		await expect(liquidityPool.connect(receiver).executeOrder(orderId)).to.be.revertedWith(
			"OrderExpired()"
		)
	})
	it("fails to execute invalid custom orders", async () => {
		let customOrderPriceMultiplier = 0.93
		let customOrderPriceMultiplierInvalid = 0.89 // below 10% buffer
		const [sender, receiver] = signers
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePriceInvalidDelta = priceQuote.add(toWei("10")) // delta will be too high
		const strikePriceInvalidPrice = priceQuote.add(toWei("1500"))
		const amount = toWei("1")
		const orderExpiry = 600 // 10 minutes
		const proposedSeriesInvalidDelta = {
			expiration: expiration,
			isPut: false,
			strike: BigNumber.from(strikePriceInvalidDelta),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const proposedSeriesInvalidPrice = {
			expiration: expiration,
			isPut: false,
			strike: BigNumber.from(strikePriceInvalidPrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const localQuoteInvalidDelta = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesInvalidDelta,
			amount
		)
		const localQuoteInvalidPrice = await calculateOptionQuoteLocally(
			liquidityPool,
			priceFeed,
			proposedSeriesInvalidPrice,
			amount
		)
		const customOrderPriceInvalidDelta = localQuoteInvalidDelta * customOrderPriceMultiplier
		const customOrderPriceInvalidPrice = localQuoteInvalidPrice * customOrderPriceMultiplierInvalid

		const createOrderInvalidDelta = await liquidityPool.createOrder(
			proposedSeriesInvalidDelta,
			amount,
			toWei(customOrderPriceInvalidDelta.toString()),
			orderExpiry,
			receiverAddress
		)

		const receipt = await createOrderInvalidDelta.wait(1)
		const events = receipt.events
		const createOrderEvent = events?.find(x => x.event == "OrderCreated")
		const invalidDeltaOrderId = createOrderEvent?.args?.orderId

		const createOrderInvalidPrice = await liquidityPool.createOrder(
			proposedSeriesInvalidPrice,
			amount,
			toWei(customOrderPriceInvalidPrice.toString()),
			orderExpiry,
			receiverAddress
		)

		const receipt2 = await createOrderInvalidPrice.wait(1)
		const events2 = receipt2.events
		const createOrderEvent2 = events2?.find(x => x.event == "OrderCreated")
		const invalidPriceOrderId = createOrderEvent2?.args?.orderId

		await expect(
			liquidityPool.connect(receiver).executeOrder(invalidDeltaOrderId)
		).to.be.revertedWith("CustomOrderInvalidDeltaValue()")

		await expect(
			liquidityPool.connect(receiver).executeOrder(invalidPriceOrderId)
		).to.be.revertedWith("CustomOrderInsufficientPrice()")
	})
	let lpCallOption: IOToken
	it("LP Writes a WETH/USD call collateralized by WETH for premium", async () => {
		// registry requires liquidity pool to be owner
		optionRegistry.setLiquidityPool(ethLiquidityPool.address)
		const [sender] = signers
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block

		// opyn contracts require expiration to be at 8:00 UTC

		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.add(toWei(strike))
		//await usd.mint(senderAddress, toWei('6000'))
		await usd.approve(ethLiquidityPool.address, toUSDC("6000"))
		await weth.deposit({ value: amount.mul("5") })
		await weth.approve(ethLiquidityPool.address, amount.mul("5"))
		await ethLiquidityPool.deposit(amount.mul("4"), senderAddress)
		const lpUSDBalanceBefore = await usd.balanceOf(ethLiquidityPool.address)
		const proposedSeries = {
			expiration: expiration,
			isPut: false,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: weth.address
		}
		const quote = (await ethLiquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await usd.approve(ethLiquidityPool.address, quote.toString())
		const write = await ethLiquidityPool.issueAndWriteOption(proposedSeries, amount)
		const receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		const seriesAddress = writeEvent?.args?.series
		const callOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		lpCallOption = callOptionToken
		const buyerOptionBalance = await callOptionToken.balanceOf(senderAddress)
		const totalInterest = await callOptionToken.totalSupply()
		const lpUSDBalance = await usd.balanceOf(ethLiquidityPool.address)
		const senderEthBalance = await sender.getBalance()
		const balanceDiff = lpUSDBalanceBefore.sub(lpUSDBalance)
		expect(fromOpyn(buyerOptionBalance)).to.eq(fromWei(amount))
		expect(fromOpyn(totalInterest)).to.eq(fromWei(amount))
	})

	it("Can compute IV from volatility skew coefs", async () => {
		const coefs: BigNumberish[] = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		].map(x => toWei(x.toString()))
		const points = [-0.36556715, 0.59115575].map(x => toWei(x.toString()))
		const expected_iv = 1.4473946
		//@ts-ignore
		const res = await volatility.computeIVFromSkewInts(coefs, points)
		expect(tFormatEth(res)).to.eq(truncate(expected_iv))
	})

	// it('Can set the calls volatility skew', async () => {
	//   const coefInts: number[] = [
	//     1.42180236,
	//     0,
	//     -0.08626792,
	//     0.07873822,
	//     0.00650549,
	//     0.02160918,
	//     -0.1393287,
	//   ]
	//   const coefs: BigNumberish[] = coefInts.map((x) => toWei(x.toString()))
	//   //@ts-ignore
	//   const res = await liquidityPool.setVolatilitySkew(
	//     coefs,
	//     BigNumber.from(call),
	//   )
	//   const vs = await liquidityPool.getVolatilitySkew(BigNumber.from(call))
	//   const converted = vs.map((n: BigNumber) => fromWei(n))
	//   const diff = percentDiffArr(converted, coefInts)
	//   // allow for small float inprecision
	//   expect(diff).to.eq(0)
	// })

	it("can set the puts volatility skew", async () => {})
	// TODO rewrite once checks have been written
	// it("carries out checks if non-whitelisted address attempts to buyback", async () => {
	// 	const [sender] = signers
	// 	const amount = utils.parseUnits("1", 8)
	// 	const blockNum = await ethers.provider.getBlockNumber()
	// 	const block = await ethers.provider.getBlock(blockNum)
	// 	const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
	// 	const strikePrice = priceQuote.add(toWei(strike))

	// 	const proposedSeries = {
	// 		expiration: fmtExpiration(expiration),
	// 		flavor: BigNumber.from(call),
	// 		strike: BigNumber.from(strikePrice),
	// 		strikeAsset: usd.address,
	// 		underlying: weth.address
	// 	}
	// 	// await expect(ethLiquidityPool.buybackOption(proposedSeries, amount)).to.be.revertedWith(
	// 	// 	"This address is not authorized to buy options."
	// 	// )
	// })
	it("adds address to the buyback whitelist", async () => {
		await expect(await ethLiquidityPool.buybackWhitelist(senderAddress)).to.be.false
		await ethLiquidityPool.addBuybackAddress(senderAddress)
		await expect(await ethLiquidityPool.buybackWhitelist(senderAddress)).to.be.true
	})

	it("LP can buy back option to reduce open interest", async () => {
		// const [sender] = signers
		// const amount = utils.parseUnits("1", 18)
		// const blockNum = await ethers.provider.getBlockNumber()
		// const block = await ethers.provider.getBlock(blockNum)
		// const { timestamp } = block
		// const callOptionAddress = lpCallOption.address
		// // opyn contracts require expiration to be at 8:00 UTC
		// const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// const strikePrice = priceQuote.add(toWei(strike))
		// const lpUSDBalanceBefore = await usd.balanceOf(ethLiquidityPool.address)
		// const proposedSeries = {
		// 	expiration: expiration,
		// 	isPut: false,
		// 	strike: BigNumber.from(strikePrice),
		// 	strikeAsset: usd.address,
		// 	underlying: weth.address,
		// 	collateral: weth.address
		// }
		// const callOptionToken = new Contract(callOptionAddress, Otoken.abi, sender) as IOToken
		// const totalInterestBefore = await callOptionToken.totalSupply()
		// const sellerOTokenBalanceBefore = await callOptionToken.balanceOf(senderAddress)
		// const sellerUsdcBalanceBefore = await usd.balanceOf(senderAddress)
		// await callOptionToken.approve(ethLiquidityPool.address, amount)
		// const quote = (await ethLiquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		// await usd.approve(ethLiquidityPool.address, quote.toString())
		// const write = await ethLiquidityPool.buybackOption(proposedSeries, amount)
		// const receipt = await write.wait(1)
		// const events = receipt.events
		// const buybackEvent = events?.find(x => x.event == "BuybackOption")
		// expect(buybackEvent?.args?.series).to.equal(callOptionAddress)
		// expect(buybackEvent?.args?.amount).to.equal(amount)
		// const totalInterest = await callOptionToken.totalSupply()
		// expect(totalInterest).to.equal(
		// 	totalInterestBefore.sub(BigNumber.from(parseInt(utils.formatUnits(amount, 10))))
		// )
		// const sellerOTokenBalance = await callOptionToken.balanceOf(senderAddress)
		// const sellerUsdcBalance = await usd.balanceOf(senderAddress)
		// // div quote by 100 because quote is in 8dp but USDC uses 6
		// // test to ensure option seller's USDC balance increases by quoted amount (1 USDC error allowed)
		// expect(
		// 	sellerUsdcBalance
		// 		.sub(sellerUsdcBalanceBefore.add(BigNumber.from(parseInt(utils.formatUnits(quote, 12)))))
		// 		.abs()
		// ).to.be.below(utils.parseUnits("1", 6))
		// expect(sellerOTokenBalance).to.equal(
		// 	sellerOTokenBalanceBefore.sub(BigNumber.from(parseInt(utils.formatUnits(amount, 10))))
		// )
		// const lpUSDBalance = await usd.balanceOf(ethLiquidityPool.address)
		// const balanceDiff = lpUSDBalanceBefore.sub(lpUSDBalance)
		// // test to ensure Liquidity pool balance decreased by quoted amount (1 USDC error allowed)
		// expect(balanceDiff.sub(BigNumber.from(parseInt(utils.formatUnits(quote, 12)))).abs()).to.be.below(
		// 	utils.parseUnits("1", 6)
		// )
		// expect(parseFloat(fromOpyn(sellerOTokenBalance))).to.eq(0)
		// expect(parseFloat(fromOpyn(totalInterest))).to.eq(0)
	})

	it("Adds additional liquidity from new account", async () => {
		optionRegistry.setLiquidityPool(liquidityPool.address)
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
		expect(diff).to.be.within(0, 1)
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
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)

		// settle the vault
		const settleVault = await liquidityPool.settleVault(putOptionToken.address)
		let receipt = await settleVault.wait()
		const events = receipt.events
		const settleEvent = events?.find(x => x.event == "SettleVault")
		const collateralReturned = settleEvent?.args?.collateralReturned
		const collateralLost = settleEvent?.args?.collateralLost
		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)

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
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		const strikePrice = await putOptionToken2.strikePrice()
		// set price to $100 OTM for put
		const settlePrice = strikePrice.add(toWei("100").div(oTokenDecimalShift18))
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration2, settlePrice)
		// settle the vault
		const settleVault = await liquidityPool.settleVault(putOptionToken2.address)
		let receipt = await settleVault.wait()
		const events = receipt.events
		const settleEvent = events?.find(x => x.event == "SettleVault")
		const collateralReturned = settleEvent?.args?.collateralReturned
		const collateralLost = settleEvent?.args?.collateralLost
		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		// puts expired OTM, so all collateral should be returned
		const amount = parseFloat(utils.formatUnits(await putOptionToken.totalSupply(), 8))
		expect(lpBalanceAfter.sub(lpBalanceBefore)).to.equal(collateralReturned) // format from e8 oracle price to e6 USDC decimals
		expect(collateralAllocatedBefore.sub(collateralAllocatedAfter)).to.equal(collateralReturned)
		expect(collateralLost).to.equal(0)
	})
})
