import hre, { ethers, network } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber } from "ethers"
import {
	toWei,
	tFormatEth,
	call,
	put,
	fromWei,
	toUSDC,
	fromUSDC,
	fmtExpiration,
	toOpyn,
	tFormatUSDC,
	scaleNum
} from "../utils/conversion-helper"
import moment from "moment"
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { MockPortfolioValuesFeed } from "../types/MockPortfolioValuesFeed"
import { ERC20 } from "../types/ERC20"
import { ERC20Interface } from "../types/ERC20Interface"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPool } from "../types/LiquidityPool"
import { Volatility } from "../types/Volatility"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import { NewController } from "../types/NewController"
import { AddressBook } from "../types/AddressBook"
import { Oracle } from "../types/Oracle"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import { setupTestOracle, calculateOptionDeltaLocally } from "./helpers"
import {
	ADDRESS_BOOK,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS,
	CONTROLLER_OWNER,
	GAMMA_ORACLE_NEW
} from "./constants"
import { deployOpyn } from "../utils/opyn-deployer"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { VolatilityFeed } from "../types/VolatilityFeed"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { OptionHandler } from "../types/OptionHandler"

let usd: MintableERC20
let weth: WETH
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let volatility: Volatility
let volFeed: VolatilityFeed
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let priceFeed: PriceFeed
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let portfolioValuesFeed: MockPortfolioValuesFeed
let handler: OptionHandler
let optionToken1: string
let priceQuote: any
let quote: any
let localDelta: any
let authority: string

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

// decimal representation of a percentage
const rfr: string = "0.03"
// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
const collatDecimalShift = BigNumber.from(1000000000000)
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = "20"

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "100000"
const liquidityPoolUsdcWithdraw = "1000"

const minCallStrikePrice = utils.parseEther("500")
const maxCallStrikePrice = utils.parseEther("10000")
const minPutStrikePrice = utils.parseEther("500")
const maxPutStrikePrice = utils.parseEther("10000")
// one week in seconds
const minExpiry = 86400 * 7
// 365 days in seconds
const maxExpiry = 86400 * 365

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

const CALL_FLAVOR = false
const PUT_FLAVOR = true

describe("Liquidity Pools Deposit Withdraw", async () => {
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
		signers = await ethers.getSigners()
		let opynParams = await deployOpyn(signers, productSpotShockValue, timeToExpiry, expiryToValue)
		controller = opynParams.controller
		addressBook = opynParams.addressBook
		oracle = opynParams.oracle
		newCalculator = opynParams.newCalculator
		// get the oracle
		const res = await setupTestOracle(await signers[0].getAddress())
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
		await usdWhaleConnect.transfer(await signers[2].getAddress(), toUSDC("1000000"))
	})
	it("Succeeds: User 1: Deposit to the liquidityPool", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(await liquidityPool.callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))).to.be.true
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[0].args
		expect(depositEvent.recipient).to.equal(user)
		expect(depositEvent.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceBefore.sub(usdBalanceAfter)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(0)
		expect(lpusdBalanceAfter.sub(lpusdBalanceBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(epochAfter).to.equal(epochBefore)
		expect(pendingDepositAfter.sub(pendingDepositBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositReceiptBefore.epoch).to.equal(0)
		expect(depositReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(depositReceiptAfter.amount.sub(depositReceiptBefore.amount)).to.equal(
			toUSDC(liquidityPoolUsdcDeposit)
		)
		expect(depositReceiptAfter.unredeemedShares.sub(depositReceiptBefore.unredeemedShares)).to.equal(
			0
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(0)
	})
	it("Succeeds: User 1: Deposit to the liquidityPool again", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(await liquidityPool.callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))).to.be.true
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool
			.connect(signers[1])
			.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[1].args
		expect(depositEvent.recipient).to.equal(user)
		expect(depositEvent.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceBefore.sub(usdBalanceAfter)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(0)
		expect(lpusdBalanceAfter.sub(lpusdBalanceBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(epochAfter).to.equal(epochBefore)
		expect(pendingDepositAfter.sub(pendingDepositBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositReceiptBefore.epoch).to.equal(1)
		expect(depositReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(depositReceiptAfter.amount.sub(depositReceiptBefore.amount)).to.equal(
			toUSDC(liquidityPoolUsdcDeposit)
		)
		expect(depositReceiptAfter.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit).mul(2))
		expect(depositReceiptAfter.unredeemedShares.sub(depositReceiptBefore.unredeemedShares)).to.equal(
			0
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(0)
	})
	it("Succeeds: User 2: Deposit to the liquidityPool", async () => {
		const user = receiverAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await usd.connect(signers[1]).approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(
			await liquidityPool.connect(signers[1]).callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))
		).to.be.true
		const deposit = await liquidityPool.connect(signers[1]).deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[2].args
		expect(depositEvent.recipient).to.equal(user)
		expect(depositEvent.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceBefore.sub(usdBalanceAfter)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(0)
		expect(lpusdBalanceAfter.sub(lpusdBalanceBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(epochAfter).to.equal(epochBefore)
		expect(pendingDepositAfter.sub(pendingDepositBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositReceiptBefore.epoch).to.equal(0)
		expect(depositReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(depositReceiptAfter.amount.sub(depositReceiptBefore.amount)).to.equal(
			toUSDC(liquidityPoolUsdcDeposit)
		)
		expect(depositReceiptAfter.unredeemedShares.sub(depositReceiptBefore.unredeemedShares)).to.equal(
			0
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(0)
	})
	it("Reverts: User 1: Tries Zero on all functions", async () => {
		const user = senderAddress
		await expect(liquidityPool.deposit(0)).to.be.revertedWith("InvalidAmount()")
		await expect(liquidityPool.redeem(0)).to.be.revertedWith("InvalidShareAmount()")
		await expect(liquidityPool.initiateWithdraw(0)).to.be.revertedWith("InvalidShareAmount()")
		await expect(liquidityPool.completeWithdraw(0)).to.be.revertedWith("InvalidShareAmount()")
	})
	it("Reverts: User 1: Attempts to redeem before epoch initiation", async () => {
		const user = senderAddress
		expect(await liquidityPool.callStatic.redeem(toWei("100000"))).to.equal(0)
	})
	it("Reverts: User 1: Attempts to initiate withdraw before epoch initiation", async () => {
		const user = senderAddress
		await expect(liquidityPool.initiateWithdraw(toWei("100000"))).to.be.revertedWith(
			"InsufficientShareBalance()"
		)
	})
	it("Reverts: User 1: Attempts to complete withdraw before epoch initiation", async () => {
		const user = senderAddress
		await expect(liquidityPool.completeWithdraw(toWei("100000"))).to.be.revertedWith(
			"NoExistingWithdrawal()"
		)
	})
	it("Reverts: execute epoch before pause", async () => {
		await expect(liquidityPool.executeEpochCalculation()).to.be.revertedWith("TradingNotPaused()")
	})
	it("Succeeds: pauses trading", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
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
	})
	it("Succeeds: User 1: issues an option", async () => {
		const user = senderAddress
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		optionToken1 = await handler.callStatic.issue(proposedSeries)
		await handler.issue(proposedSeries)
	})
	it("Succeeds: execute epoch", async () => {
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
	it("Succeeds: User 3: Deposit to the liquidityPool", async () => {
		const user = await signers[2].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await usd.connect(signers[2]).approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(
			await liquidityPool.connect(signers[2]).callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))
		).to.be.true
		const deposit = await liquidityPool.connect(signers[2]).deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[3].args
		expect(depositEvent.recipient).to.equal(user)
		expect(depositEvent.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceBefore.sub(usdBalanceAfter)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(0)
		expect(lpusdBalanceAfter.sub(lpusdBalanceBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(epochAfter).to.equal(epochBefore)
		expect(pendingDepositAfter.sub(pendingDepositBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositReceiptBefore.epoch).to.equal(0)
		expect(depositReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(depositReceiptAfter.amount.sub(depositReceiptBefore.amount)).to.equal(
			toUSDC(liquidityPoolUsdcDeposit)
		)
		expect(depositReceiptAfter.unredeemedShares.sub(depositReceiptBefore.unredeemedShares)).to.equal(
			0
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(0)
	})
	it("Reverts: User 3: Attempts to redeem before epoch initiation", async () => {
		expect(await liquidityPool.connect(signers[2]).callStatic.redeem(toWei("100000"))).to.equal(0)
	})
	it("Reverts: User 3: Attempts to initiate withdraw before epoch initiation", async () => {
		await expect(
			liquidityPool.connect(signers[2]).initiateWithdraw(toWei("100000"))
		).to.be.revertedWith("InsufficientShareBalance()")
	})
	it("Reverts: User 3: Attempts to complete withdraw before epoch initiation", async () => {
		await expect(
			liquidityPool.connect(signers[2]).completeWithdraw(toWei("100000"))
		).to.be.revertedWith("NoExistingWithdrawal()")
	})
	it("Succeed: User 1: redeems all shares", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		// set as big number to redeem all
		const toRedeem = await liquidityPool.callStatic.redeem(toWei("100000000000000"))
		await liquidityPool.redeem(toWei("100000000000000"))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Redeem(), 0)
		const redeemEvent = logs[0].args
		expect(redeemEvent.recipient).to.equal(user)
		expect(redeemEvent.amount).to.equal(toRedeem)
		expect(redeemEvent.epoch).to.equal(epochBefore.sub(1))
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceAfter.sub(lpBalanceBefore)).to.equal(toRedeem)
		expect(lpusdBalanceBefore).to.equal(lpusdBalanceAfter)
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(toRedeem)
		expect(epochAfter).to.equal(epochBefore)
		expect(depositReceiptAfter.epoch).to.equal(epochBefore.sub(1)).to.equal(epochAfter.sub(1))
		expect(depositReceiptBefore.amount.sub(depositReceiptAfter.amount)).to.equal(
			depositReceiptBefore.amount
		)
		expect(depositReceiptAfter.amount).to.equal(0)
		expect(depositReceiptAfter.unredeemedShares.sub(depositReceiptBefore.unredeemedShares)).to.equal(
			0
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(0)
		expect(await liquidityPool.allowance(liquidityPool.address, user)).to.equal(0)
	})
	it("Revert: User 1: redeems all shares again", async () => {
		expect(await liquidityPool.callStatic.redeem(toWei("100000000000000"))).to.equal(0)
	})
	it("Succeed: User 2: redeems partial shares", async () => {
		const user = receiverAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		// set as big number to redeem all
		const toRedeem = await liquidityPool
			.connect(signers[1])
			.callStatic.redeem(toWei(liquidityPoolUsdcDeposit).div(2))
		await liquidityPool.connect(signers[1]).redeem(toWei(liquidityPoolUsdcDeposit).div(2))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Redeem(), 0)
		const redeemEvent = logs[1].args
		expect(redeemEvent.recipient).to.equal(user)
		expect(redeemEvent.amount).to.equal(toRedeem)
		expect(redeemEvent.epoch).to.equal(epochBefore.sub(1))
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceAfter.sub(lpBalanceBefore)).to.equal(toRedeem)
		expect(lpusdBalanceBefore).to.equal(lpusdBalanceAfter)
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(toRedeem)
		expect(epochAfter).to.equal(epochBefore)
		expect(depositReceiptAfter.epoch).to.equal(epochBefore.sub(1)).to.equal(epochAfter.sub(1))
		expect(depositReceiptBefore.amount.sub(depositReceiptAfter.amount)).to.equal(
			depositReceiptBefore.amount
		)
		expect(depositReceiptAfter.amount).to.equal(0)
		expect(depositReceiptAfter.unredeemedShares.sub(depositReceiptBefore.unredeemedShares)).to.equal(
			toWei(liquidityPoolUsdcDeposit).div(2)
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(toWei(liquidityPoolUsdcDeposit).div(2))
		expect(pendingDepositAfter).to.equal(pendingDepositBefore)
		expect(await liquidityPool.allowance(liquidityPool.address, user)).to.equal(0)
	})
	it("Succeed: User 1: Initiates Withdraw for half owned balance", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		await liquidityPool.initiateWithdraw(lpBalanceBefore.div(2))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.InitiateWithdraw(), 0)
		const initWithdrawEvent = logs[0].args
		expect(initWithdrawEvent.recipient).to.equal(user)
		expect(initWithdrawEvent.amount).to.equal(lpBalanceBefore.div(2))
		expect(initWithdrawEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(lpBalanceBefore.div(2))
		expect(lpusdBalanceAfter).to.equal(lpusdBalanceBefore)
		expect(lplpBalanceAfter.sub(lplpBalanceBefore)).to.equal(lpBalanceBefore.div(2))
		expect(withdrawalReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(withdrawalReceiptBefore.epoch).to.equal(0)
		expect(withdrawalReceiptAfter.shares).to.equal(lpBalanceBefore.div(2))
		expect(withdrawalReceiptBefore.shares).to.equal(0)
	})
	it("Succeeds: User 1: LP Writes a ETH/USD put for premium", async () => {
		const [sender] = signers
		const amount = toWei("5")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount, false))[0]
		await usd.approve(handler.address, quote)
		const balance = await usd.balanceOf(senderAddress)
		const seriesAddress = (await handler.callStatic.issueAndWriteOption(proposedSeries, amount))
			.series
		const write = await handler.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const registryUsdBalance = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			amount,
			true
		)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			localDelta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			quote,
			BigNumber.from(priceQuote)
		)
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew), 2)).to.eq(tFormatEth(quote, 2))
	})
	it("Succeeds: pauses trading", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// deliberately underprice quote so that the pool comes out as profitable
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			localDelta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			quote.sub(toWei("100")),
			BigNumber.from(priceQuote)
		)
	})
	it("Reverts: User 1: cant write option", async () => {
		const user = senderAddress
		const amount = toWei("2")
		await usd.approve(liquidityPool.address, toWei("1"))
		await expect(handler.writeOption(optionToken1, amount)).to.be.revertedWith("TradingPaused()")
	})
	it("Reverts: User 1: cant issue and write option", async () => {
		const user = senderAddress
		const amount = toWei("2")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		await usd.approve(liquidityPool.address, toWei("1"))
		await expect(handler.issueAndWriteOption(proposedSeries, amount)).to.be.revertedWith(
			"TradingPaused()"
		)
	})
	it("Succeeds: execute epoch", async () => {
		const epochBefore = await liquidityPool.epoch()
		const pendingDepositBefore = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await liquidityPool.totalSupply()
		await liquidityPool.executeEpochCalculation()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		expect(await liquidityPool.epochPricePerShare(epochBefore)).to.equal(
			toWei("1")
				.mul((await liquidityPool.getNAV()).sub(pendingDepositBefore))
				.div(totalSupplyBefore)
		)
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.epoch()).to.equal(epochBefore.add(1))
		expect(
			pendingDepositBefore.mul(toWei("1")).div(await liquidityPool.epochPricePerShare(epochBefore))
		).to.equal(lplpBalanceAfter.sub(lplpBalanceBefore))
	})
	it("Succeeds: User 3: Deposit to the liquidityPool", async () => {
		const user = await signers[2].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await usd.connect(signers[2]).approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(
			await liquidityPool.connect(signers[2]).callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))
		).to.be.true
		const deposit = await liquidityPool.connect(signers[2]).deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const toRedeem = await liquidityPool.connect(signers[2]).callStatic.redeem(toWei("1000000000"))
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[4].args
		expect(depositEvent.recipient).to.equal(user)
		expect(depositEvent.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceBefore.sub(usdBalanceAfter)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(0)
		expect(lpusdBalanceAfter.sub(lpusdBalanceBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(epochAfter).to.equal(epochBefore)
		expect(pendingDepositAfter.sub(pendingDepositBefore)).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositReceiptBefore.epoch).to.equal(epochBefore.sub(1))
		expect(depositReceiptAfter.epoch).to.equal(epochAfter).to.equal(epochBefore)
		expect(depositReceiptBefore.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositReceiptAfter.amount).to.equal(toUSDC(liquidityPoolUsdcDeposit))
		expect(depositReceiptAfter.unredeemedShares.sub(depositReceiptBefore.unredeemedShares)).to.equal(
			toRedeem
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(toRedeem)
	})
	it("Succeeds: User 1: can complete withdrawal", async () => {
		const user = await signers[0].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const withdrawReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		const toWithdraw = await liquidityPool
			.connect(signers[0])
			.callStatic.completeWithdraw(toWei("1000000000"))
		const withdraw = await liquidityPool.completeWithdraw(lpBalanceBefore)
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const withdrawReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Withdraw(), 0)
		const depositEvent = logs[0].args
		expect(depositEvent.recipient).to.equal(user)
		expect(depositEvent.amount).to.equal(toWithdraw)
		expect(depositEvent.shares).to.equal(withdrawReceiptBefore.shares)
		expect(usdBalanceAfter.sub(usdBalanceBefore)).to.equal(toWithdraw)
		expect(lpBalanceBefore).to.equal(lpBalanceAfter)
		expect(lpusdBalanceBefore.sub(lpusdBalanceAfter)).to.equal(toWithdraw)
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(withdrawReceiptBefore.shares)
		expect(epochBefore).to.equal(epochAfter)
		expect(withdrawReceiptAfter.epoch).to.equal(withdrawReceiptBefore.epoch)
		expect(withdrawReceiptAfter.shares).to.equal(0)
	})
	it("Succeed: User 1: Initiates Withdraw for half owned balance", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		await liquidityPool.initiateWithdraw(lpBalanceBefore.div(2))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.InitiateWithdraw(), 0)
		const initWithdrawEvent = logs[1].args
		expect(initWithdrawEvent.recipient).to.equal(user)
		expect(initWithdrawEvent.amount).to.equal(lpBalanceBefore.div(2))
		expect(initWithdrawEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(lpBalanceBefore.div(2))
		expect(lpusdBalanceAfter).to.equal(lpusdBalanceBefore)
		expect(lplpBalanceAfter.sub(lplpBalanceBefore)).to.equal(lpBalanceBefore.div(2))
		expect(withdrawalReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(withdrawalReceiptBefore.epoch).to.equal(epochBefore.sub(1))
		expect(withdrawalReceiptAfter.shares).to.equal(lpBalanceBefore.div(2))
		expect(withdrawalReceiptBefore.shares).to.equal(0)
	})
	it("Succeed: User 2: Initiates Withdraw for owned balance with same redeemable balance", async () => {
		const user = await signers[1].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const toRedeem = await liquidityPool.connect(signers[1]).callStatic.redeem(lpBalanceBefore)
		await liquidityPool.connect(signers[1]).initiateWithdraw(lpBalanceBefore)
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.InitiateWithdraw(), 0)
		const initWithdrawEvent = logs[logs.length - 1].args
		expect(initWithdrawEvent.recipient).to.equal(user)
		expect(initWithdrawEvent.amount).to.equal(lpBalanceBefore)
		expect(initWithdrawEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceAfter.sub(lpBalanceBefore)).to.equal(0)
		expect(lpusdBalanceAfter).to.equal(lpusdBalanceBefore)
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(withdrawalReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(withdrawalReceiptBefore.epoch).to.equal(0)
		expect(withdrawalReceiptAfter.shares).to.equal(lpBalanceBefore)
		expect(withdrawalReceiptBefore.shares).to.equal(0)
		const logsRedeem = await liquidityPool.queryFilter(liquidityPool.filters.Redeem(), 0)
		const redeemEvent = logsRedeem[logsRedeem.length - 1].args
		expect(redeemEvent.recipient).to.equal(user)
		expect(redeemEvent.amount).to.equal(toRedeem)
		expect(redeemEvent.epoch).to.equal(depositReceiptBefore.epoch)
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceAfter.sub(lpBalanceBefore)).to.equal(0)
		expect(lpBalanceAfter).to.equal(toRedeem)
		expect(lpBalanceBefore).to.equal(toRedeem)
		expect(lpusdBalanceBefore).to.equal(lpusdBalanceAfter)
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(epochAfter).to.equal(epochBefore)
		expect(depositReceiptAfter.epoch).to.equal(redeemEvent.epoch)
		expect(depositReceiptBefore.amount.sub(depositReceiptAfter.amount)).to.equal(
			depositReceiptBefore.amount
		)
		expect(depositReceiptAfter.amount).to.equal(0)
		expect(depositReceiptBefore.unredeemedShares.sub(depositReceiptAfter.unredeemedShares)).to.equal(
			toWei(liquidityPoolUsdcDeposit).div(2)
		)
		expect(depositReceiptAfter.unredeemedShares).to.equal(0)
		expect(await liquidityPool.allowance(liquidityPool.address, user)).to.equal(0)
	})
	it("Succeed: User 2: Initiates Withdraw for owned balance again in same epoch", async () => {
		const user = await signers[1].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.epoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		await liquidityPool.connect(signers[1]).initiateWithdraw(lpBalanceBefore)
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.epoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.InitiateWithdraw(), 0)
		const initWithdrawEvent = logs[logs.length - 1].args
		expect(initWithdrawEvent.recipient).to.equal(user)
		expect(initWithdrawEvent.amount).to.equal(lpBalanceBefore)
		expect(initWithdrawEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceBefore.sub(lpBalanceAfter)).to.equal(lpBalanceBefore)
		expect(lpusdBalanceAfter).to.equal(lpusdBalanceBefore)
		expect(lplpBalanceAfter.sub(lplpBalanceBefore)).to.equal(lpBalanceBefore)
		expect(withdrawalReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(withdrawalReceiptBefore.epoch).to.equal(epochBefore)
		expect(withdrawalReceiptAfter.shares).to.equal(lpBalanceBefore.mul(2))
		expect(withdrawalReceiptBefore.shares).to.equal(lpBalanceBefore)
	})
	it("Succeeds: User 1: LP Writes a ETH/USD put for premium", async () => {
		const [sender] = signers
		const amount = toWei("160")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: CALL_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const singleQ = (
			await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount, false)
		)[0]
		quote = quote.add(singleQ)
		await usd.approve(handler.address, quote)
		const balance = await usd.balanceOf(senderAddress)
		const seriesAddress = (await handler.callStatic.issueAndWriteOption(proposedSeries, amount))
			.series
		const write = await handler.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const callOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const callBalance = await callOptionToken.balanceOf(senderAddress)
		const registryUsdBalance = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		localDelta = localDelta.add(
			await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries, amount, true)
		)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			localDelta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			quote,
			BigNumber.from(priceQuote)
		)
		expect(callBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew), 0)).to.eq(tFormatEth(singleQ, 0))
	})
	it("Reverts: User 1: cannot complete withdrawal because of epoch not closed", async () => {
		await expect(
			liquidityPool.completeWithdraw(await liquidityPool.balanceOf(senderAddress))
		).to.be.revertedWith("EpochNotClosed()")
	})
	it("Succeeds: pauses trading", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// deliberately underprice quote so that the pool comes out as profitable
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			localDelta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			quote.sub(toWei("100")),
			BigNumber.from(priceQuote)
		)
	})
	it("Succeeds: execute epoch", async () => {
		const epochBefore = await liquidityPool.epoch()
		const pendingDepositBefore = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await liquidityPool.totalSupply()
		await liquidityPool.executeEpochCalculation()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		expect(await liquidityPool.epochPricePerShare(epochBefore)).to.equal(
			toWei("1")
				.mul((await liquidityPool.getNAV()).sub(pendingDepositBefore))
				.div(totalSupplyBefore)
		)
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.epoch()).to.equal(epochBefore.add(1))
		expect(
			pendingDepositBefore.mul(toWei("1")).div(await liquidityPool.epochPricePerShare(epochBefore))
		).to.equal(lplpBalanceAfter.sub(lplpBalanceBefore))
	})
	it("Reverts: User 1: cannot complete withdrawal because of insufficient withdrawal liquidity", async () => {
		await expect(
			liquidityPool.completeWithdraw(await liquidityPool.balanceOf(senderAddress))
		).to.be.revertedWith("WithdrawExceedsLiquidity()")
	})
	it("Succeeds: Reduces collateral cap", async () => {
		await liquidityPool.setCollateralCap(toUSDC("100"))
		expect(await liquidityPool.collateralCap()).to.equal(toUSDC("100"))
	})
	it("Reverts: User 1: Deposit to the liquidityPool but hits collat cap", async () => {
		await expect(liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))).to.be.revertedWith(
			"TotalSupplyReached()"
		)
	})
	it("Succeeds: pauses trading from keeper", async () => {
		await liquidityPool.setKeeper(await signers[2].getAddress(), true)
		await liquidityPool.connect(signers[2]).pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// deliberately underprice quote so that the pool comes out as profitable
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			localDelta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			quote.sub(toWei("100")),
			BigNumber.from(priceQuote)
		)
	})
	it("Succeeds: execute epoch from keeper", async () => {
		const epochBefore = await liquidityPool.epoch()
		const pendingDepositBefore = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await liquidityPool.totalSupply()
		await liquidityPool.connect(signers[2]).executeEpochCalculation()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		expect(await liquidityPool.epochPricePerShare(epochBefore)).to.equal(
			toWei("1")
				.mul((await liquidityPool.getNAV()).sub(pendingDepositBefore))
				.div(totalSupplyBefore)
		)
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.epoch()).to.equal(epochBefore.add(1))
		expect(
			pendingDepositBefore.mul(toWei("1")).div(await liquidityPool.epochPricePerShare(epochBefore))
		).to.equal(lplpBalanceAfter.sub(lplpBalanceBefore))
	})
	it("Reverts: pauses trading from unauthorised", async () => {
		await expect(liquidityPool.connect(signers[3]).pauseTradingAndRequest()).to.be.revertedWith("NotKeeper()")

	})
	it("Reverts: execute epoch from unauthorised", async () => {
		await expect(liquidityPool.connect(signers[3]).executeEpochCalculation()).to.be.revertedWith("NotKeeper()")

	})
})
