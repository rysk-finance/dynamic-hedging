import hre, { ethers, network } from "hardhat"
import { Contract, utils, Signer, BigNumber, BigNumberish } from "ethers"
import {
	toWei,
	call,
	put,
	fromOpyn,
	scaleNum,
	createValidExpiry,
	MAX_BPS
} from "../utils/conversion-helper"
import { expect } from "chai"
import moment from "moment"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import { LiquidityPoolAdjustCollateralTest } from "../types/LiquidityPoolAdjustCollateralTest"
import { NewController } from "../types/NewController"
import { AddressBook } from "../types/AddressBook"
import { Oracle } from "../types/Oracle"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import { ERC20Interface } from "../types/ERC20Interface"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry, OptionSeriesStruct } from "../types/OptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { WETH } from "../types/WETH"
import {
	CHAINLINK_WETH_PRICER,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS,
	CONTROLLER_OWNER,
	ADDRESS_BOOK,
	GAMMA_ORACLE_NEW
} from "./constants"
import { deployOpyn } from "../utils/opyn-deployer"
import { setupOracle, setOpynOracleExpiryPrice, setupTestOracle, increase } from "./helpers"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { AbiCoder } from "ethers/lib/utils"
import { ChainLinkPricer } from "../types/ChainLinkPricer"

let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let liquidityPool: LiquidityPoolAdjustCollateralTest
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Contract
let optionRegistry: OptionRegistry
let optionRegistryETH: OptionRegistry
let optionTokenUSDC: IOToken
let optionTokenETH: IOToken
let erc20PutOptionUSDC: IOToken
let erc20PutOptionETH: IOToken
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let aggregator: MockChainlinkAggregator
let pricer: string
let proposedSeries: OptionSeriesStruct
let proposedSeriesETH: OptionSeriesStruct

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

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
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
// array of upper bound value correspond to time to expiry
const expiryToValue = [
	scaleNum("0.1678", 27),
	scaleNum("0.237", 27),
	scaleNum("0.3326", 27),
	scaleNum("0.4032", 27),
	scaleNum("0.4603", 27)
]
// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
let strike = toWei("3500")

// handles the conversion of expiryDate to a unix timestamp
const now = moment().utc().unix()
let expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000
const optionParams = {
	minCallStrikePrice: 0,
	maxCallStrikePrice: toWei("100000000000"),
	minPutStrikePrice: 0,
	maxPutStrikePrice: toWei("1000000000000"),
	minExpiry:0,
	maxExpiry:99999999999,
}

describe("Options protocol Vault Health", function () {
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
		aggregator = res[1] as MockChainlinkAggregator
		pricer = res[2] as string
	})

	it("Deploys the Option Registry", async () => {
		signers = await ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		// deploy libraries
		const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
		const interactions = await interactionsFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
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
		await usd.connect(signer).transfer(senderAddress, toWei("1000000").div(oTokenDecimalShift18))
		await usd.connect(signer).transfer(receiverAddress, toWei("1000000").div(oTokenDecimalShift18))
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
		// ensure deployer was granted admin role correctly
		expect(await optionRegistry.hasRole(utils.id("ADMIN_ROLE"), senderAddress)).to.be.true
		expect(await optionRegistry.hasRole(utils.id("ADMIN_ROLE"), receiverAddress)).to.be.false
		const _optionRegistryETH = (await optionRegistryFactory.deploy(
			WETH_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId]
		)) as OptionRegistry
		optionRegistryETH = _optionRegistryETH
		expect(optionRegistryETH).to.have.property("deployTransaction")
	})
	it("Creates a liquidity pool", async () => {
		const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPoolAdjustCollateralTest")
		liquidityPool = (await liquidityPoolFactory.deploy(
			optionRegistry.address,
			USDC_ADDRESS[chainId]
		)) as LiquidityPoolAdjustCollateralTest
		await usd
			.connect(signer)
			.transfer(liquidityPool.address, toWei("1000000").div(oTokenDecimalShift18))
		await liquidityPool.setCollateralAllocated(toWei("1000000").div(oTokenDecimalShift18))
	})

	it("Creates a USDC collataralised call option token series", async () => {
		const [sender] = signers
		proposedSeries = {
			expiration: expiration,
			strike: strike,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issue = await optionRegistry.issue(
			proposedSeries
		)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	it("Creates a ETH collataralised call option token series", async () => {
		const [sender] = signers
		proposedSeriesETH = {
			expiration: expiration,
			strike: strike,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: WETH_ADDRESS[chainId]
		}
		const issue = await optionRegistryETH.issue(
			proposedSeriesETH
		)
		await expect(issue).to.emit(optionRegistryETH, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenETH = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	let marginReqUSD: BigNumber
	let marginReqETH: BigNumber
	it("opens call option token with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		marginReqUSD = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const uhf = await optionRegistry.callUpperHealthFactor()
		marginReqUSD = uhf.mul(marginReqUSD).div(MAX_BPS)
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC.address, value, collatAmount)
		const USDbalance = await usd.balanceOf(senderAddress)
		const balance = await optionTokenUSDC.balanceOf(senderAddress)
		expect(balance).to.equal(value.div(oTokenDecimalShift18))
		expect(USDbalanceBefore.sub(USDbalance)).to.equal(marginReqUSD)

		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(usd.address)
	})

	it("opens call option token with ETH", async () => {
		const value = toWei("4")

		wethERC20 = (await ethers.getContractAt(
			"ERC20Interface",
			WETH_ADDRESS[chainId]
		)) as ERC20Interface
		const ETHbalanceBefore = await wethERC20.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		marginReqETH = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		const uhf = await optionRegistryETH.callUpperHealthFactor()
		marginReqETH = uhf.mul(marginReqETH).div(MAX_BPS)
		await wethERC20.approve(optionRegistryETH.address, value)
		const collatAmount = await optionRegistryETH.getCollateral(
			await optionRegistryETH.seriesInfo(optionTokenETH.address),
			value
		)
		await optionRegistryETH.open(optionTokenETH.address, value, collatAmount)
		const ETHbalance = await wethERC20.balanceOf(senderAddress)
		const balance = await optionTokenETH.balanceOf(senderAddress)
		expect(balance).to.equal(value.div(oTokenDecimalShift18))
		expect(ETHbalanceBefore.sub(ETHbalance)).to.equal(marginReqETH)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistryETH.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(weth.address)
	})

	it("opens call option again with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		const oBalanceBef = await optionTokenUSDC.balanceOf(senderAddress)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const uhf = await optionRegistry.callUpperHealthFactor()
		marginReq = uhf.mul(marginReq).div(MAX_BPS)
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC.address, value, collatAmount)
		const USDbalance = await usd.balanceOf(senderAddress)
		const balance = await optionTokenUSDC.balanceOf(senderAddress)
		expect(balance).to.equal(oBalanceBef.add(value.div(oTokenDecimalShift18)))
		expect(USDbalanceBefore.sub(USDbalance)).to.equal(marginReq)
		expect(marginReqUSD).to.equal(marginReq)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(usd.address)
	})

	it("opens call option again with ETH", async () => {
		const value = toWei("4")
		const ETHbalanceBefore = await wethERC20.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		const oBalanceBef = await optionTokenETH.balanceOf(senderAddress)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		const uhf = await optionRegistryETH.callUpperHealthFactor()
		marginReq = uhf.mul(marginReq).div(MAX_BPS)
		await wethERC20.approve(optionRegistryETH.address, value)
		const collatAmount = await optionRegistryETH.getCollateral(
			await optionRegistryETH.seriesInfo(optionTokenETH.address),
			value
		)
		await optionRegistryETH.open(optionTokenETH.address, value, collatAmount)
		const ETHbalance = await wethERC20.balanceOf(senderAddress)
		const balance = await optionTokenETH.balanceOf(senderAddress)
		expect(balance).to.equal(oBalanceBef.add(value.div(oTokenDecimalShift18)))
		expect(ETHbalanceBefore.sub(ETHbalance)).to.equal(marginReq)
		expect(marginReqETH).to.equal(marginReq)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistryETH.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(weth.address)
	})

	it("liquidityPool close and transaction succeeds", async () => {
		const [sender, receiver] = signers
		const value = toWei("1")
		const balanceBef = await optionTokenUSDC.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistry.connect(sender)
		await optionTokenUSDC.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		const usdBalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		let [
			isBelowMin0,
			isAboveMax0,
			healthFactor0,
			collateralAmount0,
			collateralAsset0
		] = await optionRegistry.checkVaultHealth(1)
		await optionRegistrySender.close(optionTokenUSDC.address, value)

		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		const balance = await optionTokenUSDC.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const usdBalance = await usd.balanceOf(senderAddress)
		expect(usdBalance.sub(usdBalanceBefore).sub(marginReq)).to.be.within(-1, 1)
		expect(isBelowMin).to.eq(isBelowMin0)
		expect(isAboveMax).to.eq(isAboveMax0)
		expect(healthFactor).to.eq(healthFactor0)
		expect(collateralAmount).to.eq(collateralAmount0)
	})
	it("liquidityPool close and transaction succeeds ETH options", async () => {
		const [sender, receiver] = signers
		const value = toWei("1")
		const balanceBef = await optionTokenETH.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistryETH.connect(sender)
		await optionTokenETH.approve(optionRegistryETH.address, value.div(oTokenDecimalShift18))
		const ethBalanceBefore = await wethERC20.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		marginReq = (await optionRegistryETH.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		await optionRegistrySender.close(optionTokenETH.address, value)
		const balance = await optionTokenETH.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const ethBalance = await wethERC20.balanceOf(senderAddress)
		const diff = ethBalance.sub(ethBalanceBefore)
		expect(diff.sub(marginReq)).to.be.within(-1, 1)
	})
	it("moves the price and changes vault health USD", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("250").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(0, settlePrice)
		await aggregator.setRoundTimestamp(0)
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const healthF = collatAmounts.mul(10000).div(marginReq)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("liquidityPool close and transaction succeeds", async () => {
		const [sender, receiver] = signers
		const value = toWei("1")
		const balanceBef = await optionTokenUSDC.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistry.connect(sender)
		await optionTokenUSDC.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		const usdBalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		let [
			isBelowMin0,
			isAboveMax0,
			healthFactor0,
			collateralAmount0,
			collateralAsset0
		] = await optionRegistry.checkVaultHealth(1)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		// health factor is different here because the health factor of the vault has moved
		marginReq = healthFactor0.mul(marginReq).div(MAX_BPS)
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const valueTot = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const valAdapt = value.div(oTokenDecimalShift18)
		const redeem = collatAmounts.mul(valAdapt).div(valueTot)
		await optionRegistrySender.close(optionTokenUSDC.address, value)

		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)

		const balance = await optionTokenUSDC.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const usdBalance = await usd.balanceOf(senderAddress)
		expect(usdBalance.sub(usdBalanceBefore).sub(redeem)).to.be.within(-1, 1)
		expect(isBelowMin).to.eq(isBelowMin0)
		expect(isAboveMax).to.eq(isAboveMax0)
		expect(healthFactor).to.eq(healthFactor0)
		expect(collateralAmount).to.eq(collateralAmount0)
	})
	it("moves the price and changes vault health ETH", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistryETH.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("100").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(1, settlePrice)
		await aggregator.setRoundTimestamp(1)
		const vaultDetails = await controller.getVault(optionRegistryETH.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		const healthF = collatAmounts.mul(10000).div(marginReq)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistryETH.checkVaultHealth(1)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("moves the price and changes vault health USD to negative rebalance stage", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("10").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(2, settlePrice)
		await aggregator.setRoundTimestamp(2)
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)

		expect(isBelowMin).to.be.true
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
		const roundId = 2
		let [isUnderCollat, price, dust] = await controller.isLiquidatable(
			optionRegistry.address,
			1
		)
		expect(isUnderCollat).to.be.false
	})
	it("readjusts to negative and checks liquidate", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("400").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(3, settlePrice)
		await aggregator.setRoundTimestamp(3)
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)

		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)

		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.true
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
		const roundId = 3
		let [isUnderCollat, price, dust] = await controller.isLiquidatable(
			optionRegistry.address,
			1
		)
		expect(isUnderCollat).to.be.true
	})
	it("reverts if unauthorised party tries to adjust collateral", async () => {
		const unauthorisedSigner = (await ethers.getSigners())[1]
		const unauthorisedOptionRegistry = await optionRegistry.connect(unauthorisedSigner)
		const arr = await unauthorisedOptionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]
		await expect(unauthorisedOptionRegistry.adjustCollateral(1)).to.be.reverted
	})
	it("adjusts collateral to get back to positive", async () => {
		await optionRegistry.setLiquidityPool(liquidityPool.address)
		const arr = await optionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		await optionRegistry.adjustCollateral(1)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lpBalanceDiff = lpBalanceAfter.sub(lpBalanceBefore)
		expect(collateralAllocatedAfter).to.equal(collateralAllocatedBefore.sub(lpBalanceDiff))
		const roundId = 3
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)

		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.equal(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("readjusts to negative and checks liquidate for caller adjust", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("800").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(3, settlePrice)
		await aggregator.setRoundTimestamp(3)
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)

		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)

		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.true
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
		let [isUnderCollat, price, dust] = await controller.isLiquidatable(
			optionRegistry.address,
			1
		)
		expect(isUnderCollat).to.be.true
	})
	it("adjusts collateral caller to get back to positive", async () => {
		await optionRegistry.setLiquidityPool(liquidityPool.address)
		const arr = await optionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		await optionRegistry.adjustCollateralCaller(1)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lpBalanceDiff = lpBalanceAfter.sub(lpBalanceBefore)
		expect(collateralAllocatedAfter).to.equal(collateralAllocatedBefore.sub(lpBalanceDiff))
		const roundId = 3
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)

		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.equal(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("reverts when trying to adjust a healthy vault", async () => {
		await expect(optionRegistry.adjustCollateral(1)).to.be.revertedWith("HealthyVault()")
	})	
	it("reverts adjustCollateralCaller when trying to adjust a healthy vault", async () => {
		await expect(optionRegistry.adjustCollateralCaller(1)).to.be.revertedWith("HealthyVault()")
	})	
	it("moves the price and changes vault health ETH to negative rebalance stage", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistryETH.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("300").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(4, settlePrice)
		await aggregator.setRoundTimestamp(4)
		const vaultDetails = await controller.getVault(optionRegistryETH.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistryETH.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistryETH.checkVaultHealth(1)
		expect(isBelowMin).to.be.true
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("moves the price and changes vault health USD to positive rebalance stage", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.sub(toWei("1000").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(5, settlePrice)
		await aggregator.setRoundTimestamp(5)
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)

		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = collatAmounts.sub(marginReq)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.true
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("adjusts overcollateralised position", async () => {
		await optionRegistry.setLiquidityPool(liquidityPool.address)
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(1)
		const healthFBefore = arr[2]

		const collateralAllocatedBefore = await liquidityPool.collateralAllocated()
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		await optionRegistry.adjustCollateral(1)
		const collateralAllocatedAfter = await liquidityPool.collateralAllocated()
		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lpBalanceDiff = lpBalanceAfter.sub(lpBalanceBefore)
		expect(collateralAllocatedAfter).to.equal(collateralAllocatedBefore.sub(lpBalanceDiff))
		const roundId = 5
		const vaultDetails = await controller.getVault(optionRegistry.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)

		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.equal(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("moves the price and changes vault health ETH to positive rebalance stage", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistryETH.checkVaultHealth(1)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.sub(toWei("1000").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(5, settlePrice)
		await aggregator.setRoundTimestamp(5)
		const vaultDetails = await controller.getVault(optionRegistryETH.address, 1)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistryETH.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = collatAmounts.sub(marginReq)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistryETH.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.true
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("settles when option expires ITM USD collateral", async () => {
		const [sender, receiver] = signers
		// get balance before
		const balanceUSD = await usd.balanceOf(liquidityPool.address)
		// get the desired settlement price
		const settlePrice = strike.add(toWei("200")).div(oTokenDecimalShift18)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice, pricer)
		await optionTokenUSDC.approve(
			optionRegistry.address,
			await optionTokenUSDC.balanceOf(liquidityPool.address)
		)
		// call redeem from the options registry
		const settleTx = await optionRegistry.settle(optionTokenUSDC.address)
		const receipt = await settleTx.wait()
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionsContractSettled")
		const collateralReturned = removeEvent?.args?.collateralReturned
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(liquidityPool.address)
		const opBalRegistry = await optionTokenUSDC.balanceOf(optionRegistry.address)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD).to.equal(balanceUSD.add(collateralReturned))
	})

	it("settles when option expires ITM ETH collateral", async () => {
		const [sender, receiver] = signers
		// get balance before
		const balanceETH = await wethERC20.balanceOf(senderAddress)
		await optionTokenETH.approve(
			optionRegistryETH.address,
			await optionTokenETH.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistryETH.settle(optionTokenETH.address)
		// check balances are in order
		const newBalanceETH = await wethERC20.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenETH.balanceOf(optionRegistryETH.address)
		const ethBalRegistry = await wethERC20.balanceOf(optionRegistryETH.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceETH > balanceETH).to.be.true
	})

	it("writer redeems when option expires ITM USD collateral", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		await optionTokenUSDC.approve(
			optionRegistry.address,
			await optionTokenUSDC.balanceOf(senderAddress)
		)
		const opUSDbal = await optionTokenUSDC.balanceOf(senderAddress)
		const diff = 200
		// call redeem from the options registry
		await optionRegistry.redeem(optionTokenUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenUSDC.balanceOf(optionRegistry.address)
		const opBalSender = await optionTokenUSDC.balanceOf(senderAddress)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(opUSDbal.mul(diff).div(100))
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})

	it("writer redeems when option expires ITM ETH collateral", async () => {
		// get balance before
		const balanceETH = await wethERC20.balanceOf(senderAddress)
		await optionTokenETH.approve(
			optionRegistryETH.address,
			await optionTokenETH.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistryETH.redeem(optionTokenETH.address)
		// check balances are in order
		const newBalanceETH = await wethERC20.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenETH.balanceOf(optionRegistryETH.address)
		const opBalSender = await optionTokenETH.balanceOf(senderAddress)
		const ethBalRegistry = await wethERC20.balanceOf(optionRegistryETH.address)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceETH > balanceETH).to.be.true
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})

	it("creates a USDC put option token series", async () => {
		await optionRegistry.setLiquidityPool(senderAddress)
		const [sender] = signers
		// fast forward expiryPeriod length of time
		expiration = createValidExpiry(expiration, 14)
		strike = toWei("2300")
		proposedSeries = {
			expiration: expiration,
			strike: strike,
			isPut: put,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issuePut = await optionRegistry.issue(
			proposedSeries
		)
		await expect(issuePut).to.emit(optionRegistry, "OptionTokenCreated")
		let receipt = await (await issuePut).wait(1)
		let events = receipt.events
		//@ts-ignore
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const address = removeEvent?.args?.token
		erc20PutOptionUSDC = new Contract(address, Otoken.abi, sender) as IOToken
	})

	it("creates a ETH put option token series", async () => {
		const [sender] = signers
		proposedSeriesETH = {
			expiration: expiration,
			strike: strike,
			isPut: put,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: WETH_ADDRESS[chainId]
		}
		const issuePut = await optionRegistryETH.issue(
			proposedSeriesETH
		)
		await expect(issuePut).to.emit(optionRegistryETH, "OptionTokenCreated")
		let receipt = await (await issuePut).wait(1)
		let events = receipt.events
		//@ts-ignore
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const address = removeEvent?.args?.token
		erc20PutOptionETH = new Contract(address, Otoken.abi, sender) as IOToken
	})

	it("opens put option token position", async () => {
		const [sender] = signers
		const amount = strike.mul(4)
		await usd.approve(optionRegistry.address, toWei(amount.toString()))
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(erc20PutOptionUSDC.address),
			toWei("4")
		)
		await optionRegistry.open(erc20PutOptionUSDC.address, toWei("4"), collatAmount)
		const balance = await erc20PutOptionUSDC.balanceOf(senderAddress)
		expect(balance).to.be.equal(toWei("4").div(oTokenDecimalShift18))
		await weth.approve(optionRegistryETH.address, toWei(amount.toString()))
		const collatAmountETH = await optionRegistryETH.getCollateral(
			await optionRegistryETH.seriesInfo(erc20PutOptionETH.address),
			toWei("4")
		)
		await optionRegistryETH.open(erc20PutOptionETH.address, toWei("4"), collatAmountETH)
		const newBalance = await erc20PutOptionETH.balanceOf(senderAddress)
		expect(newBalance).to.be.equal(toWei("4").div(oTokenDecimalShift18))
		const uhf = await optionRegistry.putUpperHealthFactor()
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(2)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(usd.address)
		let [
			isBelowMin2,
			isAboveMax2,
			healthFactor2,
			collateralAmount2,
			collateralAsset2
		] = await optionRegistryETH.checkVaultHealth(2)
		expect(isBelowMin2).to.be.false
		expect(isAboveMax2).to.be.false
		expect(healthFactor2.sub(uhf)).to.be.within(-1, 1)
		expect(collateralAmount2).to.equal(0)
		expect(collateralAsset2).to.equal(weth.address)
	})
	it("moves the price and changes vault health USD", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(2)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.sub(toWei("250").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		const vaultDetails = await controller.getVault(optionRegistry.address, 2)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			true
		)
		const healthF = collatAmounts.mul(10000).div(marginReq)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(2)

		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("moves the price and changes vault health USD to negative rebalance stage", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(2)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.sub(toWei("800").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		const vaultDetails = await controller.getVault(optionRegistry.address, 2)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			true
		)

		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.putUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(2)

		expect(isBelowMin).to.be.true
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("moves the price and changes vault health USD to positive rebalance stage", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(2)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("1500").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		const vaultDetails = await controller.getVault(optionRegistry.address, 2)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			true
		)
		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)

		marginReq = (await optionRegistry.putUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = collatAmounts.sub(marginReq)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(2)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.true
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
	})
	it("writer closes not transfered balance on put option token", async () => {
		const value = toWei("1")
		const balanceBef = await erc20PutOptionUSDC.balanceOf(senderAddress)
		await erc20PutOptionUSDC.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		await optionRegistry.close(erc20PutOptionUSDC.address, value)
		const balance = await erc20PutOptionUSDC.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const balanceBefore = await erc20PutOptionETH.balanceOf(senderAddress)
		await erc20PutOptionETH.approve(optionRegistryETH.address, value.div(oTokenDecimalShift18))
		await optionRegistryETH.close(erc20PutOptionETH.address, value)
		const newBalance = await erc20PutOptionETH.balanceOf(senderAddress)
		expect(balanceBefore.sub(newBalance)).to.equal(value.div(oTokenDecimalShift18))
	})

	it("settles put when option expires ITM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		const diff = 200
		// get the desired settlement price
		const settlePrice = strike.sub(toWei(diff.toString())).div(oTokenDecimalShift18)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice, pricer)
		const opUSDbal = (await controller.getVault(optionRegistry.address, (await optionRegistry.vaultCount()))).shortAmounts[0]
		const collatBal = (await controller.getVault(optionRegistry.address, (await optionRegistry.vaultCount()))).collateralAmounts[0]
		// call settle from the options registry
		await optionRegistry.settle(erc20PutOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20PutOptionUSDC.balanceOf(optionRegistry.address)
		const ethBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(collatBal.sub(opUSDbal.mul(diff).div(100)))
	})

	it("writer redeems put when option expires ITM", async () => {
		// get balance before
		const diff = 200
		// get the desired settlement price
		const settlePrice = strike.sub(toWei(diff.toString())).div(oTokenDecimalShift18)
		const balanceUSD = await usd.balanceOf(senderAddress)
		await erc20PutOptionUSDC.approve(
			optionRegistry.address,
			await erc20PutOptionUSDC.balanceOf(senderAddress)
		)
		const opUSDbal = await erc20PutOptionUSDC.balanceOf(senderAddress)
		// call redeem from the options registry
		await optionRegistry.redeem(erc20PutOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20PutOptionUSDC.balanceOf(optionRegistry.address)
		const opBalSender = await erc20PutOptionUSDC.balanceOf(senderAddress)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(opUSDbal.mul(diff).div(100))
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})
	it("Creates a USD collataralised call option token series", async () => {
		const [sender] = signers
		// fast forward expiryPeriod length of time
		expiration = createValidExpiry(expiration, 14)
		strike = toWei("3500")
		proposedSeries = {
			expiration: expiration,
			strike: strike,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issue = await optionRegistry.issue(
			proposedSeries
		)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const value = toWei("4")
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC.address, value, collatAmount)
	})

	it("moves the price and changes vault health USD to negative rebalance stage", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(3)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("500").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(6, settlePrice)
		await aggregator.setRoundTimestamp(6)
		const vaultDetails = await controller.getVault(optionRegistry.address, 3)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(3)

		expect(isBelowMin).to.be.true
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
		const roundId = 6
		let [isUnderCollat, price, dust] = await controller.isLiquidatable(
			optionRegistry.address,
			3
		)
		expect(isUnderCollat).to.be.true
	})
	it("vault gets liquidated", async () => {
		const vaultDetails = await controller.getVault(optionRegistry.address, 3)
		const value = vaultDetails.shortAmounts[0]
		const liqBalBef = await usd.balanceOf(senderAddress)
		const collatAmountsBef = vaultDetails.collateralAmounts[0]
		const liqOpBalBef = await optionTokenUSDC.balanceOf(senderAddress)
		expect(liqOpBalBef).to.be.gt(0)
		const abiCode = new AbiCoder()
		const liquidateArgs = [
			{
				actionType: 10,
				owner: optionRegistry.address,
				secondAddress: senderAddress,
				asset: optionTokenUSDC.address,
				vaultId: 3,
				amount: value,
				index: "0",
				data: abiCode.encode(["uint256"], ["6"])
			}
		]
		await controller.operate(liquidateArgs)
		const vaultDetailsNew = await controller.getVault(optionRegistry.address, 3)
		const valueNew = vaultDetailsNew.shortAmounts[0]
		const collatAmountsNew = vaultDetailsNew.collateralAmounts[0]
		const liqBalAf = await usd.balanceOf(senderAddress)
		const liqOpBalAf = await optionTokenUSDC.balanceOf(senderAddress)
		expect(liqBalAf.sub(liqBalBef).sub(collatAmountsBef)).to.be.within(-3,3)
		expect(liqOpBalAf).to.eq(0)
		expect(valueNew).to.eq(0)
		expect(collatAmountsNew).to.be.within(-3,3)
		await optionRegistry.setLiquidityPool(liquidityPool.address)
		await optionRegistry.wCollatLiquidatedVault(3)
		const vld = await controller.getVaultLiquidationDetails(optionRegistry.address, 3)
		const collatAlloc = await liquidityPool.collateralAllocated();
		await optionRegistry.registerLiquidatedVault(3)
		const vldAfter = await controller.getVaultLiquidationDetails(optionRegistry.address, 3)
		expect(vldAfter[0]).to.equal(ZERO_ADDRESS)
		expect(vldAfter[1]).to.equal(0)
		expect(vldAfter[2]).to.equal(0)
		const collatAllocAft = await liquidityPool.collateralAllocated()
		expect(vld[2]).to.equal(collatAlloc.sub(collatAllocAft))
		const vaultDetails3 = await controller.getVault(optionRegistry.address, 3)
		const collatAmounts3 = vaultDetails3.collateralAmounts[0]
		expect(collatAmounts3).to.eq(0)
		const usdBalAft = await usd.balanceOf(senderAddress)
		expect(usdBalAft.sub(liqBalAf)).to.eq(0)
	})
	it("Creates a USD collataralised call option token series", async () => {
		await optionRegistry.setLiquidityPool(senderAddress)
		const [sender] = signers
		// fast forward expiryPeriod length of time
		expiration = createValidExpiry(expiration, 14)
		strike = toWei("3500")
		proposedSeries = {
			expiration: expiration,
			strike: strike,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issue = await optionRegistry.issue(
			proposedSeries
		)
		const currentPrice = await oracle.getPrice(weth.address)
		const settlePrice = currentPrice.sub(toWei("500").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(6, settlePrice)
		await aggregator.setRoundTimestamp(6)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const value = toWei("4")
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC.address, value, collatAmount)
	})

	it("moves the price and changes vault health USD to negative rebalance stage", async () => {
		const currentPrice = await oracle.getPrice(weth.address)
		const arr = await optionRegistry.checkVaultHealth(4)
		const healthFBefore = arr[2]
		const settlePrice = currentPrice.add(toWei("800").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(6, settlePrice)
		await aggregator.setRoundTimestamp(6)
		const vaultDetails = await controller.getVault(optionRegistry.address, 4)
		const value = vaultDetails.shortAmounts[0]
		const collatAmounts = vaultDetails.collateralAmounts[0]
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const healthF = collatAmounts.mul(MAX_BPS).div(marginReq)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		const neededCollat = marginReq.sub(collatAmounts)
		let [
			isBelowMin,
			isAboveMax,
			healthFactor,
			collateralAmount,
			collateralAsset
		] = await optionRegistry.checkVaultHealth(4)

		expect(isBelowMin).to.be.true
		expect(isAboveMax).to.be.false
		expect(neededCollat).to.equal(collateralAmount)
		expect(collateralAmount).to.be.gt(0)
		expect(healthF).to.not.equal(healthFBefore)
		expect(healthFactor).to.not.equal(healthFBefore)
		expect(healthF).to.equal(healthFactor)
		const roundId = 6
		let [isUnderCollat, price, dust] = await controller.isLiquidatable(
			optionRegistry.address,
			4
		)
		expect(isUnderCollat).to.be.true
	})
	it("vault gets liquidated by non-holder", async () => {
		const [sender, receiver] = signers
		const vaultDetails = await controller.getVault(optionRegistry.address, 4)
		const value = vaultDetails.shortAmounts[0]
		const liqBalBef = await usd.balanceOf(receiverAddress)
		const collatAmountsBef = vaultDetails.collateralAmounts[0]
		const liqOpBalBef = await optionTokenUSDC.balanceOf(receiverAddress)
		const abiCode = new AbiCoder()
		const currentPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value,
			strike.div(oTokenDecimalShift18),
			currentPrice,
			expiration,
			6,
			false
		)
		increase(1500)
		await usd.connect(receiver).approve(MARGIN_POOL[chainId], marginReq.add(1))
		const mintLiquidateArgs = [
			{
				actionType: 0,
				owner: receiverAddress,
				secondAddress: receiverAddress,
				asset: ZERO_ADDRESS,
				vaultId: 1,
				amount: "0",
				index: 0,
				data: abiCode.encode(["uint256"], ["1"])
			},
			{
				actionType: 5,
				owner: receiverAddress,
				secondAddress: receiverAddress,
				asset: usd.address,
				vaultId: 1,
				amount: marginReq,
				index: 0,
				data: ZERO_ADDRESS
			},
			{
				actionType: 1,
				owner: receiverAddress,
				secondAddress: receiverAddress,
				asset: optionTokenUSDC.address,
				vaultId: 1,
				amount: value,
				index: 0,
				data: ZERO_ADDRESS
			},
			{
				actionType: 10,
				owner: optionRegistry.address,
				secondAddress: receiverAddress,
				asset: optionTokenUSDC.address,
				vaultId: 4,
				amount: value,
				index: 0,
				data: abiCode.encode(["uint256"], ["6"])
			}
		]
		await controller.connect(receiver).operate(mintLiquidateArgs)
		const vaultDetailsNew = await controller.getVault(optionRegistry.address, 4)
		const valueNew = vaultDetailsNew.shortAmounts[0]
		const collatAmountsNew = vaultDetailsNew.collateralAmounts[0]
		const liqBalAf = await usd.balanceOf(receiverAddress)
		const liqBalAft = await usd.balanceOf(senderAddress)
		const liqOpBalAf = await optionTokenUSDC.balanceOf(receiverAddress)
		expect(liqBalBef.sub(liqBalAf).sub(marginReq.sub(collatAmountsBef))).to.be.within(-3,3)
		expect(liqOpBalBef).to.equal(liqOpBalAf)
		expect(liqOpBalAf).to.eq(0)
		expect(valueNew).to.eq(0)
		expect(collatAmountsNew).to.be.within(-3,3)
		await optionRegistry.setLiquidityPool(liquidityPool.address)
		const vld = await controller.getVaultLiquidationDetails(optionRegistry.address, 4)
		await optionRegistry.wCollatLiquidatedVault(4)
		const collatAlloc = await liquidityPool.collateralAllocated();
		const vaultLiqDetails = await controller.getVaultLiquidationDetails(optionRegistry.address, 4)
		expect(vaultLiqDetails[0]).to.equal(optionTokenUSDC.address)
		expect(vaultLiqDetails[1]).to.equal(value)
		expect(vaultLiqDetails[2]).to.equal(collatAmountsBef.sub(collatAmountsNew))
		await optionRegistry.registerLiquidatedVault(4)
		const vldAfter = await controller.getVaultLiquidationDetails(optionRegistry.address, 4)
		expect(vldAfter[0]).to.equal(ZERO_ADDRESS)
		expect(vldAfter[1]).to.equal(0)
		expect(vldAfter[2]).to.equal(0)
		const collatAllocAft = await liquidityPool.collateralAllocated()
		expect(vld[2]).to.equal(collatAlloc.sub(collatAllocAft))
		const vaultDetails3 = await controller.getVault(optionRegistry.address, 4)
		const collatAmounts3 = vaultDetails3.collateralAmounts[0]
		expect(collatAmounts3).to.eq(0)
		const usdBalAft = await usd.balanceOf(senderAddress)
		expect(usdBalAft.sub(liqBalAft)).to.eq(0)
		await expect(optionRegistry.registerLiquidatedVault(4)).to.be.revertedWith("VaultNotLiquidated()")
	})
})
