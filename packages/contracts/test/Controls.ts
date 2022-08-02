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
import { Authority } from "../types/Authority"
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
let authority: Authority

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

describe("Authority tests", async () => {
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
		authority = deployParams.authority as Authority
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
			authority.address
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
	describe("Authority push effective immediately", async () => {
		it("SUCCEEDS: set governor", async () => {
			await authority.pushGovernor(receiverAddress, true)
			expect(await authority.governor()).to.equal(receiverAddress)
            await authority.connect(signers[1]).pushGovernor(senderAddress, true)
            expect(await authority.governor()).to.equal(senderAddress)
		})
        it("SUCCEEDS: set manager", async () => {
			await authority.pushManager(receiverAddress, true)
			expect(await authority.manager()).to.equal(receiverAddress)
		})
        it("SUCCEEDS: set guardian", async () => {
			await authority.pushGuardian(receiverAddress)
			expect(await authority.guardian(receiverAddress)).to.be.true
		})
        it("SUCCEEDS: revoke guardian", async () => {
			await authority.revokeGuardian(receiverAddress)
			expect(await authority.guardian(receiverAddress)).to.be.false
		})
        it("FAILS: revoke guardian when not auth", async () => {
			await expect(authority.connect(signers[1]).revokeGuardian(senderAddress)).to.be.revertedWith("UNAUTHORIZED()")
		})
		it("FAILS: set governor when not auth", async () => {
			await expect(authority.connect(signers[1]).pushGovernor(receiverAddress, true)).to.be.revertedWith("UNAUTHORIZED()")
		})
        it("FAILS: set manager when not auth", async () => {
			await expect(authority.connect(signers[1]).pushManager(receiverAddress, true)).to.be.revertedWith("UNAUTHORIZED()")
		})
        it("FAILS: set guardian when not auth", async () => {
			await expect(authority.connect(signers[1]).pushGuardian(receiverAddress)).to.be.revertedWith("UNAUTHORIZED()")
		})
	})
	describe("Authority push and pull", async () => {
		it("SUCCEEDS: push governor", async () => {
			await authority.pushGovernor(receiverAddress, false)
			expect(await authority.newGovernor()).to.equal(receiverAddress)
		})
        it("FAILS: rando tries to pull governor rank", async () => {
			await expect(authority.pullGovernor()).to.be.revertedWith("!newGovernor")
		})
        it("SUCCEEDS: pull governor rank", async () => {
			await authority.connect(signers[1]).pullGovernor()
            expect(await authority.governor()).to.equal(receiverAddress)
            await authority.connect(signers[1]).pushGovernor(senderAddress, true)
            expect(await authority.governor()).to.equal(senderAddress)
		}) 
        it("SUCCEEDS: push manager", async () => {
			await authority.pushManager(senderAddress, false)
			expect(await authority.newManager()).to.equal(senderAddress)
		})
        it("FAILS: rando tries to pull manager rank", async () => {
			await expect(authority.connect(signers[2]).pullManager()).to.be.revertedWith("!newManager")
		}) 
        it("SUCCEEDS: pull manager rank", async () => {
			await authority.pullManager()
            expect(await authority.manager()).to.equal(senderAddress)
		}) 
	})
})
