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
let wethERC20: MintableERC20
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
let collateralAllocatedToVault1: BigNumber
let spotHedgingReactor: UniswapV3HedgingReactor
let exchange: OptionExchange
let pricer: BeyondPricer
let authority: string

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

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
let vaultIdCounter = 1
const CALL_FLAVOR = false
const PUT_FLAVOR = true
const emptySeries = { expiration: 1, strike: 1, isPut: CALL_FLAVOR, collateral: ZERO_ADDRESS, underlying: ZERO_ADDRESS, strikeAsset: ZERO_ADDRESS }
const proposedSeries = {
	expiration: expiration,
	strike: toWei("2000"),
	isPut: CALL_FLAVOR,
	strikeAsset: USDC_ADDRESS[chainId],
	underlying: WETH_ADDRESS[chainId],
	collateral: USDC_ADDRESS[chainId]
}
const tinyAmount = toOpyn("0.01")
describe("Actions tests", async () => {
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
			await portfolioValuesFeed.fulfill(
				weth.address,
				usd.address,
			)
			await liquidityPool.executeEpochCalculation()
			await liquidityPool.redeem(toWei("10000000"))
		})
		it("SETUP: set the pool fee", async function () {
			await exchange.setPoolFee(weth.address, 500)
			expect(await exchange.poolFees(weth.address)).to.equal(500)
		})
	})
	describe("Action checks without operator approved", async () => {
		it("REVERTS: OPYN open vault without operator approved", async () => {
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("OperatorNotApproved()")
		})
	})
	describe("Opyn Open Vault Action checks", async () => {

		it("SUCCEED: set operator", async () => {
			await controller.setOperator(exchange.address, true)
			expect(await controller.isOperator(senderAddress, exchange.address))
		})
		it("SUCCEED: OPYN open vault", async () => {
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])
			expect(await controller.getAccountVaultCounter(senderAddress)).to.equal(vaultIdCounter)
			expect((await controller.getVaultWithDetails(senderAddress, 1))[1]).to.equal(0)
			vaultIdCounter++
		})
		it("SUCCEED: OPYN open vault type 1", async () => {
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], ["1"])
					}]
				}])
			expect(await controller.getAccountVaultCounter(senderAddress)).to.equal(vaultIdCounter)
			expect((await controller.getVaultWithDetails(senderAddress, 2))[1]).to.equal(1)
			vaultIdCounter++
		})
		it("REVERTS: OPYN open vault fails on already made vault", async () => {
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter - 1,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], ["1"])
					}]
				}])).to.be.revertedWith("C15")
		})
		it("REVERTS: OPYN open vault with invalid procedure number", async () => {
			await expect(exchange.operate([
				{
					operation: 2,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 2,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], ["1"])
					}]
				}])).to.be.reverted
		})
		it("REVERTS: OPYN open vault fails on invalid vault type", async () => {
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], ["2"])
					}]
				}])).to.be.revertedWith("A3")
		})
		it("REVERTS: OPYN open vault fails on invalid vault id", async () => {
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 1000,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("C15")
		})
		it("REVERTS: OPYN open vault fails with invalid owner", async () => {
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: exchange.address,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 2,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("UnauthorisedSender()")
		})
	})
	describe("Opyn Deposit Collateral Action checks", async () => {
		it("SUCCEED: OPYN deposit collateral", async () => {
			const margin = toUSDC("1000")
			usd.approve(MARGIN_POOL[chainId], margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(0)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			vaultIdCounter++
		})
		it("SUCCEED: OPYN deposit collateral through exchange", async () => {
			const margin = toUSDC("1000")
			usd.approve(exchange.address, margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(0)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			vaultIdCounter++
		})
		it("SUCCEED: OPYN deposit collateral weth", async () => {
			const margin = toWei("1")
			weth.approve(MARGIN_POOL[chainId], margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: weth.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(0)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			vaultIdCounter++
		})
		it("SUCCEED: OPYN deposit collateral through exchange with weth", async () => {
			const margin = toWei("1")
			weth.approve(exchange.address, margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: weth.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(0)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			vaultIdCounter++
		})
		it("REVERTS: OPYN deposit collateral fails when sending to an invalid address", async () => {
			const margin = toUSDC("1000")
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 4,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: liquidityPool.address,
						asset: usd.address,
						vaultId: 4,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("UnauthorisedSender()")
		})
		it("REVERTS: OPYN deposit collateral fails with invalid owner", async () => {
			const margin = toUSDC("1000")
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 4,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 5,
						owner: exchange.address,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: 4,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("UnauthorisedSender()")
		})
	})
	describe("Opyn Mint/Burn/Deposit/Withdraw Short Option Action checks", async () => {
		it("SUCCEED: OPYN mint short option", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
			usd.approve(MARGIN_POOL[chainId], margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					]
				}])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(1)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			expect(vaultDetails[0].shortAmounts[0]).to.equal(tinyAmount)
			expect(vaultDetails[0].shortOtokens[0]).to.equal(otoken)
			vaultIdCounter++
		})
		it("SUCCEED: OPYN mint short option with collateral deposited via exchange", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
			usd.approve(exchange.address, margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					]
				}])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(1)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			expect(vaultDetails[0].shortAmounts[0]).to.equal(tinyAmount)
			expect(vaultDetails[0].shortOtokens[0]).to.equal(otoken)
			vaultIdCounter++
		})
		it("REVERTS: OPYN mint short option and sends temp holdings to exchange", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
			usd.approve(exchange.address, margin)
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					]
				}])).to.be.revertedWith("TokenImbalance()")
			await usd.approve(exchange.address, 0)
		})
		it("SUCCEED: OPYN mint short option with collateral deposited via exchange then burn the option", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
			usd.approve(exchange.address, margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 2,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},

					]
				}])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(1)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			expect(vaultDetails[0].shortAmounts[0]).to.equal(0)
			expect(vaultDetails[0].shortOtokens[0]).to.equal(ZERO_ADDRESS)
			vaultIdCounter++
		})
		it("REVERTS: OPYN mint short option with collateral deposited via exchange then burn the option from non-sender", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			await exchange.createOtoken(proposedSeries)
			usd.approve(exchange.address, margin)
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 2,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					]
				}])).to.be.revertedWith("UnauthorisedSender()")
			await usd.approve(exchange.address, 0)
		})
		it("SUCCEED: OPYN mint short option with collateral deposited via exchange then deposits the long option from sender in vault 1", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			const otokenERC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			await otokenERC.approve(MARGIN_POOL[chainId], tinyAmount)
			await exchange.createOtoken(proposedSeries)
			usd.approve(exchange.address, margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				},
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 3,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: otoken,
							vaultId: 1,
							amount: tinyAmount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}]
				},
			])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(1)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			expect(vaultDetails[0].shortAmounts[0]).to.equal(tinyAmount)
			expect(vaultDetails[0].shortOtokens[0]).to.equal(otoken)
			const vault1Details = await controller.getVaultWithDetails(senderAddress, 1)
			expect(vault1Details[0].longAmounts[0]).to.equal(tinyAmount)
			expect(vault1Details[0].longOtokens[0]).to.equal(otoken)
			vaultIdCounter++
		})
		it("REVERTS: OPYN mint short option with collateral deposited via exchange then deposits the long option from sender in vault 1", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			const otokenERC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			await otokenERC.approve(MARGIN_POOL[chainId], tinyAmount)
			await exchange.createOtoken(proposedSeries)
			usd.approve(exchange.address, margin)
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				},
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 3,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: 1,
							amount: tinyAmount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}]
				},
			])).to.be.revertedWith("UnauthorisedSender()")
			await usd.approve(exchange.address, 0)
			await otokenERC.approve(MARGIN_POOL[chainId], 0)
		})
		it("SUCCEED: OPYN mint short option with collateral deposited via exchange then deposits the long option from sender in vault 1 and withdraws to sender", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			const otokenERC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			await otokenERC.approve(MARGIN_POOL[chainId], tinyAmount)
			await exchange.createOtoken(proposedSeries)
			usd.approve(exchange.address, margin)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				},
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 4,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: otoken,
							vaultId: 1,
							amount: tinyAmount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}]
				},
			])
			const vaultId = await controller.getAccountVaultCounter(senderAddress)
			const vaultDetails = await controller.getVaultWithDetails(senderAddress, vaultId)
			expect(vaultId).to.equal(vaultIdCounter)
			expect((vaultDetails)[1]).to.equal(1)
			expect(vaultDetails[0].collateralAmounts[0]).to.equal(margin)
			expect(vaultDetails[0].shortAmounts[0]).to.equal(tinyAmount)
			expect(vaultDetails[0].shortOtokens[0]).to.equal(otoken)
			const vault1Details = await controller.getVaultWithDetails(senderAddress, 1)
			expect(vault1Details[0].longAmounts[0]).to.equal(0)
			expect(vault1Details[0].longOtokens[0]).to.equal(ZERO_ADDRESS)
			vaultIdCounter++
		})
		it("REVERTS: OPYN mint short option with collateral deposited via exchange then deposits the long option from sender in vault 1 and withdraws to exchange", async () => {
			const margin = toUSDC("1000")
			const otoken = await exchange.callStatic.createOtoken(proposedSeries)
			const otokenERC = (await ethers.getContractAt("Otoken", otoken)) as Otoken
			await otokenERC.approve(MARGIN_POOL[chainId], tinyAmount)
			await exchange.createOtoken(proposedSeries)
			usd.approve(exchange.address, margin)
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 0,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: vaultIdCounter,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: abiCode.encode(["uint256"], [1])
					},
					{
						actionType: 5,
						owner: senderAddress,
						secondAddress: exchange.address,
						asset: usd.address,
						vaultId: vaultIdCounter,
						amount: margin,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					},
					{
						actionType: 1,
						owner: senderAddress,
						secondAddress: senderAddress,
						asset: otoken,
						vaultId: vaultIdCounter,
						amount: tinyAmount,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				},
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 3,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: otoken,
							vaultId: 1,
							amount: tinyAmount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						},
						{
							actionType: 4,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: 1,
							amount: tinyAmount,
							optionSeries: emptySeries,
							index: 0,
							data: "0x"
						}]
				},
			])).to.be.revertedWith("TokenImbalance()")
			await usd.approve(exchange.address, 0)
			await otokenERC.approve(MARGIN_POOL[chainId], 0)
		})
	})
	describe("Opyn Forbidden Actions", async () => {
		it("REVERTS: OPYN liquidate", async () => {
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 10,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 1,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("ForbiddenAction()")
		})
		it("REVERTS: OPYN call", async () => {
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 9,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 1,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("ForbiddenAction()")
		})
		it("REVERTS: OPYN redeem", async () => {
			await expect(exchange.operate([
				{
					operation: 0,
					operationQueue: [{
						actionType: 8,
						owner: senderAddress,
						secondAddress: ZERO_ADDRESS,
						asset: ZERO_ADDRESS,
						vaultId: 1,
						amount: 0,
						optionSeries: emptySeries,
						index: 0,
						data: "0x"
					}]
				}])).to.be.revertedWith("ForbiddenAction()")
		})
	})
})
