import hre, { ethers, network } from "hardhat"
import { Signer, BigNumber, BigNumberish, utils } from "ethers"
import { expect } from "chai"
import dotenv from "dotenv"
dotenv.config()
//@ts-ignore

import {
	UNISWAP_V3_SWAP_ROUTER,
	USDC_ADDRESS,
	USDC_ADDRESS_NATIVE,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS
} from "./constants"
import { arbitrum as addresses } from "../contracts.json"
import {
	ERC20,
	GmxHedgingReactorWithSwap,
	LiquidityPool,
	IReader,
	IPositionRouter,
	PriceFeed,
	MockChainlinkAggregator,
	PerpHedgingTest,
	OptionsCompute
} from "../types"
import { fail } from "assert"
import { toWei, ZERO_ADDRESS } from "../utils/conversion-helper"

// edit depending on the chain id to be tested on
const chainId = 42161

let signers: Signer[]
let deployer: Signer
let usdcWhale: Signer
let usdcBridged: ERC20
let usdcNative: ERC20
let liquidityPool: LiquidityPool
let priceFeed: PriceFeed
let gmxReactor: GmxHedgingReactorWithSwap
let gmxVault: any
let gmxReader: IReader
let gmxPositionRouter: IPositionRouter
let mockChainlinkFeed: MockChainlinkAggregator
const funderAddress = "0xf89d7b9c864f589bbF53a82105107622B35EaA40"
const deployerAddress: string = "0xFBdE2e477Ed031f54ed5Ad52f35eE43CD82cF2A6" // governor multisig address
let liquidityPoolAddress: string
const priceFeedAddress: string = addresses.priceFeed
const authorityAddress: string = addresses.authority
const gmxReaderAddress: string = "0x22199a49A999c351eF7927602CFB187ec3cae489"
const gmxPositionRouterAddress: string = "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868"
const gmxRouterAddress: string = "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064"
const gmxVaultPricefeedAddress: string = "0x2d68011bcA022ed0E474264145F46CC4de96a002"
const gmxVaultAddress: string = "0x489ee077994B6658eAfA855C308275EAd8097C4A"
const gmxPriceFeedTimelockAddress: string = "0x7b1FFdDEEc3C4797079C7ed91057e399e9D43a8B"
const gmxKeeper: string = "0x2BcD0d9Dde4bD69C516Af4eBd3fB7173e1FA12d0"
const wethAddress: string = WETH_ADDRESS[chainId]
const executeIncreasePosition = async () => {
	// fast forward 3 min
	await ethers.provider.send("evm_increaseTime", [180])
	await ethers.provider.send("evm_mine")

	const logs = await gmxReactor.queryFilter(gmxReactor.filters.CreateIncreasePosition(), 0)
	const positionKey = logs[logs.length - 1].args[0]
	await gmxReactor.executeIncreasePosition(positionKey)
}

const executeDecreasePosition = async () => {
	// fast forward 3 min
	await ethers.provider.send("evm_increaseTime", [180])
	await ethers.provider.send("evm_mine")

	const logs = await gmxReactor.queryFilter(gmxReactor.filters.CreateDecreasePosition(), 0)
	const positionKey = logs[logs.length - 1].args[0]
	await gmxReactor.executeDecreasePosition(positionKey)
}

const executeDoubleDecreasePosition = async () => {
	// fast forward 3 min
	await ethers.provider.send("evm_increaseTime", [180])
	await ethers.provider.send("evm_mine")

	const logs = await gmxReactor.queryFilter(gmxReactor.filters.CreateDecreasePosition(), 0)
	const positionKey1 = logs[logs.length - 1].args[0]
	await gmxReactor.executeDecreasePosition(positionKey1)
	const positionKey2 = logs[logs.length - 2].args[0]
	await gmxReactor.executeDecreasePosition(positionKey2)
}

const checkPositionExecutedEvent = async delta => {
	// check event emitted contains correct delta change
	const logs = await gmxReactor.queryFilter(gmxReactor.filters.PositionExecuted(), 0)
	const eventOutput = logs[logs.length - 1].args?.deltaChange
	expect(eventOutput).to.eq(utils.parseEther(delta.toString()))
}

describe("GMX Hedging Reactor With Swap", async () => {
	before(async () => {
		await network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						jsonRpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY}`,
						chainId: 42161,
						blockNumber: 103144800
					}
				}
			]
		})
	})

	it("obtains Rysk contracts", async () => {
		signers = await ethers.getSigners()
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [deployerAddress]
		})
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [funderAddress]
		})
		deployer = await ethers.getSigner(deployerAddress)
		const funder = await ethers.getSigner(funderAddress)
		await funder.sendTransaction({ to: deployerAddress, value: utils.parseEther("100") })
		const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
			libraries: {
				OptionsCompute: addresses.optionsCompute
			}
		})
		liquidityPool = (
			await liquidityPoolFactory.deploy(
				addresses.optionProtocol,
				USDC_ADDRESS_NATIVE[chainId],
				addresses.WETH,
				USDC_ADDRESS_NATIVE[chainId],
				0,
				"ETH/USDC",
				"EDP",
				{
					minCallStrikePrice: 0,
					maxCallStrikePrice: 10000,
					minPutStrikePrice: 0,
					maxPutStrikePrice: 10000,
					minExpiry: 0,
					maxExpiry: 31000000
				},
				//@ts-ignore
				addresses.authority
			)
		).connect(deployer) as LiquidityPool
		liquidityPoolAddress = liquidityPool.address
		priceFeed = (await ethers.getContractAt(
			"contracts/PriceFeed.sol:PriceFeed",
			priceFeedAddress,
			deployer
		)) as PriceFeed

		expect(liquidityPool).to.have.property("setHedgingReactorAddress")
		expect(liquidityPool).to.have.property("rebalancePortfolioDelta")
		expect(await liquidityPool.collateralAllocated()).to.eq(0)
	})
	it("#funds accounts", async () => {
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		usdcWhale = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		usdcBridged = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDC_ADDRESS[chainId]
		)) as ERC20
		await usdcBridged
			.connect(usdcWhale)
			.transfer(deployerAddress, ethers.utils.parseUnits("1000000", 6))
		usdcNative = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDC_ADDRESS_NATIVE[chainId]
		)) as ERC20
		await usdcNative
			.connect(usdcWhale)
			.transfer(liquidityPoolAddress, ethers.utils.parseUnits("4000000", 6))
		await usdcNative
			.connect(usdcWhale)
			.transfer(deployerAddress, ethers.utils.parseUnits("1000000", 6))
	})
	it("deploys mock chainlink price feed and hooks to GMX Vault Price feed", async () => {
		const mockChainlinkFeedFactory = await ethers.getContractFactory("MockChainlinkAggregator")
		mockChainlinkFeed = (await mockChainlinkFeedFactory.deploy()) as MockChainlinkAggregator
		const gmxVaultPriceFeed = await ethers.getContractAt(
			"contracts/interfaces/IGmxVaultPriceFeed.sol:IVaultPriceFeed",
			gmxVaultPricefeedAddress
		)
		await priceFeed.addPriceFeed(wethAddress, usdcBridged.address, mockChainlinkFeed.address)
		await priceFeed.addPriceFeed(wethAddress, usdcNative.address, mockChainlinkFeed.address)

		const govAddress = await gmxVaultPriceFeed.gov()
		expect(govAddress.toLowerCase()).to.eq("0x7b1ffddeec3c4797079c7ed91057e399e9d43a8b")

		gmxVault = (await ethers.getContractAt("IGmxVault", gmxVaultAddress)) as any
		gmxReader = (await ethers.getContractAt("IReader", gmxReaderAddress)) as IReader
		gmxPositionRouter = (await ethers.getContractAt(
			"contracts/interfaces/IPositionRouter.sol:IPositionRouter",
			gmxPositionRouterAddress
		)) as IPositionRouter

		const gmxPriceFeedTimelock = await ethers.getContractAt(
			"IPriceFeedTimelock",
			gmxPriceFeedTimelockAddress
		)
		const adminAddress = await gmxPriceFeedTimelock.admin()
		expect(adminAddress).to.eq("0x49B373D422BdA4C6BfCdd5eC1E48A9a26fdA2F8b")

		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [adminAddress]
		})
		const admin = await ethers.getSigner(adminAddress)

		await gmxPriceFeedTimelock
			.connect(admin)
			.signalPriceFeedSetTokenConfig(
				gmxVaultPricefeedAddress,
				wethAddress,
				mockChainlinkFeed.address,
				8,
				false
			)

		await gmxPriceFeedTimelock
			.connect(admin)
			.setIsSecondaryPriceEnabled(gmxVaultPricefeedAddress, false)

		// fast forward a day
		await ethers.provider.send("evm_increaseTime", [86400])
		await ethers.provider.send("evm_mine")
		await gmxPriceFeedTimelock
			.connect(admin)
			.priceFeedSetTokenConfig(
				gmxVaultPricefeedAddress,
				wethAddress,
				mockChainlinkFeed.address,
				8,
				false
			)

		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))

		const gmxKeeperAdminAddress = await gmxPositionRouter.admin()
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [gmxKeeperAdminAddress]
		})
		await gmxPositionRouter
			.connect(await ethers.getSigner(gmxKeeperAdminAddress))
			.setPositionKeeper(await deployer.getAddress(), true)
	})
	it("deploys GMX perp hedging reactor", async () => {
		const reactorFactory = await ethers.getContractFactory("GmxHedgingReactorWithSwap")
		gmxReactor = (await reactorFactory.deploy(
			gmxPositionRouterAddress,
			gmxRouterAddress,
			gmxReaderAddress,
			gmxVaultAddress,
			USDC_ADDRESS_NATIVE[chainId],
			wethAddress,
			liquidityPoolAddress,
			priceFeedAddress,
			authorityAddress,
			UNISWAP_V3_SWAP_ROUTER[chainId]
		)) as GmxHedgingReactorWithSwap
		const funder = await ethers.getSigner(funderAddress)
		await funder.sendTransaction({ to: gmxReactor.address, value: utils.parseEther("1") })

		await gmxReactor.connect(deployer).setKeeper(await signers[0].getAddress(), true)

		expect(await gmxReactor.parentLiquidityPool()).to.eq(liquidityPoolAddress)
		expect(await gmxReactor.getDelta()).to.eq(0)
	})
	it("adds GMX router to liquidity pool", async () => {
		await expect(liquidityPool.hedgingReactors(0)).to.be.reverted // should not be set yet

		await liquidityPool.setHedgingReactorAddress(gmxReactor.address)

		expect(await liquidityPool.hedgingReactors(0)).to.eq(gmxReactor.address) // should now be set
	})
	it("opens a long position", async () => {
		const delta = 2
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)

		const usdcBridgedBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcBridgedBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(gmxReactor.address), 6)
		)
		const currentPriceBefore = parseFloat(
			utils.formatEther(await priceFeed.getNormalizedRate(wethAddress, usdcBridged.address))
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`-${delta}`), 0)
		const pendingIncreaseCallback = await gmxReactor.pendingIncreaseCallback()
		expect(pendingIncreaseCallback).to.eq(1)

		// check getPoolDemoninatedvalue is correct during pending position increase
		const poolDenominatedValueBeforeExecute = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		const usdcNativeBalanceIntermediateLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)

		expect(poolDenominatedValueBeforeExecute).to.be.within(
			(usdcNativeBalanceBeforeLP - usdcNativeBalanceIntermediateLP) * 0.995,
			(usdcNativeBalanceBeforeLP - usdcNativeBalanceIntermediateLP) * 1.005
		)
		await executeIncreasePosition()

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)

		const usdcBridgedBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcBridgedBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(gmxReactor.address), 6)
		)
		// check that the reactor doesnt hold any USDC before or after
		expect(usdcNativeBalanceBeforeReactor).to.eq(usdcNativeBalanceAfterReactor).to.eq(0)
		expect(usdcBridgedBalanceBeforeReactor).to.eq(usdcBridgedBalanceAfterReactor).to.eq(0)

		expect(usdcBridgedBalanceBeforeLP).to.eq(usdcBridgedBalanceAfterLP).to.eq(0)
		// check that the correct amount of USDC was taken from LP
		expect(
			usdcNativeBalanceAfterLP - (usdcNativeBalanceBeforeLP - (delta / 2) * currentPriceBefore)
		).to.be.within(-5, 5)

		const positions = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		expect(parseFloat(utils.formatUnits(positions[0], 30))).to.eq(4000)
		expect(parseFloat(utils.formatUnits(positions[1], 30))).to.be.within(1980, 2000)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("2"))

		await checkPositionExecutedEvent(delta)

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValueAfterExecute = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValueAfterExecute).to.eq(parseFloat(utils.formatUnits(positions[1], 30)))
	})
	it("rebalances the collateral on an open long position that has unrealised loss", async () => {
		// set price to 1800
		// should be a $400 unrealised loss
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1800", 8))
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcBridgedBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(liquidityPool.address), 6)
		)
		await gmxReactor.update()
		await executeIncreasePosition()

		await checkPositionExecutedEvent(0)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcBridgedBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(liquidityPool.address), 6)
		)
		expect(usdcBridgedBalanceBeforeLP).to.eq(usdcBridgedBalanceAfterLP).to.eq(0)

		const usdcNativeDiff = usdcNativeBalanceBeforeLP - usdcNativeBalanceAfterLP
		// should cost slightly more than 400 due to trading fees
		expect(usdcNativeDiff).to.be.gt(400)
		expect(usdcNativeDiff).to.be.lt(420)

		const positions = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		expect(parseFloat(utils.formatUnits(positions[0], 30))).to.eq(4000)
		expect(parseFloat(utils.formatUnits(positions[1], 30))).to.be.within(2380, 2400)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("2"))
		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(
			parseFloat(utils.formatUnits(positions[1].sub(positions[8]), 30))
		)
	})
	it("rebalances that same position now that it is break even", async () => {
		// set price back  to 2000
		// should be exactly break even (not incl. fees)
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const usdcBridgedBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(liquidityPool.address), 6)
		)
		const usdcBridgedBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(gmxReactor.address), 6)
		)
		const positionsBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		await gmxReactor.update()
		await executeDecreasePosition()

		await checkPositionExecutedEvent(0)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const usdcBridgedBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(liquidityPool.address), 6)
		)
		const usdcBridgedBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcBridged.balanceOf(gmxReactor.address), 6)
		)
		expect(usdcBridgedBalanceBeforeLP).to.eq(0)
		expect(usdcBridgedBalanceAfterLP).to.eq(0)
		expect(usdcBridgedBalanceBeforeReactor).to.eq(usdcBridgedBalanceAfterReactor).to.eq(0)

		const usdcNativeDiffLP = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const usdcNativeDiffReactor = usdcNativeBalanceAfterReactor - usdcNativeBalanceBeforeReactor
		expect(usdcNativeDiffReactor).to.eq(0)

		const positions = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		// collateral should be back to 2000
		expect(parseFloat(utils.formatUnits(positions[1], 30))).to.be.within(1999, 2001)

		// should be slightly less than 400 due to trading fees
		expect(usdcNativeDiffLP).to.be.lt(400)
		expect(usdcNativeDiffLP).to.be.gt(380)
		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("2"))
		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(positions[1], 30)))
	})
	it("closes the long position at a loss", async () => {
		// at $1600, should be a $800 loss
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1600", 8))
		const positionsBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionsBefore[7]).to.eq(0) // indicated position in loss
		expect(positionsBefore[8]).to.eq(utils.parseUnits("800", 30)) // unrealised pnl
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const delta = 2
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta / 2}`), 0)
		await executeDecreasePosition()
		await checkPositionExecutedEvent(-delta / 2)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta / 2}`), 0)
		await executeDecreasePosition()

		await checkPositionExecutedEvent(-delta / 2)

		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionsAfter[0]).to.eq(positionsAfter[1]).to.eq(positionsAfter[8]).to.eq(0)
		// expect balance to be 1200 minus trading fees
		expect(usdcNativeBalanceDiff).to.be.lt(1200)
		expect(usdcNativeBalanceDiff).to.be.gt(1180)
		expect(usdcNativeBalanceAfterReactor).to.eq(usdcNativeBalanceBeforeReactor).to.eq(0)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("0"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(0)
	})
	it("opens a short position and reverts an attempt to open a long at same time", async () => {
		// set price to $2000
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))
		expect(await gmxReactor.internalDelta()).to.eq(0)
		const delta = 10
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)

		// this should revert to stop long and short coexisting
		await expect(
			liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${-delta}`), 0)
		).to.be.revertedWithCustomError(gmxReactor, "GmxCallbackPending")
		await executeIncreasePosition()

		await checkPositionExecutedEvent(-delta)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceBeforeLP - usdcNativeBalanceAfterLP
		expect(usdcNativeBalanceDiff).to.be.within(9995, 10005)

		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(positionsAfter[0]).to.eq(utils.parseUnits("20000", 30))
		expect(parseFloat(utils.formatUnits(positionsAfter[1], 30))).to.be.within(9950, 10000)
		expect(positionsAfter[2]).to.eq(utils.parseUnits("2000", 30))
		expect(positionsAfter[8]).to.eq(0)
		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("-10"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(positionsAfter[1], 30)))
	})
	it("closes half the short pos in profit", async () => {
		// set price to $1400
		// should be $6000 unrealised profit
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1400", 8))
		const delta1 = -4
		const delta2 = -1

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const positionsBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta1}`), 0)
		await executeDecreasePosition()
		await checkPositionExecutedEvent(-delta1)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta2}`), 0)
		await executeDecreasePosition()
		await checkPositionExecutedEvent(-delta2)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		const deltaAfter = await gmxReactor.internalDelta()
		// 8000 USDC should be removed from collateral, plus 3000 USDC in unrealised pnl
		expect(usdcNativeBalanceDiff).to.be.within(10900, 11000)
		expect(deltaAfter).to.eq(utils.parseEther("-5"))

		expect(positionsAfter[0]).to.eq(utils.parseUnits("10000", 30))
		expect(parseFloat(utils.formatUnits(positionsAfter[1], 30))).to.be.within(1990, 2010)
		expect(positionsAfter[2]).to.eq(utils.parseUnits("2000", 30))
		expect(parseFloat(utils.formatUnits(positionsAfter[8], 30))).to.eq(3000)

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(
			parseFloat(utils.formatUnits(positionsAfter[1].add(positionsAfter[8]), 30))
		)
	})
	it("closes remaining short and flips long in a single tx", async () => {
		// currently short 5 delta
		// this should close short and open a 5 delta long
		const price = 1400
		const delta = -10
		const deltaBefore = await gmxReactor.internalDelta()
		expect(deltaBefore).to.eq(utils.parseEther("-5"))
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const shortPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		const longPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(shortPositionBefore[0]).to.eq(utils.parseUnits("10000", 30))
		expect(longPositionBefore[0]).to.eq(0)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		// -------- execute the increase long request
		await executeIncreasePosition()
		await checkPositionExecutedEvent(5)

		const longPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValueIntermediate = parseInt(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValueIntermediate).to.eq(
			parseInt(
				parseFloat(utils.formatUnits(shortPositionBefore[1].add(shortPositionBefore[8]), 30)) +
					parseFloat(utils.formatUnits(longPositionAfter[1].add(longPositionAfter[8]), 30))
			)
		)

		// -------- execute the decrease short request
		await executeDecreasePosition()
		await checkPositionExecutedEvent(5)

		// positions after
		const shortPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)

		expect(shortPositionAfter[0]).to.eq(0)
		// trading fees are taking from collateral
		expect(shortPositionAfter[1]).to.eq(0)
		expect(shortPositionAfter[8]).to.eq(0)
		expect(longPositionAfter[0]).to.eq(utils.parseUnits("7000", 30))
		expect(parseFloat(utils.formatUnits(longPositionAfter[1], 30))).to.be.within(3480, 3500)
		expect(longPositionAfter[8]).to.eq(0)

		// expected to be the collateral returned from closing short minus collateral required to open long
		const expectedUsdcNativeDiff =
			parseFloat(utils.formatUnits(shortPositionBefore[1].add(shortPositionBefore[8]), 30)) -
			((-delta + parseInt(utils.formatEther(deltaBefore))) * price) / 2
		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		expect(usdcNativeBalanceDiff).to.be.within(expectedUsdcNativeDiff * 0.99, expectedUsdcNativeDiff)
		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("5"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(longPositionAfter[1], 30)))
	})
	it("it increases long when position is in a small profit", async () => {
		// set price to $1600
		// should be $1000 unrealised profit
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1600", 8))
		// add 5 delta to long
		const delta = -5

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const longPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		await executeIncreasePosition()
		await checkPositionExecutedEvent(-delta)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceBeforeLP - usdcNativeBalanceAfterLP

		const longPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		// 3000 plus the trading fees that were deducted in last test
		const expectedUdscDiff = 3000 + 3500 - parseFloat(utils.formatUnits(longPositionBefore[1], 30))
		expect(usdcNativeBalanceDiff).to.be.within(expectedUdscDiff - 1, expectedUdscDiff + 1)
		expect(longPositionAfter[0]).to.eq(utils.parseUnits("15000", 30))
		expect(parseFloat(utils.formatUnits(longPositionAfter[1], 30))).to.be.within(6480, 6500)
		expect(longPositionAfter[2]).to.eq(utils.parseUnits("1500", 30))
		expect(longPositionAfter[8]).to.eq(utils.parseUnits("1000", 30))

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("10"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(
			parseFloat(utils.formatUnits(longPositionAfter[1].add(longPositionAfter[8]), 30))
		)
	})
	it("closes long in loss and flips short again", async () => {
		// currently long 10 delta
		const delta = 20

		// set price to $1300
		// should be $2000 unrealised loss
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1300", 8))

		const longPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)

		// -------- execute the increase short request
		await executeIncreasePosition()
		await checkPositionExecutedEvent(-10)

		const shortPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValueIntermediate = parseInt(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValueIntermediate).to.eq(
			parseInt(
				parseFloat(utils.formatUnits(longPositionBefore[1].sub(longPositionBefore[8]), 30)) +
					parseFloat(utils.formatUnits(shortPositionAfter[1].add(shortPositionAfter[8]), 30))
			)
		)

		// -------- execute the decrease long request
		await executeDecreasePosition()
		await checkPositionExecutedEvent(-10)

		const longPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(longPositionAfter[0]).to.eq(0)
		// trading fees are taking from collateral
		expect(longPositionAfter[1]).to.eq(0)
		expect(longPositionAfter[8]).to.eq(0)

		expect(shortPositionAfter[0]).to.eq(utils.parseUnits("13000", 30))
		expect(parseFloat(utils.formatUnits(shortPositionAfter[1], 30))).to.be.within(6480, 6500)
		expect(shortPositionAfter[8]).to.eq(0)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP

		const expectedUdscDiff =
			parseFloat(utils.formatUnits(longPositionBefore[1].sub(longPositionBefore[8]), 30)) - 6500
		expect(usdcNativeBalanceDiff).to.be.within(expectedUdscDiff - 40, expectedUdscDiff)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("-10"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(shortPositionAfter[1], 30)))
	})
	it("adds to short when in loss", async () => {
		// currently short 10 delta
		// add another 5 delta to short
		const delta = 5
		// set price to $1500
		// should be $2000 unrealised loss
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1500", 8))

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const shortPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		await executeIncreasePosition()
		await checkPositionExecutedEvent(-delta)

		// position after

		const shortPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(shortPositionAfter[0]).to.eq(utils.parseUnits("20500", 30)) // 1300 * 10 + 1500 * 5
		expect(parseFloat(utils.formatUnits(shortPositionAfter[1], 30))).to.be.within(12220, 12250) // (20500 / 2) + 2000
		expect(parseInt(utils.formatUnits(shortPositionAfter[2], 30))).to.eq(1366)

		expect(parseFloat(utils.formatUnits(shortPositionAfter[8], 30))).to.eq(2000)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceBeforeLP - usdcNativeBalanceAfterLP

		const expectedUdscDiff =
			3750 +
			parseFloat(
				utils.formatUnits(
					shortPositionBefore[8].add(shortPositionBefore[0].div(2).sub(shortPositionBefore[1])),
					30
				)
			)

		expect(usdcNativeBalanceDiff).to.be.within(expectedUdscDiff - 2, expectedUdscDiff + 2)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("-15"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(
			parseFloat(utils.formatUnits(shortPositionAfter[1].sub(shortPositionAfter[8]), 30))
		)
	})
	it("syncs internal delta when short. should not change value", async () => {
		const deltaBefore = await gmxReactor.internalDelta()
		expect(deltaBefore).to.eq(utils.parseEther("-15"))

		await gmxReactor.sync()

		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("-15"))
	})
	it("closes short in loss and flips long", async () => {
		// currently short 15 delta
		// go long 25 delta
		const delta1 = -5
		const delta2 = -20
		// set price to $1600
		// should be $3500 unrealised loss
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1600", 8))

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const shortPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(parseFloat(utils.formatUnits(shortPositionBefore[8], 30))).to.eq(3500)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta1}`), 0)
		// -------- execute the decrease short request
		await executeDecreasePosition()
		await checkPositionExecutedEvent(-delta1)

		// -------- execute the increase long request
		await executeIncreasePosition()
		await checkPositionExecutedEvent(-delta1)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta2}`), 0)
		// -------- execute the decrease short request
		await executeDecreasePosition()
		await checkPositionExecutedEvent(10)

		// -------- execute the increase long request
		await executeIncreasePosition()
		await checkPositionExecutedEvent(10)

		// positions after

		const shortPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		const longPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(shortPositionAfter[0]).to.eq(0)
		expect(shortPositionAfter[1]).to.eq(0)
		expect(shortPositionAfter[8]).to.eq(0)

		expect(longPositionAfter[0]).to.eq(utils.parseUnits("16000", 30))
		expect(parseFloat(utils.formatUnits(longPositionAfter[1], 30))).to.be.within(7950, 8000)
		expect(longPositionAfter[8]).to.eq(0)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP

		const expectedUdscDiff =
			parseFloat(utils.formatUnits(shortPositionBefore[1].sub(shortPositionBefore[8]), 30)) - 8000
		expect(usdcNativeBalanceDiff).to.be.within(expectedUdscDiff - 50, expectedUdscDiff)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("10"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(longPositionAfter[1], 30)))
	})
	it("syncs internal delta when long. should not change value", async () => {
		const deltaBefore = await gmxReactor.internalDelta()
		expect(deltaBefore).to.eq(utils.parseEther("10"))

		await gmxReactor.sync()

		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("10"))
	})
})
describe("change to 4x leverage factor", async () => {
	it("updates heath factor to target 4x leverage", async () => {
		const newHealthFactor = 2500
		await gmxReactor.connect(deployer).setHealthFactor(newHealthFactor)

		expect(await gmxReactor.healthFactor()).to.eq(newHealthFactor)
	})
	it("rebalances existing long position", async () => {
		// current delta is 10
		const positionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionBefore[0]).to.eq(utils.parseUnits("16000", 30))
		expect(parseFloat(utils.formatUnits(positionBefore[1], 30))).to.be.within(7950, 8000)

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)

		await gmxReactor.update()
		await executeDecreasePosition()
		await checkPositionExecutedEvent(0)

		const positionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		expect(usdcNativeBalanceDiff).to.be.within(3940, 3980)
		expect(positionAfter[0]).to.eq(utils.parseUnits("16000", 30))
		expect(parseFloat(utils.formatUnits(positionAfter[1], 30))).to.be.within(3990, 4010)

		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("10"))
	})
	it("decreases a long position in profit", async () => {
		// set price to $1700
		// $1000 in profit
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1700", 8))
		const delta = 5
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const positionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		await executeDecreasePosition()
		await checkPositionExecutedEvent(-delta)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		const deltaAfter = await gmxReactor.internalDelta()
		// 2500 USDC should be removed from collateral, plus 500 USDC in unrealised pnl
		expect(usdcNativeBalanceDiff).to.be.within(2980, 3000)
		expect(deltaAfter).to.eq(utils.parseEther("5"))

		expect(positionAfter[0]).to.eq(utils.parseUnits("8000", 30))
		expect(parseFloat(utils.formatUnits(positionAfter[1], 30))).to.be.within(1490, 1500)
		expect(positionAfter[2]).to.eq(utils.parseUnits("1600", 30))
		expect(parseFloat(utils.formatUnits(positionAfter[8], 30))).to.eq(500)

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(
			parseFloat(utils.formatUnits(positionAfter[1].add(positionAfter[8]), 30))
		)
	})
	it("rebalances a position where unrealised pnl is greater than collateral size", async () => {
		// set price to $2600
		// $5000 in profit
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2600", 8))
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const positionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionBefore[0]).to.eq(utils.parseUnits("8000", 30))
		expect(parseFloat(utils.formatUnits(positionBefore[1], 30))).to.be.within(1490, 1500)
		expect(parseFloat(utils.formatUnits(positionBefore[8], 30))).to.eq(5000)

		await gmxReactor.update()
		await executeDecreasePosition()
		await checkPositionExecutedEvent(0)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		const expectedUdscDiff =
			parseFloat(utils.formatUnits(positionBefore[1], 30)) -
			parseFloat(utils.formatUnits(positionAfter[0], 30)) /
				(((await gmxVault.maxLeverage()) / 10000) * 0.9)
		expect(usdcNativeBalanceDiff).to.be.within(expectedUdscDiff - 10, expectedUdscDiff)
		expect(positionAfter[0]).to.eq(utils.parseUnits("8000", 30))
		// remaining collat should be 1/90th of pos size (maxLeverage * 0.9)
		expect(parseFloat(utils.formatUnits(positionAfter[1], 30))).to.be.within(88, 89)

		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("5"))
	})
	it("rebalances a position that is already at min collateral limit and even more in profit", async () => {
		// set price to $3000
		// $7000 in profit
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("3000", 8))
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const positionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionBefore[0]).to.eq(utils.parseUnits("8000", 30))
		expect(parseFloat(utils.formatUnits(positionBefore[1], 30))).to.be.within(88, 89)
		expect(parseFloat(utils.formatUnits(positionBefore[8], 30))).to.eq(7000)

		await gmxReactor.update()
		await executeDecreasePosition()
		await checkPositionExecutedEvent(0)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(usdcNativeBalanceDiff).to.eq(0)
		expect(positionAfter[0]).to.eq(positionBefore[0])
		expect(positionAfter[1]).to.eq(positionBefore[1])
		expect(positionAfter[8]).to.eq(positionBefore[8])

		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("5"))
	})
	it("closes a portion of the long already at min collateral threshold", async () => {
		// curently long 5 delta
		// close 1 delta
		const delta = 1
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const positionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionBefore[0]).to.eq(utils.parseUnits("8000", 30))
		expect(parseFloat(utils.formatUnits(positionBefore[1], 30))).to.be.within(88, 89)
		expect(parseFloat(utils.formatUnits(positionBefore[8], 30))).to.eq(7000)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		// Try to send a fraudulent callback - must revert
		const logs = await gmxReactor.queryFilter(gmxReactor.filters.CreateDecreasePosition(), 0)
		const positionKey = logs[logs.length - 1].args[0]
		await expect(
			gmxReactor.gmxPositionCallback(positionKey, true, false)
		).to.be.revertedWithCustomError(gmxReactor, "InvalidGmxCallback")
		// execute position
		await executeDecreasePosition()
		await checkPositionExecutedEvent(-delta)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionAfter[0]).to.eq(utils.parseUnits("6400", 30))
		// collateral should be 1/90th of position size
		expect(parseFloat(utils.formatUnits(positionAfter[1], 30))).to.be.within(70.5, 71.5)
		expect(parseFloat(utils.formatUnits(positionAfter[8], 30))).to.eq(5600)
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("4"))
	})
	it("rebalances a position with a negative health factor", async () => {
		// set price to $1000
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1000", 8))
		const healthLogsBefore = await gmxReactor.checkVaultHealth()
		expect(healthLogsBefore.health).to.be.lt(0)

		await gmxReactor.update()
		await executeIncreasePosition()
		await checkPositionExecutedEvent(0)

		const positionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		expect(positionAfter[8]).to.eq(positionAfter[2].sub(utils.parseUnits("1000", 30)).mul(4))
		expect(
			parseFloat(utils.formatUnits(positionAfter[0], 30)) /
				(parseFloat(utils.formatUnits(positionAfter[1], 30)) -
					parseFloat(utils.formatUnits(positionAfter[8], 30)))
		).to.be.within(4, 4.1)
		const healthLogsAfter = await gmxReactor.checkVaultHealth()
		expect(healthLogsAfter.health).to.be.gt(0)
	})
	it("increases a position with huge profit that will go under min collateral amount", async () => {
		// set price to $1000
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("500000", 8))
		const healthLogsBefore = await gmxReactor.checkVaultHealth()
		// go long by 1 more delta
		const delta = -1

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		await executeIncreasePosition()
		await checkPositionExecutedEvent(-delta)

		const positionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionAfter[0]).to.eq(utils.parseUnits("506400", 30))
		// collateral should be 1/90th of position size minus 0.1% trading fee
		expect(parseFloat(utils.formatUnits(positionAfter[1], 30))).to.be.within(5106, 5126)
	})
	it("withdraws ETH from contract", async () => {
		const contractBalanceBefore = await ethers.provider.getBalance(gmxReactor.address)
		const deployerBalanceBefore = await ethers.provider.getBalance(funderAddress)

		const amountOut = utils.parseEther("0.1")
		await gmxReactor.connect(deployer).sweepFunds(amountOut, funderAddress)

		const contractBalanceAfter = await ethers.provider.getBalance(gmxReactor.address)
		const deployerBalanceAfter = await ethers.provider.getBalance(funderAddress)
		expect(contractBalanceAfter).to.eq(contractBalanceBefore.sub(amountOut))
		expect(deployerBalanceAfter).to.eq(deployerBalanceBefore.add(amountOut))
	})
	it("withdraws all ETH from contract", async () => {
		const contractBalanceBefore = await ethers.provider.getBalance(gmxReactor.address)
		const deployerBalanceBefore = await ethers.provider.getBalance(funderAddress)
		// more than available
		const amountOut = utils.parseEther("1000")
		await gmxReactor.connect(deployer).sweepFunds(amountOut, funderAddress)

		const contractBalanceAfter = await ethers.provider.getBalance(gmxReactor.address)
		const deployerBalanceAfter = await ethers.provider.getBalance(funderAddress)
		expect(contractBalanceAfter).to.eq(0)
		expect(deployerBalanceAfter).to.eq(deployerBalanceBefore.add(contractBalanceBefore))
	})
})

describe("price moves between submitting and executing orders", async () => {
	it("updates heath factor to target 2x leverage again", async () => {
		const newHealthFactor = 5000
		await gmxReactor.connect(deployer).setHealthFactor(newHealthFactor)

		expect(await gmxReactor.healthFactor()).to.eq(newHealthFactor)
	})
	it("closes long in profit", async () => {
		const funder = await ethers.getSigner(funderAddress)
		await funder.sendTransaction({ to: gmxReactor.address, value: utils.parseEther("1") })

		const delta = await gmxReactor.internalDelta()
		const positionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("200000", 8))
		await liquidityPool.rebalancePortfolioDelta(delta.mul(999999).div(1000000), 0)
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("199998", 8))

		await executeDecreasePosition()

		const positionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
	})
	it("opens a long position", async () => {
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))

		const delta = 2
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const currentPriceBefore = parseFloat(
			utils.formatEther(await priceFeed.getNormalizedRate(wethAddress, usdcBridged.address))
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`-${delta}`), 0)
		await executeIncreasePosition()

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		// check that the reactor doesnt hold any USDC before or after
		expect(usdcNativeBalanceBeforeReactor).to.eq(usdcNativeBalanceAfterReactor).to.eq(0)
		// check that the correct amount of USDC was taken from LP
		expect(
			usdcNativeBalanceAfterLP - (usdcNativeBalanceBeforeLP - (delta / 2) * currentPriceBefore)
		).to.be.within(-5, 5)

		const positions = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		expect(parseFloat(utils.formatUnits(positions[0], 30))).to.eq(4000)
		expect(parseFloat(utils.formatUnits(positions[1], 30))).to.be.within(1980, 2000)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("2"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(positions[1], 30)))
	})
	it("closes the long position at a loss while price drops during pending order", async () => {
		// at $1600, should be a $800 loss
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1600", 8))
		const positionsBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionsBefore[7]).to.eq(0) // indicated position in loss
		expect(positionsBefore[8]).to.eq(utils.parseUnits("800", 30)) // unrealised pnl
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const delta = 2
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta / 2}`), 0)
		await executeDecreasePosition()
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${(delta * 10000) / 20001}`), 0)
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1594", 8))

		await executeDecreasePosition()

		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionsAfter[0]).to.eq(positionsAfter[1]).to.eq(positionsAfter[8]).to.eq(0)
		// expect balance to be 1200 minus trading fees
		expect(usdcNativeBalanceDiff).to.be.lt(1200)
		expect(usdcNativeBalanceDiff).to.be.gt(1170)
		expect(usdcNativeBalanceAfterReactor).to.eq(usdcNativeBalanceBeforeReactor).to.eq(0)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("0"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(0)
	})
	it("opens a long position", async () => {
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))

		const delta = 2
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const currentPriceBefore = parseFloat(
			utils.formatEther(await priceFeed.getNormalizedRate(wethAddress, usdcNative.address))
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`-${delta}`), 0)
		await executeIncreasePosition()

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		// check that the reactor doesnt hold any USDC before or after
		expect(usdcNativeBalanceBeforeReactor).to.eq(usdcNativeBalanceAfterReactor).to.eq(0)
		// check that the correct amount of USDC was taken from LP
		expect(
			usdcNativeBalanceAfterLP - (usdcNativeBalanceBeforeLP - (delta / 2) * currentPriceBefore)
		).to.be.within(-5, 5)

		const positions = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		expect(parseFloat(utils.formatUnits(positions[0], 30))).to.eq(4000)
		expect(parseFloat(utils.formatUnits(positions[1], 30))).to.be.within(1980, 2000)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("2"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(positions[1], 30)))
	})
	it("closes the long position at a loss while price rises during pending order", async () => {
		// at $1600, should be a $800 loss
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1600", 8))
		const positionsBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionsBefore[7]).to.eq(0) // indicated position in loss
		expect(positionsBefore[8]).to.eq(utils.parseUnits("800", 30)) // unrealised pnl
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const delta = 2
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta / 2}`), 0)
		await executeDecreasePosition()
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${(delta * 10000) / 20001}`), 0)
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1606", 8))

		await executeDecreasePosition()

		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(positionsAfter[0]).to.eq(positionsAfter[1]).to.eq(positionsAfter[8]).to.eq(0)
		// expect balance to be 1200 minus trading fees
		expect(usdcNativeBalanceDiff).to.be.lt(1200)
		expect(usdcNativeBalanceDiff).to.be.gt(1170)
		expect(usdcNativeBalanceAfterReactor).to.eq(usdcNativeBalanceBeforeReactor).to.eq(0)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("0"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(0)
	})
	it("opens a short position", async () => {
		// set price to $2000
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))
		expect(await gmxReactor.internalDelta()).to.eq(0)
		const delta = 10
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		await executeIncreasePosition()

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceBeforeLP - usdcNativeBalanceAfterLP
		expect(usdcNativeBalanceDiff).to.be.within(9999, 10001)

		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(positionsAfter[0]).to.eq(utils.parseUnits("20000", 30))
		expect(parseFloat(utils.formatUnits(positionsAfter[1], 30))).to.be.within(9950, 10000)
		expect(positionsAfter[2]).to.eq(utils.parseUnits("2000", 30))
		expect(positionsAfter[8]).to.eq(0)
		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("-10"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(positionsAfter[1], 30)))
	})
	it("closes short in profit and price rises while order pending", async () => {
		const delta = -10
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1800", 8))

		const positionsBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(positionsBefore[7]).to.eq(1) // indicated position in profit
		expect(positionsBefore[8]).to.eq(utils.parseUnits("2000", 30)) // unrealised pnl
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${(delta * 99999) / 100000}`), 0)
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1805", 8))

		await executeDecreasePosition()

		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(positionsAfter[0]).to.eq(positionsAfter[1]).to.eq(positionsAfter[8]).to.eq(0)
		// expect balance to be 11950 minus trading fees
		expect(usdcNativeBalanceDiff).to.be.lt(11950)
		expect(usdcNativeBalanceDiff).to.be.gt(11900)
		expect(usdcNativeBalanceAfterReactor).to.eq(usdcNativeBalanceBeforeReactor).to.eq(0)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("0"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(0)
	})
	it("opens a short position", async () => {
		// set price to $2000
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))
		expect(await gmxReactor.internalDelta()).to.eq(0)
		const delta = 10
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		await executeIncreasePosition()

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceBeforeLP - usdcNativeBalanceAfterLP
		expect(usdcNativeBalanceDiff).to.be.within(9999, 10001)

		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(positionsAfter[0]).to.eq(utils.parseUnits("20000", 30))
		expect(parseFloat(utils.formatUnits(positionsAfter[1], 30))).to.be.within(9950, 10000)
		expect(positionsAfter[2]).to.eq(utils.parseUnits("2000", 30))
		expect(positionsAfter[8]).to.eq(0)
		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("-10"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(parseFloat(utils.formatUnits(positionsAfter[1], 30)))
	})
	it("closes short in profit and price falls while order pending", async () => {
		const delta = -10
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1800", 8))

		const positionsBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(positionsBefore[7]).to.eq(1) // indicated position in profit
		expect(positionsBefore[8]).to.eq(utils.parseUnits("2000", 30)) // unrealised pnl
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${(delta * 99999) / 100000}`), 0)
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1795", 8))

		await executeDecreasePosition()

		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(positionsAfter[0]).to.eq(positionsAfter[1]).to.eq(positionsAfter[8]).to.eq(0)
		// expect balance to be 12050 minus trading fees
		expect(usdcNativeBalanceDiff).to.be.lt(12050)
		expect(usdcNativeBalanceDiff).to.be.gt(11900)
		expect(usdcNativeBalanceAfterReactor).to.eq(usdcNativeBalanceBeforeReactor).to.eq(0)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("0"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(0)

		const logs = await gmxReactor.queryFilter(gmxReactor.filters.RebalancePortfolioDeltaFailed(), 0)
		// no orders should have failed
		expect(logs.length).to.eq(0)
	})
	it("attempts to open a short position but execution fails", async () => {
		// set price to $2000
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))
		expect(await gmxReactor.internalDelta()).to.eq(0)
		const delta = 10
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const failedOrderEventsBefore = await gmxReactor.queryFilter(
			gmxReactor.filters.RebalancePortfolioDeltaFailed(),
			0
		)
		expect(failedOrderEventsBefore.length).to.eq(0)
		const positionsBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		const usdcNativeBalance2 = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		// set price to much lower value
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1800", 8))
		// fast forward 3 min
		await ethers.provider.send("evm_increaseTime", [180])
		await ethers.provider.send("evm_mine")
		await executeIncreasePosition()
		// await gmxPositionRouter.connect(deployer).executeIncreasePositions(50000, deployerAddress)
		const usdcNativeBalance3 = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const failedOrderEventsAfter = await gmxReactor.queryFilter(
			gmxReactor.filters.RebalancePortfolioDeltaFailed(),
			0
		)
		const positionsAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		expect(failedOrderEventsAfter.length).to.eq(1)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)
		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP
		expect(positionsAfter[0]).to.eq(positionsAfter[1]).to.eq(positionsAfter[8]).to.eq(0)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("0"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValue).to.eq(0)
		expect(usdcNativeBalanceDiff).to.within(-5, 0)
		expect(await usdcNative.balanceOf(gmxReactor.address)).to.eq(0)
		expect(await gmxReactor.internalDelta()).to.eq(0)
	})
})
describe("griefing attack", async () => {
	it("opens long and requests close", async () => {
		const delta = -10
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		await executeIncreasePosition()

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("10"))

		await checkPositionExecutedEvent(-delta)

		// check multi-leg variables
		expect(await gmxReactor.longAndShortOpen()).to.be.false
		expect(await gmxReactor.openLongDelta()).to.eq(toWei("10"))
		expect(await gmxReactor.openShortDelta()).to.eq(0)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${-delta}`), 0)
		expect(await gmxReactor.pendingDecreaseCallback()).to.eq(1)
		expect(await gmxReactor.internalDelta()).to.eq(utils.parseEther("10"))
	})
	it("third party opens long and requests decrease", async () => {
		let positionKey
		const gmxRouter = await ethers.getContractAt(
			"contracts/interfaces/IRouter.sol:IRouter",
			gmxRouterAddress
		)
		await gmxRouter.connect(deployer).approvePlugin(gmxPositionRouterAddress)
		await usdcBridged.connect(deployer).approve(gmxRouterAddress, utils.parseUnits("10000", 6))
		positionKey = await gmxPositionRouter
			.connect(deployer)
			.callStatic.createIncreasePosition(
				[usdcBridged.address, wethAddress],
				wethAddress,
				utils.parseUnits("100", 6),
				0,
				utils.parseUnits("200", 30),
				true,
				utils.parseUnits("1800", 30),
				await gmxPositionRouter.minExecutionFee(),
				utils.formatBytes32String("leverageisfun"),
				gmxReactor.address,
				{ value: gmxPositionRouter.minExecutionFee() }
			)
		await gmxPositionRouter
			.connect(deployer)
			.createIncreasePosition(
				[usdcBridged.address, wethAddress],
				wethAddress,
				utils.parseUnits("100", 6),
				0,
				utils.parseUnits("200", 30),
				true,
				utils.parseUnits("1800", 30),
				await gmxPositionRouter.minExecutionFee(),
				utils.formatBytes32String("leverageisfun"),
				gmxReactor.address,
				{ value: gmxPositionRouter.minExecutionFee() }
			)

		await ethers.provider.send("evm_increaseTime", [180])
		await ethers.provider.send("evm_mine")

		await gmxPositionRouter.connect(deployer).executeIncreasePosition(positionKey, deployerAddress)

		expect(await gmxReactor.pendingDecreaseCallback()).to.eq(1)
		expect(await gmxReactor.internalDelta()).to.eq(utils.parseEther("10"))

		positionKey = await gmxPositionRouter
			.connect(deployer)
			.callStatic.createDecreasePosition(
				[wethAddress, usdcBridged.address],
				wethAddress,
				utils.parseUnits("50", 6),
				utils.parseUnits("100", 30),
				true,
				deployerAddress,
				utils.parseUnits("1800", 30),
				0,
				await gmxPositionRouter.minExecutionFee(),
				false,
				gmxReactor.address,
				{ value: gmxPositionRouter.minExecutionFee() }
			)

		await gmxPositionRouter
			.connect(deployer)
			.createDecreasePosition(
				[wethAddress, usdcBridged.address],
				wethAddress,
				utils.parseUnits("50", 6),
				utils.parseUnits("100", 30),
				true,
				deployerAddress,
				utils.parseUnits("1800", 30),
				0,
				await gmxPositionRouter.minExecutionFee(),
				false,
				gmxReactor.address,
				{ value: gmxPositionRouter.minExecutionFee() }
			)
		await ethers.provider.send("evm_increaseTime", [180])
		await ethers.provider.send("evm_mine")
		await gmxPositionRouter.connect(deployer).executeDecreasePosition(positionKey, deployerAddress)

		expect(await gmxReactor.pendingDecreaseCallback()).to.eq(1)
		expect(await gmxReactor.internalDelta()).to.eq(utils.parseEther("10"))
	})
	it("closes reactor position", async () => {
		await executeDecreasePosition()

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("0"))

		// check multi-leg variables
		expect(await gmxReactor.longAndShortOpen()).to.be.false
		expect(await gmxReactor.openLongDelta()).to.eq(0)
		expect(await gmxReactor.openShortDelta()).to.eq(0)

		expect(await gmxReactor.pendingDecreaseCallback()).to.eq(0)
		expect(await gmxReactor.internalDelta()).to.eq(utils.parseEther("0"))
	})
})
describe("multi leg hedges fail resulting in simultaneous long and short", async () => {
	it("opens a 10 delta long position", async () => {
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))

		const delta = 10
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceBeforeReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		const currentPriceBefore = parseFloat(
			utils.formatEther(await priceFeed.getNormalizedRate(wethAddress, usdcBridged.address))
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`-${delta}`), 0)

		// check getPoolDemoninatedvalue is correct during pending position increase
		const poolDenominatedValueBeforeExecute = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		const usdcNativeBalanceIntermediateLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		expect(poolDenominatedValueBeforeExecute).to.be.within(
			(usdcNativeBalanceBeforeLP - usdcNativeBalanceIntermediateLP) * 0.999,
			(usdcNativeBalanceBeforeLP - usdcNativeBalanceIntermediateLP) * 1.001
		)
		await executeIncreasePosition()

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPoolAddress), 6)
		)
		const usdcNativeBalanceAfterReactor = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(gmxReactor.address), 6)
		)
		// check that the reactor doesnt hold any USDC before or after
		expect(usdcNativeBalanceBeforeReactor).to.eq(usdcNativeBalanceAfterReactor).to.eq(0)
		// check that the correct amount of USDC was taken from LP
		expect(
			usdcNativeBalanceAfterLP - (usdcNativeBalanceBeforeLP - (delta / 2) * currentPriceBefore)
		).to.be.within(-5, 5)

		const positions = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		expect(parseFloat(utils.formatUnits(positions[0], 30))).to.eq(20000)
		expect(parseFloat(utils.formatUnits(positions[1], 30))).to.be.within(9800, 10000)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("10"))

		await checkPositionExecutedEvent(delta)

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValueAfterExecute = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		expect(poolDenominatedValueAfterExecute).to.eq(parseFloat(utils.formatUnits(positions[1], 30)))

		// check multi-leg variables
		expect(await gmxReactor.longAndShortOpen()).to.be.false
		expect(await gmxReactor.openLongDelta()).to.eq(toWei("10"))
		expect(await gmxReactor.openShortDelta()).to.eq(0)
	})
	it("attempts to close long and flip short but decrease long request fails", async () => {
		// currently long 10 delta
		const delta = 20

		const longPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)

		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)

		// -------- execute the increase short request
		await executeIncreasePosition()
		await checkPositionExecutedEvent(-10)

		// -------- execute the decrease long request
		// change price to something that will be rejected
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1800", 8))
		await executeDecreasePosition()
		// await gmxPositionRouter.connect(deployer).executeDecreasePositions(50000, deployerAddress)
		await checkPositionExecutedEvent(-10)

		// positions after
		const shortPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		const longPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(longPositionAfter[0]).to.eq(longPositionBefore[0])
		// trading fees are taking from collateral
		expect(longPositionAfter[1]).to.eq(longPositionBefore[1])
		expect(shortPositionAfter[0]).to.eq(utils.parseUnits("20000", 30))
		expect(parseFloat(utils.formatUnits(shortPositionAfter[1], 30))).to.be.within(9980, 10000)
		// expect(shortPositionAfter[8]).to.eq(0)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP

		const expectedUdscDiff = -10000
		expect(usdcNativeBalanceDiff).to.be.within(expectedUdscDiff - 100, expectedUdscDiff)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("0"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		// pool denominated value must include collateral from both legs
		expect(poolDenominatedValue).to.eq(
			parseFloat(utils.formatUnits(shortPositionAfter[1].add(shortPositionAfter[8]), 30)) +
				parseFloat(utils.formatUnits(longPositionAfter[1].sub(longPositionAfter[8]), 30))
		)

		// check multi-leg variables
		expect(await gmxReactor.longAndShortOpen()).to.be.true
		expect(await gmxReactor.openLongDelta()).to.eq(toWei("10"))
		expect(await gmxReactor.openShortDelta()).to.eq(toWei("10"))
	})
	it("calls update on reactor with equally large short and long open, neuralising both", async () => {
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("1950", 8))
		const pendingIncreaseCallback = await gmxReactor.pendingIncreaseCallback()
		const pendingDecreaseCallback = await gmxReactor.pendingDecreaseCallback()
		await gmxReactor.update()

		await executeDoubleDecreasePosition()

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)

		expect(poolDenominatedValue).to.eq(0)

		const healthLogs = await gmxReactor.checkVaultHealth()
		expect(healthLogs.health).to.eq(5000)
		expect(healthLogs[5]).to.be.false

		// check multi-leg variables
		expect(await gmxReactor.openLongDelta()).to.eq(toWei("0"))
		expect(await gmxReactor.openShortDelta()).to.eq(toWei("0"))
		expect(await gmxReactor.longAndShortOpen()).to.be.false
	})
	it("opens a 10 delta short", async () => {
		const delta = 10
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`${delta}`), 0)
		await executeIncreasePosition()

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("-10"))

		await checkPositionExecutedEvent(-delta)

		// check multi-leg variables
		expect(await gmxReactor.longAndShortOpen()).to.be.false
		expect(await gmxReactor.openLongDelta()).to.eq(0)
		expect(await gmxReactor.openShortDelta()).to.eq(toWei("10"))
	})
	it("attempts to close short and flip long by 5 deltas but close short fails", async () => {
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2000", 8))

		// currently short 10 delta
		const delta = 15

		const shortPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		///////////-----------
		const longPositionBefore = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		///////////------------
		const usdcNativeBalanceBeforeLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`-${delta}`), 0)
		await expect(gmxReactor.update()).to.be.revertedWithCustomError(gmxReactor, "GmxCallbackPending")
		// -------- execute the increase long request
		await executeIncreasePosition()
		await checkPositionExecutedEvent(5)

		// -------- execute the decrease short request
		// change price to something that will be rejected
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2200", 8))
		await executeDecreasePosition()
		// await gmxPositionRouter.connect(deployer).executeDecreasePositions(50000, deployerAddress)

		// close short didnt execute so should still show long increase delta
		await checkPositionExecutedEvent(5)

		// positions after
		const shortPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[usdcBridged.address],
			[wethAddress],
			[false]
		)
		const longPositionAfter = await gmxReader.getPositions(
			"0x489ee077994B6658eAfA855C308275EAd8097C4A",
			gmxReactor.address,
			[wethAddress],
			[wethAddress],
			[true]
		)
		expect(shortPositionAfter[0]).to.eq(shortPositionBefore[0])
		// trading fees are taking from collateral
		expect(shortPositionAfter[1]).to.eq(shortPositionBefore[1])
		expect(longPositionAfter[0]).to.eq(utils.parseUnits("10000", 30))
		expect(parseFloat(utils.formatUnits(longPositionAfter[1], 30))).to.be.within(4480, 5000)

		const usdcNativeBalanceAfterLP = parseFloat(
			utils.formatUnits(await usdcNative.balanceOf(liquidityPool.address), 6)
		)

		const usdcNativeBalanceDiff = usdcNativeBalanceAfterLP - usdcNativeBalanceBeforeLP

		const expectedUdscDiff = -5000
		expect(usdcNativeBalanceDiff).to.be.within(expectedUdscDiff - 100, expectedUdscDiff)

		// check internalDelta var is correct
		const deltaAfter = await gmxReactor.internalDelta()
		expect(deltaAfter).to.eq(utils.parseEther("-5"))

		// check getPoolDemoninatedvalue is correct
		const poolDenominatedValue = parseFloat(
			utils.formatEther(await gmxReactor.callStatic.getPoolDenominatedValue())
		)
		// pool denominated value must include collateral from both legs
		expect(poolDenominatedValue).to.eq(
			parseFloat(utils.formatUnits(shortPositionAfter[1].sub(shortPositionAfter[8]), 30)) +
				parseFloat(utils.formatUnits(longPositionAfter[1].add(longPositionAfter[8]), 30))
		)

		// check multi-leg variables
		expect(await gmxReactor.longAndShortOpen()).to.be.true
		expect(await gmxReactor.openLongDelta()).to.eq(toWei("5"))
		expect(await gmxReactor.openShortDelta()).to.eq(toWei("10"))

		const healthLogs = await gmxReactor.checkVaultHealth()
		const expectedHealth = parseInt(5000 * (1 - 2 * (2200 / 1950 - 1)))
		expect(healthLogs.health).to.be.within(expectedHealth - 20, expectedHealth + 20)
		expect(healthLogs[5]).to.be.true
	})
	it("calls update and neutralises both legs, leaving 5 delta short open", async () => {
		await gmxReactor.update()

		await executeDoubleDecreasePosition()

		// check multi-leg variables
		expect(await gmxReactor.openLongDelta()).to.eq(toWei("0"))
		expect(await gmxReactor.openShortDelta()).to.eq(toWei("5"))
		expect(await gmxReactor.longAndShortOpen()).to.be.false

		const healthLogs = await gmxReactor.checkVaultHealth()
		expect(healthLogs.health).to.be.within(5000, 5050)
		expect(healthLogs[5]).to.be.false
	})
})
describe("gmx reactor auxilliary functions", async () => {
	it("reset position router address while position is pending", async () => {
		await mockChainlinkFeed.setLatestAnswer(utils.parseUnits("2100", 8))

		await gmxReactor.update()
		await expect(gmxReactor.connect(deployer).setPositionRouter(ZERO_ADDRESS)).to.be.reverted
		await executeDecreasePosition()
		expect(await gmxReactor.gmxPositionRouter()).to.eq(gmxPositionRouter.address)

		await gmxReactor.connect(deployer).setPositionRouter(ZERO_ADDRESS)
		expect(await gmxReactor.gmxPositionRouter()).to.eq(ZERO_ADDRESS)
		await gmxReactor.connect(deployer).setPositionRouter(gmxPositionRouter.address)
	})
	it("reverts when trying to remove gmx reactor from liquidity pool while a position execution is pending", async () => {
		// will be reverted due to liquidity pool calling hedgeDelta on the reactor, resulting in a pending decrease pos
		await expect(liquidityPool.removeHedgingReactorAddress(2, false)).to.be.reverted
	})
	it("hedges pos then shuts it down", async () => {
		const delta = 5
		await liquidityPool.rebalancePortfolioDelta(utils.parseEther(`-${delta}`), 0)
		await executeDecreasePosition()

		await liquidityPool.removeHedgingReactorAddress(0, false)

		await expect(liquidityPool.hedgingReactors(0)).to.be.reverted
	})
})
