import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Contract, Signer, utils } from "ethers"
import hre, { ethers } from "hardhat"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import { Accounting, AlphaPortfolioValuesFeed, BeyondPricer, LiquidityPool, MintableERC20, MockChainlinkAggregator, OptionCatalogue, OptionExchange, OptionRegistry, Oracle, Otoken as IOToken, PriceFeed, Protocol, VolatilityFeed, WETH } from "../types"
import { CALL_FLAVOR, emptySeries, fromUSDC, fromWei, PUT_FLAVOR, tFormatUSDC, toOpyn, toUSDC, toWei, toWeiFromUSDC, ZERO_ADDRESS } from "../utils/conversion-helper"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { deployOpyn } from "../utils/opyn-deployer"
import { calculateOptionDeltaLocally, getSeriesWithe18Strike, makeBuy, makeIssueAndBuy, setupTestOracle } from "./helpers"

dayjs.extend(utc)

let usd: MintableERC20
let weth: WETH
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let volFeed: VolatilityFeed
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let priceFeed: PriceFeed
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let portfolioValuesFeed: AlphaPortfolioValuesFeed
let exchange: OptionExchange
let pricer: BeyondPricer
let optionToken1: Otoken
let priceQuote: any
let quote: any
let localDelta: any
let authority: string
let accounting: Accounting
let catalogue: OptionCatalogue

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

const collatDecimalShift = BigNumber.from(1000000000000)
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = "20"

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "150000"

const expiration = dayjs.utc(expiryDate).add(8, "hours").unix()

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
		let opynParams = await deployOpyn(signers)
		oracle = opynParams.oracle
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
			optionRegistry,
			portfolioValuesFeed,
			authority
		)
		liquidityPool = lpParams.liquidityPool
		exchange = lpParams.exchange
		pricer = lpParams.pricer
		accounting = lpParams.accounting
		catalogue = lpParams.catalogue
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
	it("Succeeds: User 1: Deposit to the liquidityPool", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.depositEpoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()

		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(await liquidityPool.callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))).to.be.true
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.depositEpoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()

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
		expect(pendingWithdrawBefore).to.eq(0)
		expect(pendingWithdrawAfter).to.eq(pendingWithdrawBefore)
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
		const epochBefore = await liquidityPool.depositEpoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		expect(await liquidityPool.callStatic.deposit(toUSDC(liquidityPoolUsdcDeposit))).to.be.true
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.depositEpoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const logs = await liquidityPool
			.connect(signers[1])
			.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[1].args
		expect(pendingWithdrawAfter).to.eq(0)
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
		const epochBefore = await liquidityPool.depositEpoch()
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
		const epochAfter = await liquidityPool.depositEpoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Deposit(), 0)
		const depositEvent = logs[2].args
		expect(pendingWithdrawAfter).to.eq(0)
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
		await expect(liquidityPool.deposit(0)).to.be.revertedWithCustomError(
			liquidityPool,
			"InvalidAmount"
		)
		await expect(liquidityPool.redeem(0)).to.be.revertedWithCustomError(
			liquidityPool,
			"InvalidShareAmount"
		)
		await expect(liquidityPool.initiateWithdraw(0)).to.be.revertedWithCustomError(
			liquidityPool,
			"InvalidShareAmount"
		)
	})
	it("Reverts: User 1: Attempts to redeem before epoch initiation", async () => {
		const user = senderAddress
		expect(await liquidityPool.callStatic.redeem(toWei("100000"))).to.equal(0)
	})
	it("Reverts: User 1: Attempts to initiate withdraw before epoch initiation", async () => {
		const user = senderAddress
		await expect(liquidityPool.initiateWithdraw(toWei("100000"))).to.be.revertedWithCustomError(
			accounting,
			"InsufficientShareBalance"
		)
	})
	it("Reverts: User 1: Attempts to complete withdraw before epoch initiation", async () => {
		const user = senderAddress
		await expect(liquidityPool.completeWithdraw()).to.be.revertedWithCustomError(
			accounting,
			"NoExistingWithdrawal"
		)
	})
	it("Reverts: execute epoch before pause", async () => {
		await expect(liquidityPool.executeEpochCalculation()).to.be.revertedWithCustomError(
			liquidityPool,
			"TradingNotPaused"
		)
	})
	it("Succeeds: pauses trading", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
	})
	it("Succeeds: execute epoch", async () => {
		const depositEpochBefore = await liquidityPool.depositEpoch()
		const withdrawalEpochBefore = await liquidityPool.withdrawalEpoch()
		const pendingDepositBefore = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await liquidityPool.totalSupply()
		const partitionedFundsBefore = await liquidityPool.partitionedFunds()
		await liquidityPool.executeEpochCalculation()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const pendingDepositAfter = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const partitionedFundsAfter = await liquidityPool.partitionedFunds()
		const partitionedFundsDiffe18 = toWeiFromUSDC(
			partitionedFundsAfter.sub(partitionedFundsBefore).toString()
		)
		// check partitioned funds increased by pendingWithdrawals * price per share
		expect(
			parseFloat(fromWei(partitionedFundsDiffe18)) -
			parseFloat(fromWei(pendingWithdrawBefore)) *
			parseFloat(fromWei(await liquidityPool.withdrawalEpochPricePerShare(withdrawalEpochBefore)))
		).to.be.within(-0.0001, 0.0001)
		expect(await liquidityPool.depositEpochPricePerShare(depositEpochBefore)).to.equal(
			totalSupplyBefore.eq(0)
				? toWei("1")
				: toWei("1")
					.mul((await liquidityPool.getNAV()).add(partitionedFundsDiffe18).sub(pendingDepositBefore))
					.div(totalSupplyBefore)
		)
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(pendingDepositBefore).to.not.eq(0)
		expect(pendingWithdrawAfter).to.eq(0)
		expect(pendingDepositAfter).to.eq(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.depositEpoch()).to.equal(depositEpochBefore.add(1))
		expect(
			pendingDepositBefore
				.mul(toWei("1"))
				.div(await liquidityPool.depositEpochPricePerShare(depositEpochBefore))
		).to.equal(lplpBalanceAfter.sub(lplpBalanceBefore))
	})
	it("Succeeds: User 3: Deposit to the liquidityPool", async () => {
		const user = await signers[2].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.depositEpoch()
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
		const epochAfter = await liquidityPool.depositEpoch()
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
		).to.be.revertedWithCustomError(accounting, "InsufficientShareBalance")
	})
	it("Reverts: User 3: Attempts to complete withdraw before epoch initiation", async () => {
		await expect(liquidityPool.connect(signers[2]).completeWithdraw()).to.be.revertedWithCustomError(
			accounting,
			"NoExistingWithdrawal"
		)
	})
	it("Succeed: User 1: redeems all shares", async () => {
		const user = senderAddress
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.depositEpoch()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		// set as big number to redeem all
		const toRedeem = await liquidityPool.callStatic.redeem(toWei("100000000000000"))
		await liquidityPool.redeem(toWei("100000000000000"))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.depositEpoch()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const pendingDepositAfter = await liquidityPool.pendingDeposits()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Redeem(), 0)
		const redeemEvent = logs[0].args
		expect(pendingDepositBefore).to.eq(pendingDepositAfter)
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
		const epochBefore = await liquidityPool.depositEpoch()
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
		const epochAfter = await liquidityPool.depositEpoch()
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
		const epochBefore = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		await liquidityPool.initiateWithdraw(lpBalanceBefore.div(2))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.InitiateWithdraw(), 0)
		const initWithdrawEvent = logs[0].args
		expect(pendingWithdrawBefore).to.eq(0)
		expect(pendingWithdrawAfter).to.eq(lpBalanceBefore.div(2))
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
	it("SETUP: approve series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		await catalogue.issueNewSeries([
			{
				expiration: expiration,
				isPut: PUT_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			}
		])
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
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		quote = quoteResponse[0].add(quoteResponse[2])
		await usd.approve(exchange.address, quote)
		const balance = await usd.balanceOf(senderAddress)
		await makeIssueAndBuy(exchange, senderAddress, ZERO_ADDRESS, amount, proposedSeries)
		const seriesAddress = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		optionToken1 = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await optionToken1.balanceOf(senderAddress)
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
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew), 2)).to.eq(tFormatUSDC(quote, 2))
	})
	it("Succeeds: pauses trading", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// deliberately underprice quote so that the pool comes out as profitable
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
	})
	it("Reverts: User 1: cant write option", async () => {
		const user = senderAddress
		const amount = toWei("2")
		await usd.approve(exchange.address, toWei("1"))
		await expect(
			makeBuy(exchange, senderAddress, optionToken1.address, amount, emptySeries)
		).to.be.revertedWithCustomError(liquidityPool, "TradingPaused")
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
		await usd.approve(exchange.address, toWei("1"))
		await expect(
			makeIssueAndBuy(exchange, senderAddress, ZERO_ADDRESS, amount, proposedSeries)
		).to.be.revertedWithCustomError(liquidityPool, "TradingPaused")
	})
	it("Succeeds: execute epoch", async () => {
		const depositEpochBefore = await liquidityPool.depositEpoch()
		const withdrawalEpochBefore = await liquidityPool.withdrawalEpoch()
		const pendingDepositBefore = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await liquidityPool.totalSupply()
		const partitionedFundsBefore = await liquidityPool.partitionedFunds()
		await liquidityPool.executeEpochCalculation()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const pendingDepositAfter = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const partitionedFundsAfter = await liquidityPool.partitionedFunds()
		const partitionedFundsDiffe18 = toWeiFromUSDC(
			partitionedFundsAfter.sub(partitionedFundsBefore).toString()
		)
		// check partitioned funds increased by pendingWithdrawals * price per share
		expect(
			parseFloat(fromWei(partitionedFundsDiffe18)) -
			parseFloat(fromWei(pendingWithdrawBefore)) *
			parseFloat(fromWei(await liquidityPool.withdrawalEpochPricePerShare(withdrawalEpochBefore)))
		).to.be.within(-0.0001, 0.0001)
		expect(await liquidityPool.depositEpochPricePerShare(depositEpochBefore)).to.equal(
			totalSupplyBefore.eq(0)
				? toWei("1")
				: toWei("1")
					.mul((await liquidityPool.getNAV()).add(partitionedFundsDiffe18).sub(pendingDepositBefore))
					.div(totalSupplyBefore)
		)
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(pendingDepositBefore).to.not.eq(0)
		expect(pendingWithdrawAfter).to.eq(0)
		expect(pendingDepositAfter).to.eq(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.depositEpoch()).to.equal(depositEpochBefore.add(1))
		expect(
			pendingDepositBefore
				.mul(toWei("1"))
				.div(await liquidityPool.depositEpochPricePerShare(depositEpochBefore))
		).to.equal(lplpBalanceAfter.sub(lplpBalanceBefore).add(pendingWithdrawBefore))
	})
	it("Succeeds: User 3: Deposit to the liquidityPool", async () => {
		const user = await signers[2].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.depositEpoch()
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
		const epochAfter = await liquidityPool.depositEpoch()
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
		const epochBefore = await liquidityPool.withdrawalEpoch()
		const withdrawReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		const toWithdraw = await liquidityPool.connect(signers[0]).callStatic.completeWithdraw()
		const withdraw = await liquidityPool.completeWithdraw()
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.withdrawalEpoch()
		const withdrawReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.Withdraw(), 0)
		const depositEvent = logs[0].args
		expect(pendingWithdrawAfter).to.eq(pendingWithdrawBefore)
		expect(depositEvent.recipient).to.equal(user)
		expect(depositEvent.amount).to.equal(toWithdraw)
		expect(depositEvent.shares).to.equal(withdrawReceiptBefore.shares)
		expect(usdBalanceAfter.sub(usdBalanceBefore)).to.equal(toWithdraw)
		expect(lpBalanceBefore).to.equal(lpBalanceAfter)
		expect(lpusdBalanceBefore.sub(lpusdBalanceAfter)).to.equal(toWithdraw)
		expect(lplpBalanceBefore).to.equal(lplpBalanceAfter)
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
		const epochBefore = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		await liquidityPool.initiateWithdraw(lpBalanceBefore.div(2))
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
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
		expect(pendingWithdrawAfter).to.eq(pendingWithdrawBefore.add(lpBalanceBefore.div(2)))
	})
	it("Succeed: User 2: Initiates Withdraw for owned balance with same redeemable balance", async () => {
		const user = await signers[1].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)

		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		const depositReceiptBefore = await liquidityPool.depositReceipts(user)
		const toRedeem = await liquidityPool.connect(signers[1]).callStatic.redeem(lpBalanceBefore)
		await liquidityPool.connect(signers[1]).initiateWithdraw(lpBalanceBefore)
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const depositReceiptAfter = await liquidityPool.depositReceipts(user)
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.InitiateWithdraw(), 0)
		const initWithdrawEvent = logs[logs.length - 1].args
		expect(pendingWithdrawAfter).to.eq(pendingWithdrawBefore.add(lpBalanceBefore))
		expect(initWithdrawEvent.recipient).to.equal(user)
		expect(initWithdrawEvent.amount).to.equal(lpBalanceBefore)
		expect(initWithdrawEvent.epoch).to.equal(epochBefore)
		expect(usdBalanceAfter).to.equal(usdBalanceBefore)
		expect(lpBalanceAfter.sub(lpBalanceBefore)).to.equal(0)
		expect(lpusdBalanceAfter).to.equal(lpusdBalanceBefore)
		expect(lplpBalanceBefore.sub(lplpBalanceAfter)).to.equal(0)
		expect(withdrawalReceiptAfter.epoch).to.equal(epochBefore).to.equal(epochAfter)
		expect(withdrawalReceiptBefore.epoch).to.equal(0)
		// using redeemable funds only
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
		expect(pendingWithdrawAfter).to.eq(pendingWithdrawBefore.add(lpBalanceBefore))
	})
	it("Succeed: User 2: Initiates Withdraw for owned balance again in same epoch (not using redeemable shares)", async () => {
		const user = await signers[1].getAddress()
		const usdBalanceBefore = await usd.balanceOf(user)
		const lpBalanceBefore = await liquidityPool.balanceOf(user)
		const lpusdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const epochBefore = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptBefore = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		await liquidityPool.connect(signers[1]).initiateWithdraw(lpBalanceBefore)
		const usdBalanceAfter = await usd.balanceOf(user)
		const lpBalanceAfter = await liquidityPool.balanceOf(user)
		const lpusdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const epochAfter = await liquidityPool.withdrawalEpoch()
		const withdrawalReceiptAfter = await liquidityPool.withdrawalReceipts(user)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const logs = await liquidityPool.queryFilter(liquidityPool.filters.InitiateWithdraw(), 0)
		const initWithdrawEvent = logs[logs.length - 1].args
		expect(pendingWithdrawAfter).to.eq(pendingWithdrawBefore.add(lpBalanceBefore))
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
	it("SETUP: approve series", async () => {
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		await catalogue.issueNewSeries([
			{
				expiration: expiration,
				isPut: CALL_FLAVOR,
				strike: BigNumber.from(strikePrice),
				isSellable: true,
				isBuyable: true
			}
		])
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
		let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, false, 0)
		const singleQ = quoteResponse[0].add(quoteResponse[2])
		quote = quote.add(singleQ)
		await usd.approve(exchange.address, quote)
		const balance = await usd.balanceOf(senderAddress)
		await makeIssueAndBuy(exchange, senderAddress, ZERO_ADDRESS, amount, proposedSeries)
		const seriesAddress = await getSeriesWithe18Strike(proposedSeries, optionRegistry)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const callOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const callBalance = await callOptionToken.balanceOf(senderAddress)
		const registryUsdBalance = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		localDelta = localDelta.add(
			await calculateOptionDeltaLocally(liquidityPool, priceFeed, proposedSeries, amount, true)
		)
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
		expect(callBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew), 0)).to.eq(tFormatUSDC(singleQ, 0))
	})
	it("Reverts: User 1: cannot complete withdrawal because of epoch not closed", async () => {
		await expect(liquidityPool.completeWithdraw()).to.be.revertedWithCustomError(
			accounting,
			"EpochNotClosed"
		)
	})
	it("Succeeds: pauses trading", async () => {
		await liquidityPool.pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// deliberately underprice quote so that the pool comes out as profitable
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
	})
	it("Succeeds: execute epoch with not enough funds to execute withdrawals", async () => {
		const lpUsdBalance = await usd.balanceOf(liquidityPool.address)
		const depositEpochBefore = await liquidityPool.depositEpoch()
		const withdrawalEpochBefore = await liquidityPool.withdrawalEpoch()
		const bufferRemaining = parseFloat(
			fromUSDC(
				lpUsdBalance
					.sub(await liquidityPool.partitionedFunds())
					.sub(
						(await liquidityPool.collateralAllocated())
							.mul(await liquidityPool.bufferPercentage())
							.div(10000)
					)
			)
		)
		const lpAssets = await liquidityPool.getAssets()
		const lpNav = await liquidityPool.getNAV()
		// liabilities = assets - NAV
		const totalWithdrawAmount = parseFloat(
			fromUSDC(
				(
					await accounting.executeEpochCalculation(
						await liquidityPool.totalSupply(),
						lpAssets,
						lpAssets.sub(lpNav)
					)
				).totalWithdrawAmount
			)
		)
		expect(totalWithdrawAmount).to.be.greaterThan(bufferRemaining)
		const pendingDepositBefore = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await liquidityPool.totalSupply()
		await liquidityPool.executeEpochCalculation()
		const depositEpochAfter = await liquidityPool.depositEpoch()
		const withdrawalEpochAfter = await liquidityPool.withdrawalEpoch()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const pendingDepositAfter = (await liquidityPool.pendingDeposits()).mul(collatDecimalShift)
		expect(depositEpochAfter).to.eq(depositEpochBefore.add(1))
		expect(withdrawalEpochAfter).to.eq(withdrawalEpochBefore)
		expect(pendingWithdrawBefore).to.not.eq(0)
		expect(pendingWithdrawAfter).to.eq(pendingWithdrawBefore)
		expect(pendingDepositAfter).to.eq(0)
		// no partitionedFunds diff this time
		expect(await liquidityPool.depositEpochPricePerShare(depositEpochBefore)).to.equal(
			totalSupplyBefore.eq(0)
				? toWei("1")
				: toWei("1")
					.mul((await liquidityPool.getNAV()).sub(pendingDepositBefore))
					.div(totalSupplyBefore)
		)

		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.depositEpoch()).to.equal(depositEpochBefore.add(1))
		// withdrawal epoch not executed
		expect(await liquidityPool.withdrawalEpoch()).to.eq(withdrawalEpochBefore)
		expect(
			pendingDepositBefore
				.mul(toWei("1"))
				.div(await liquidityPool.depositEpochPricePerShare(depositEpochBefore))
		).to.equal(lplpBalanceAfter.sub(lplpBalanceBefore))
	})
	it("Reverts: User 1: still cannot complete withdrawal because of withdrawal epoch not closed", async () => {
		await expect(liquidityPool.completeWithdraw()).to.be.revertedWithCustomError(
			accounting,
			"EpochNotClosed"
		)
	})
	it("Succeeds: Reduces collateral cap", async () => {
		await liquidityPool.setCollateralCap(toUSDC("100"))
		expect(await liquidityPool.collateralCap()).to.equal(toUSDC("100"))
	})
	it("Reverts: User 1: Deposit to the liquidityPool but hits collat cap", async () => {
		await expect(
			liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
		).to.be.revertedWithCustomError(accounting, "TotalSupplyReached")
	})
	it("Succeeds: Raises collateral cap", async () => {
		await liquidityPool.setCollateralCap(toWei("100000000000000000"))
		expect(await liquidityPool.collateralCap()).to.equal(toWei("100000000000000000"))
	})
	it("Succeeds: pauses trading from keeper", async () => {
		await liquidityPool.setKeeper(await signers[2].getAddress(), true)
		await liquidityPool.connect(signers[2]).pauseTradingAndRequest()
		expect(await liquidityPool.isTradingPaused()).to.be.true
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// deliberately underprice quote so that the pool comes out as profitable
		await portfolioValuesFeed.fulfill(weth.address, usd.address)
	})

	it("Succeeds: execute epoch from keeper", async () => {
		// deposit more funds to allow withdrawal withdrawal epoch to execute
		const user = await signers[2].getAddress()
		await usd.connect(signers[2]).approve(liquidityPool.address, toUSDC("200000"))
		await liquidityPool.connect(signers[2]).deposit(toUSDC("200000"))
		const lpUsdBalance = await usd.balanceOf(liquidityPool.address)
		const bufferRemaining = parseFloat(
			fromUSDC(
				lpUsdBalance
					.sub(await liquidityPool.partitionedFunds())
					.sub(
						(await liquidityPool.collateralAllocated())
							.mul(await liquidityPool.bufferPercentage())
							.div(10000)
					)
			)
		)
		const lpAssets = await liquidityPool.getAssets()
		const lpNav = await liquidityPool.getNAV()
		// liabilities = assets - NAV

		const depositEpochBefore = await liquidityPool.depositEpoch()
		const withdrawalEpochBefore = await liquidityPool.withdrawalEpoch()
		const pendingDepositBefore = await liquidityPool.pendingDeposits()
		const pendingWithdrawBefore = await liquidityPool.pendingWithdrawals()
		const partitionedFundsBefore = await liquidityPool.partitionedFunds()
		const lplpBalanceBefore = await liquidityPool.balanceOf(liquidityPool.address)
		const totalSupplyBefore = await liquidityPool.totalSupply()
		await liquidityPool.connect(signers[2]).executeEpochCalculation()
		const lplpBalanceAfter = await liquidityPool.balanceOf(liquidityPool.address)
		const pendingWithdrawAfter = await liquidityPool.pendingWithdrawals()
		const depositEpochAfter = await liquidityPool.depositEpoch()
		const partitionedFundsAfter = await liquidityPool.partitionedFunds()
		const withdrawalEpochAfter = await liquidityPool.withdrawalEpoch()
		const partitionedFundsDiffe18 = toWeiFromUSDC(
			partitionedFundsAfter.sub(partitionedFundsBefore).toString()
		)
		// check partitioned funds increased by pendingWithdrawals * price per share
		expect(
			parseFloat(fromWei(partitionedFundsDiffe18)) -
			parseFloat(fromWei(pendingWithdrawBefore)) *
			parseFloat(fromWei(await liquidityPool.withdrawalEpochPricePerShare(withdrawalEpochBefore)))
		).to.be.within(-0.0001, 0.0001)
		expect(pendingWithdrawAfter).to.eq(0)
		// check depositEpochPricePerShare is correct
		expect(fromWei(await liquidityPool.depositEpochPricePerShare(depositEpochBefore))).to.equal(
			fromWei(
				toWei("1")
					.mul(
						(await liquidityPool.getNAV())
							.add(partitionedFundsDiffe18)
							.sub(toWeiFromUSDC(pendingDepositBefore.toString()))
					)
					.div(totalSupplyBefore)
			)
		)
		expect(depositEpochAfter).to.eq(depositEpochBefore.add(1))
		expect(withdrawalEpochAfter).to.eq(withdrawalEpochBefore.add(1))
		expect(await liquidityPool.pendingDeposits()).to.equal(0)
		expect(await liquidityPool.isTradingPaused()).to.be.false
		expect(await liquidityPool.depositEpoch()).to.equal(depositEpochBefore.add(1))
		expect(
			toWeiFromUSDC(pendingDepositBefore.toString())
				.mul(toWei("1"))
				.div(await liquidityPool.depositEpochPricePerShare(depositEpochBefore))
		).to.equal(lplpBalanceAfter.sub(lplpBalanceBefore).add(pendingWithdrawBefore))
	})
	it("Reverts: pauses trading from unauthorised", async () => {
		await expect(
			liquidityPool.connect(signers[3]).pauseTradingAndRequest()
		).to.be.revertedWithCustomError(liquidityPool, "NotKeeper")
	})
	it("Reverts: execute epoch from unauthorised", async () => {
		await expect(
			liquidityPool.connect(signers[3]).executeEpochCalculation()
		).to.be.revertedWithCustomError(liquidityPool, "NotKeeper")
	})
})

describe("bug: stuck after initiating a withdrawal with shares amount less than 1e12", async () => {
	it("should not be stuck", async () => {
		const user = signers[2]
		const amount = utils.parseUnits("1000", 6)

		await usd.connect(user).approve(liquidityPool.address, amount)
		await liquidityPool.connect(user).deposit(amount, { gasLimit: 1000000 })

		await liquidityPool.pauseTradingAndRequest()
		await liquidityPool.executeEpochCalculation()

		const shareFraction = "99999999999" // 1e12 - 1
		await liquidityPool.connect(user).initiateWithdraw(shareFraction, { gasLimit: 1000000 })

		await liquidityPool.pauseTradingAndRequest()
		await liquidityPool.executeEpochCalculation()

		// this should not fail
		await expect(liquidityPool.connect(user).completeWithdraw()).to.not.be.reverted

		// this is expected to execute since there is no pending withdrawal because completewithdraw executed
		const sharesInRegularRange = utils.parseUnits("10")
		await expect(liquidityPool.connect(user).initiateWithdraw(sharesInRegularRange)).to.not.be
			.reverted

		const withdrawalEpoch = await liquidityPool.withdrawalEpoch()
		const pricePerShare = await liquidityPool.withdrawalEpochPricePerShare(withdrawalEpoch.sub(1))
		const amountForShares = await accounting.amountForShares(shareFraction, pricePerShare)
		expect(amountForShares).to.eq("0")
	})
})
