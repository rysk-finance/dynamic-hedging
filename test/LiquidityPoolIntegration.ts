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
	fmtExpiration,
	fromOpyn,
	toOpyn,
	tFormatUSDC,
	PUT,
	fromUSDC,
	scaleNum
} from "../utils/conversion-helper"
import { computeNewWeights } from "../utils/OptionsCompute"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import moment from "moment"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
//@ts-ignore
import bs from "black-scholes"
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { UniswapV3HedgingReactor } from "../types/UniswapV3HedgingReactor"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistryV2 } from "../types/OptionRegistryV2"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPool } from "../types/LiquidityPool"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import { Volatility } from "../types/Volatility"
import { Controller } from "../types/Controller"
import { AddressBook } from "../types/AddressBook"
import { Oracle } from "../types/Oracle"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import { setupTestOracle } from "./helpers"
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
	GAMMA_ORACLE_NEW
} from "./constants"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
let usd: MintableERC20
let weth: WETH
let optionRegistryV2: OptionRegistryV2
let optionProtocol: Protocol
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let ethLiquidityPool: LiquidityPool
let volatility: Volatility
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let uniswapV3HedgingReactor: UniswapV3HedgingReactor
let rate: string
let controller: Controller
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator

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
const liquidityPoolUsdcDeposit = "10000"
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
const invalidExpirationLong = moment.utc(invalidExpiryDateLong).add(8, "h").valueOf() / 1000
const invalidExpirationShort = moment.utc(invalidExpiryDateShort).add(8, "h").valueOf() / 1000

const CALL_FLAVOR = false
const PUT_FLAVOR = true
describe("Liquidity Pool Integration Simulation", async () => {
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
		// impersonate the opyn controller owner
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [CONTROLLER_OWNER[chainId]]
		})
		signers = await ethers.getSigners()
		const [sender] = signers

		const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
		await sender.sendTransaction({
			to: signer.address,
			value: ethers.utils.parseEther("1.0") // Sends exactly 1.0 ether
		})
		// get an instance of the controller
		controller = (await ethers.getContractAt(
			"contracts/packages/opyn/core/Controller.sol:Controller",
			GAMMA_CONTROLLER[chainId]
		)) as Controller
		// get an instance of the addressbook
		addressBook = (await ethers.getContractAt(
			"contracts/packages/opyn/core/AddressBook.sol:AddressBook",
			ADDRESS_BOOK[chainId]
		)) as AddressBook
		// get the oracle
		const res = await setupTestOracle(await signers[0].getAddress())
		//@ts-ignore
		oracle = res[0]
		//@ts-ignore
		opynAggregator = res[1]
		// deploy the new calculator
		const newCalculatorInstance = await ethers.getContractFactory("NewMarginCalculator")
		newCalculator = (await newCalculatorInstance.deploy(
			GAMMA_ORACLE_NEW[chainId],
			ADDRESS_BOOK[chainId]
		)) as NewMarginCalculator
		// deploy the new whitelist
		const newWhitelistInstance = await ethers.getContractFactory("NewWhitelist")
		const newWhitelist = await newWhitelistInstance.deploy(ADDRESS_BOOK[chainId])
		// update the addressbook with the new calculator and whitelist addresses
		await addressBook.connect(signer).setMarginCalculator(newCalculator.address)
		await addressBook.connect(signer).setWhitelist(newWhitelist.address)
		// update the whitelist and calculator in the controller
		await controller.connect(signer).refreshConfiguration()
		// whitelist collateral
		await newWhitelist.whitelistCollateral(WETH_ADDRESS[chainId])
		await newWhitelist.whitelistCollateral(USDC_ADDRESS[chainId])
		// whitelist products
		// normal calls
		await newWhitelist.whitelistProduct(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			false
		)
		// normal puts
		await newWhitelist.whitelistProduct(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			true
		)
		// usd collateralised calls
		await newWhitelist.whitelistProduct(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			false
		)
		// eth collateralised puts
		await newWhitelist.whitelistProduct(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			true
		)
		// whitelist vault type 0 collateral
		await newWhitelist.whitelistCoveredCollateral(WETH_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
		await newWhitelist.whitelistCoveredCollateral(USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
		// whitelist vault type 1 collateral
		await newWhitelist.whitelistNakedCollateral(USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
		await newWhitelist.whitelistNakedCollateral(WETH_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
		// set product spot shock values
		// usd collateralised calls
		await newCalculator.setSpotShock(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			false,
			productSpotShockValue
		)
		// usd collateralised puts
		await newCalculator.setSpotShock(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			true,
			productSpotShockValue
		)
		// eth collateralised calls
		await newCalculator.setSpotShock(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			false,
			productSpotShockValue
		)
		// eth collateralised puts
		await newCalculator.setSpotShock(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			true,
			productSpotShockValue
		)
		// set expiry to value values
		// usd collateralised calls
		await newCalculator.setUpperBoundValues(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			false,
			timeToExpiry,
			expiryToValue
		)
		// usd collateralised puts
		await newCalculator.setUpperBoundValues(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			true,
			timeToExpiry,
			expiryToValue
		)
		// eth collateralised calls
		await newCalculator.setUpperBoundValues(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			false,
			timeToExpiry,
			expiryToValue
		)
		// eth collateralised puts
		await newCalculator.setUpperBoundValues(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			true,
			timeToExpiry,
			expiryToValue
		)
	})

	it("Deploys the Option Registry", async () => {
		signers = await ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		// deploy libraries
		const constantsFactory = await ethers.getContractFactory("Constants")
		const interactionsFactory = await ethers.getContractFactory("OpynInteractionsV2")
		const constants = await constantsFactory.deploy()
		const interactions = await interactionsFactory.deploy()
		// deploy options registry
		const optionRegistryV2Factory = await ethers.getContractFactory("OptionRegistryV2", {
			libraries: {
				OpynInteractionsV2: interactions.address
			}
		})
		// get and transfer weth
		weth = (await ethers.getContractAt(
			"contracts/interfaces/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		usd = (await ethers.getContractAt("ERC20", USDC_ADDRESS[chainId])) as MintableERC20
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		await usd.connect(signer).transfer(senderAddress, toWei("1000").div(oTokenDecimalShift18))
		await weth.deposit({ value: utils.parseEther("99") })
		const _optionRegistryV2 = (await optionRegistryV2Factory.deploy(
			USDC_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId]
		)) as OptionRegistryV2
		optionRegistryV2 = _optionRegistryV2
		expect(optionRegistryV2).to.have.property("deployTransaction")
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
		const protocolFactory = await ethers.getContractFactory("Protocol")
		optionProtocol = (await protocolFactory.deploy(
			optionRegistryV2.address,
			priceFeed.address
		)) as Protocol
		expect(await optionProtocol.optionRegistryV2()).to.equal(optionRegistryV2.address)
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
			await signers[0].getAddress()
		)) as LiquidityPool

		const lpAddress = lp.address
		liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
		optionRegistryV2.setLiquidityPool(liquidityPool.address)
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
	it("Returns a quote for a ETH/USD put with utilization", async () => {
		const totalLiqidity = await liquidityPool.totalSupply()
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const timeToExpiration = genOptionTimeFromUnix(Number(timestamp), expiration)
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const priceNorm = fromWei(priceQuote)
		const utilization = Number(fromWei(amount)) / Number(fromWei(totalLiqidity))
		const utilizationPrice = Number(priceNorm) * utilization
		const optionSeries = {
			expiration: expiration,
			isPut: PUT_FLAVOR,
			strike: strikePrice,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const iv = await liquidityPool.getImpliedVolatility(
			optionSeries.isPut,
			priceQuote,
			optionSeries.strike,
			optionSeries.expiration
		)
		const localBS = bs.blackScholes(
			priceNorm,
			fromWei(strikePrice),
			timeToExpiration,
			fromWei(iv),
			parseFloat(rfr),
			"put"
		)
		const finalQuote = utilizationPrice > localBS ? utilizationPrice : localBS
		const quote = await liquidityPool.quotePriceWithUtilization(
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
		const truncQuote = truncate(finalQuote)
		const chainQuote = tFormatEth(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.lt(0.01)
	})
	it("LP Writes a ETH/USD put for premium under utilization", async () => {
		const [sender] = signers
		const rawAmount = 1
		const amount = toWei(rawAmount.toString())
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const totalAmountPutBefore = await liquidityPool.totalAmountPut()
		const weightedStrikeBefore = await liquidityPool.weightedStrikePut()
		const weightedTimeBefore = await liquidityPool.weightedTimePut()
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
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const quote = await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount)
		await usd.approve(liquidityPool.address, quote[0])
		const balance = await usd.balanceOf(senderAddress)
		const write = await liquidityPool.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		const seriesAddress = writeEvent?.args?.series
		const putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		// convert to numeric
		const escrow = Number(fromUSDC(await liquidityPool.collateralAllocated()))
		const totalAmountPutAfter = await liquidityPool.totalAmountPut()
		const weightedStrikeAfter = await liquidityPool.weightedStrikePut()
		const weightedTimeAfter = await liquidityPool.weightedTimePut()
		const newWeights = computeNewWeights(
			amount,
			proposedSeries.strike,
			BigNumber.from(proposedSeries.expiration),
			totalAmountPutBefore,
			weightedStrikeBefore,
			weightedTimeBefore
		)
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew))).to.eq(tFormatEth(quote[0]))
		const expectedPoolBalance = truncate(
			Number(fromUSDC(poolBalanceBefore)) + Number(fromWei(quote[0])) - escrow
		)
		expect(expectedPoolBalance).to.eq(truncate(Number(fromUSDC(poolBalanceAfter))))
		expect(totalAmountPutAfter.sub(totalAmountPutBefore)).to.eq(amount)
		expect(weightedStrikeAfter).to.eq(newWeights.newWeightedStrike)
		expect(weightedTimeAfter).to.eq(newWeights.newWeightedTime)
		//@TODO add assertion checking if other state variables are properly updated such as weighted variables
	})
})
