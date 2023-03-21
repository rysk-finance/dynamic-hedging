import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Contract, Signer, utils } from "ethers"
import { AbiCoder } from "ethers/lib/utils"
import hre, { ethers, network } from "hardhat"
import { mul } from "prb-math"

import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import {
	ERC20Interface,
	LiquidityPoolAdjustCollateralTest,
	MintableERC20,
	MockChainlinkAggregator,
	NewController,
	NewMarginCalculator,
	Oracle,
	Otoken as IOToken,
	VaultCollateralMulticall,
	WETH
} from "../types"
import { OptionRegistry, OptionSeriesStruct } from "../types/OptionRegistry"
import {
	call,
	createValidExpiry,
	MAX_BPS,
	put,
	toWei,
	ZERO_ADDRESS
} from "../utils/conversion-helper"
import { deployOpyn } from "../utils/opyn-deployer"
import {
	ADDRESS_BOOK,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS
} from "./constants"
import { increase, setOpynOracleExpiryPrice, setupTestOracle } from "./helpers"

dayjs.extend(utc)

let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let liquidityPool: LiquidityPoolAdjustCollateralTest
let controller: NewController
let newCalculator: NewMarginCalculator
let oracle: Contract
let multicall: VaultCollateralMulticall
let optionRegistry: OptionRegistry
let optionRegistryETH: OptionRegistry
let optionTokenUSDC1: IOToken
let optionTokenUSDC2: IOToken
let optionTokenUSDC3: IOToken
let optionTokenUSDC4: IOToken
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

// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
let strike1 = toWei("3500")
let strike2 = toWei("4500")
let strike3 = toWei("3000")
let strike4 = toWei("3500")

// handles the conversion of expiryDate to a unix timestamp
let expiration = dayjs.utc(expiryDate).add(8, "hours").unix()

const checkAllVaultHealths = async (numberOfVaults: number) => {
	const upperhealthFactorBuffer = 1.1
	let vaultIds = []
	for (let i = 1; i <= numberOfVaults; i++) {
		try {
			let [
				isBelowMin,
				isAboveMax,
				healthFactor,
				upperHealthFactor,
				collateralAmount,
				collateralAsset
			] = await optionRegistry.checkVaultHealth(i)
			if (
				(isAboveMax &&
					healthFactor.toNumber() > upperhealthFactorBuffer * upperHealthFactor.toNumber()) ||
				isBelowMin
			) {
				vaultIds.push(i)
			}
		} catch {}
	}
	return vaultIds
}

describe("Gelato Options registry Vault Health", function () {
	before(async function () {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						jsonRpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY}`,
						chainId: 42161,
						blockNumber: 36000000
					}
				}
			]
		})
		signers = await ethers.getSigners()
		let opynParams = await deployOpyn(signers)
		controller = opynParams.controller
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
		const computeFactory = await hre.ethers.getContractFactory("contracts/libraries/OptionsCompute.sol:OptionsCompute")
		const compute = await computeFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
			libraries: {
				OpynInteractions: interactions.address,
				OptionsCompute: compute.address
			}
		})
		const authorityFactory = await hre.ethers.getContractFactory("Authority")
		const authority = await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)
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
			senderAddress,
			ADDRESS_BOOK[chainId],
			authority.address
		)) as OptionRegistry
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")
		await optionRegistry.setKeeper(senderAddress, true)
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
	it("deploys multicall contract", async () => {
		const signer = (await ethers.getSigners())[0]
		const multicallFactory = await ethers.getContractFactory("VaultCollateralMulticall")
		multicall = (await multicallFactory.deploy(
			signer.address,
			optionRegistry.address
		)) as VaultCollateralMulticall
		await optionRegistry.setKeeper(multicall.address, true)
	})
	it("Creates a USDC collataralised call option token series", async () => {
		const [sender] = signers
		const currentPrice = parseInt(await oracle.getPrice(weth.address), 16)
		proposedSeries = {
			expiration: expiration,
			strike: strike1,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issue = await optionRegistry.issue(proposedSeries)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC1 = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	it("Creates another USDC collataralised call option token series", async () => {
		const [sender] = signers
		proposedSeries = {
			expiration: expiration,
			strike: strike2,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issue = await optionRegistry.issue(proposedSeries)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC2 = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	it("Creates a USDC collataralised put option token series", async () => {
		const [sender] = signers
		const currentPrice = parseInt(await oracle.getPrice(weth.address), 16)
		proposedSeries = {
			expiration: expiration,
			strike: strike3,
			isPut: put,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issue = await optionRegistry.issue(proposedSeries)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC3 = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	it("Creates another USDC collataralised put option token series", async () => {
		const [sender] = signers
		proposedSeries = {
			expiration: expiration,
			strike: strike4,
			isPut: put,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issue = await optionRegistry.issue(proposedSeries)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC4 = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	let marginReqUSD: BigNumber
	it("opens call option token with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		marginReqUSD = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike1.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const uhf = await optionRegistry.callUpperHealthFactor()
		marginReqUSD = uhf.mul(marginReqUSD).div(MAX_BPS)
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC1.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC1.address, value, collatAmount)
		const USDbalance = await usd.balanceOf(senderAddress)
		const balance = await optionTokenUSDC1.balanceOf(senderAddress)
		expect(balance).to.equal(value.div(oTokenDecimalShift18))
		expect(USDbalanceBefore.sub(USDbalance)).to.equal(marginReqUSD)

		let [isBelowMin, isAboveMax, healthFactor, upperHealthFactor, collateralAmount, collateralAsset] =
			await optionRegistry.checkVaultHealth(1)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(usd.address)
	})
	it("opens call option again with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		const oBalanceBef = await optionTokenUSDC2.balanceOf(senderAddress)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike2.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		const uhf = await optionRegistry.callUpperHealthFactor()
		marginReq = uhf.mul(marginReq).div(MAX_BPS)
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC2.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC2.address, value, collatAmount)
		const USDbalance = await usd.balanceOf(senderAddress)
		const balance = await optionTokenUSDC2.balanceOf(senderAddress)
		expect(balance).to.equal(oBalanceBef.add(value.div(oTokenDecimalShift18)))
		expect(USDbalanceBefore.sub(USDbalance)).to.equal(marginReq)
		let [isBelowMin, isAboveMax, healthFactor, upperHealthFactor, collateralAmount, collateralAsset] =
			await optionRegistry.checkVaultHealth(2)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(upperHealthFactor).to.eq(uhf)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(usd.address)
	})
	it("opens put option with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		const oBalanceBef = await optionTokenUSDC3.balanceOf(senderAddress)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike3.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			true
		)
		const uhf = await optionRegistry.putUpperHealthFactor()
		marginReq = uhf.mul(marginReq).div(MAX_BPS)
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC3.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC3.address, value, collatAmount)
		const USDbalance = await usd.balanceOf(senderAddress)
		const balance = await optionTokenUSDC3.balanceOf(senderAddress)
		expect(balance).to.equal(oBalanceBef.add(value.div(oTokenDecimalShift18)))
		expect(USDbalanceBefore.sub(USDbalance)).to.equal(marginReq)
		let [isBelowMin, isAboveMax, healthFactor, upperHealthFactor, collateralAmount, collateralAsset] =
			await optionRegistry.checkVaultHealth(3)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(upperHealthFactor).to.eq(uhf)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(usd.address)
	})
	it("opens put option again with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		const oBalanceBef = await optionTokenUSDC4.balanceOf(senderAddress)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike4.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			true
		)
		const uhf = await optionRegistry.putUpperHealthFactor()
		marginReq = uhf.mul(marginReq).div(MAX_BPS)
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC4.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC4.address, value, collatAmount)
		const USDbalance = await usd.balanceOf(senderAddress)
		const balance = await optionTokenUSDC4.balanceOf(senderAddress)
		expect(balance).to.equal(oBalanceBef.add(value.div(oTokenDecimalShift18)))
		expect(USDbalanceBefore.sub(USDbalance)).to.equal(marginReq)
		let [isBelowMin, isAboveMax, healthFactor, upperHealthFactor, collateralAmount, collateralAsset] =
			await optionRegistry.checkVaultHealth(4)
		expect(isBelowMin).to.be.false
		expect(isAboveMax).to.be.false
		expect(healthFactor.sub(uhf)).to.be.within(-1, 1)
		expect(upperHealthFactor).to.eq(uhf)
		expect(collateralAmount).to.equal(0)
		expect(collateralAsset).to.equal(usd.address)
	})
	it("moves the price and changes vault health USD", async () => {
		await optionRegistry.setLiquidityPool(liquidityPool.address)

		const currentPrice = await oracle.getPrice(weth.address)
		const settlePrice = currentPrice.add(toWei("600").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(0, settlePrice)
		await aggregator.setRoundTimestamp(0)
		let vaultIdsBefore: number[] = await checkAllVaultHealths(4)

		// vaults 1,2,3 are unhealthy
		expect(vaultIdsBefore.length).to.eq(3)
		const tx = await multicall.adjustVaults(vaultIdsBefore)
		await tx.wait()
		let vaultIdsAfter: number[] = await checkAllVaultHealths(4)
		// all vaults are healthy
		expect(vaultIdsAfter.length).to.eq(0)
		// await optionRegistry.adjustCollateral(1)
	})
	it("moves the price again and changes vault health USD", async () => {
		await optionRegistry.setLiquidityPool(liquidityPool.address)

		const currentPrice = await oracle.getPrice(weth.address)
		const settlePrice = currentPrice.sub(toWei("1000").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(0, settlePrice)
		await aggregator.setRoundTimestamp(0)
		let vaultIdsBefore: number[] = await checkAllVaultHealths(4)

		// vaults 1,2,3 are unhealthy
		expect(vaultIdsBefore.length).to.eq(3)
		const multicallUnhealthyVaults = (await multicall.checkVaults([1, 2, 3, 4])).map(id =>
			id.toNumber()
		)
		expect(multicallUnhealthyVaults.join("")).to.eq("1230")
		const tx = await multicall.adjustVaults(vaultIdsBefore)
		await tx.wait()
		let vaultIdsAfter: number[] = await checkAllVaultHealths(4)
		// all vaults are healthy
		expect(vaultIdsAfter.length).to.eq(0)
	})
	it("doesnt revert if a given a healthy vault", async () => {
		await optionRegistry.setLiquidityPool(liquidityPool.address)

		const currentPrice = await oracle.getPrice(weth.address)

		const settlePrice = currentPrice.sub(toWei("500").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(0, settlePrice)
		await aggregator.setRoundTimestamp(0)
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		let vaultIdsBefore: number[] = await checkAllVaultHealths(4)

		// vaults 1,2,4 are unhealthy
		expect(vaultIdsBefore.join("")).to.eq("124")

		const multicallUnhealthyVaults = (await multicall.checkVaults([1, 2, 3, 4])).map(id =>
			id.toNumber()
		)
		expect(multicallUnhealthyVaults.join("")).to.eq("1204")

		const vault3HealthFactorBefore = (await optionRegistry.checkVaultHealth(3)).healthFactor

		// check balances:
		const vaultCollat1 = await (
			await controller.getVault(optionRegistry.address, 1)
		).collateralAmounts[0]
		const vaultCollat2 = await (
			await controller.getVault(optionRegistry.address, 2)
		).collateralAmounts[0]

		const vaultCollat3 = await (
			await controller.getVault(optionRegistry.address, 3)
		).collateralAmounts[0]
		const vaultCollat4 = await (
			await controller.getVault(optionRegistry.address, 4)
		).collateralAmounts[0]

		const marginReq1 = (
			await newCalculator.getNakedMarginRequired(
				weth.address,
				usd.address,
				usd.address,
				(
					await controller.getVault(optionRegistry.address, 1)
				).shortAmounts[0],
				strike1.div(oTokenDecimalShift18),
				await oracle.getPrice(weth.address),
				expiration,
				6,
				false
			)
		)
			.mul(await optionRegistry.callUpperHealthFactor())
			.div(MAX_BPS)
		const marginReq2 = (
			await newCalculator.getNakedMarginRequired(
				weth.address,
				usd.address,
				usd.address,
				(
					await controller.getVault(optionRegistry.address, 2)
				).shortAmounts[0],
				strike2.div(oTokenDecimalShift18),
				await oracle.getPrice(weth.address),
				expiration,
				6,
				false
			)
		)
			.mul(await optionRegistry.callUpperHealthFactor())
			.div(MAX_BPS)
		const marginReq3 = (
			await newCalculator.getNakedMarginRequired(
				weth.address,
				usd.address,
				usd.address,
				(
					await controller.getVault(optionRegistry.address, 3)
				).shortAmounts[0],
				strike3.div(oTokenDecimalShift18),
				await oracle.getPrice(weth.address),
				expiration,
				6,
				true
			)
		)
			.mul(await optionRegistry.putUpperHealthFactor())
			.div(MAX_BPS)
		const marginReq4 = (
			await newCalculator.getNakedMarginRequired(
				weth.address,
				usd.address,
				usd.address,
				(
					await controller.getVault(optionRegistry.address, 4)
				).shortAmounts[0],
				strike4.div(oTokenDecimalShift18),
				await oracle.getPrice(weth.address),
				expiration,
				6,
				true
			)
		)
			.mul(await optionRegistry.putUpperHealthFactor())
			.div(MAX_BPS)

		const totalCollatOutflows = marginReq1
			.sub(vaultCollat1)
			.add(marginReq2.sub(vaultCollat2))
			.add(marginReq4.sub(vaultCollat4))

		// throw vault 3 in even though it is healthy
		const tx = await multicall.adjustVaults([1, 2, 3, 4])
		await tx.wait()
		let vaultIdsAfter: number[] = await checkAllVaultHealths(4)
		// all vaults are healthy
		expect(vaultIdsAfter.length).to.eq(0)
		expect(await (await optionRegistry.checkVaultHealth(1)).healthFactor).to.eq(12999)
		expect(await (await optionRegistry.checkVaultHealth(2)).healthFactor).to.eq(12999)
		expect(await (await optionRegistry.checkVaultHealth(3)).healthFactor).to.eq(
			vault3HealthFactorBefore
		)
		// put vault has lower upperHealthFactor
		expect(await (await optionRegistry.checkVaultHealth(4)).healthFactor).to.eq(11999)

		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const lpBalanceDiff = lpBalanceBefore.sub(lpBalanceAfter)
		expect(lpBalanceDiff).to.eq(totalCollatOutflows)
	})
	it("multicall check health returns zero for an expired vault ID", async () => {
		const currentPrice = await oracle.getPrice(weth.address)

		const settlePrice = currentPrice.sub(toWei("500").div(oTokenDecimalShift18))
		await aggregator.setLatestAnswer(settlePrice)
		await aggregator.setRoundAnswer(0, settlePrice)
		await aggregator.setRoundTimestamp(0)
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		let vaultIdsBefore: number[] = await checkAllVaultHealths(4)

		// vaults 1,2,4 are unhealthy
		expect(vaultIdsBefore.join("")).to.eq("123")
		const multicallUnhealthyVaultsBefore = (await multicall.checkVaults([1, 2, 3, 4])).map(id =>
			id.toNumber()
		)
		expect(multicallUnhealthyVaultsBefore.join("")).to.eq("1230")

		// fast forward 3 months so vaults expire bnut have not seen settled
		await ethers.provider.send("evm_increaseTime", [7776000])
		await ethers.provider.send("evm_mine")

		let vaultIdsAfter: number[] = await checkAllVaultHealths(4)

		// vaults 1,2,4 are unhealthy
		expect(vaultIdsAfter.join("")).to.eq("")
		const multicallUnhealthyVaultsAfter = (await multicall.checkVaults([1, 2, 3, 4])).map(id =>
			id.toNumber()
		)
		expect(multicallUnhealthyVaultsAfter.join("")).to.eq("0000")
	})
	it("can change the executor", async () => {
		expect(await multicall.executorAddress()).to.eq(senderAddress)
		await multicall.setExecutor(ZERO_ADDRESS)
		expect(await multicall.executorAddress()).to.eq(ZERO_ADDRESS)
		await expect(multicall.setExecutor(senderAddress)).to.be.revertedWithCustomError(
			multicall,
			"invalidMsgSender"
		)
	})
})
