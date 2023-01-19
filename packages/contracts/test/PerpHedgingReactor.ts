import { truncate } from "@ragetrade/sdk"
import { expect } from "chai"
import { BigNumber, Signer } from "ethers"
import hre, { ethers, network } from "hardhat"
import { ClearingHouse, ClearingHouseLens, MintableERC20, OracleMock, PerpHedgingReactor, PerpHedgingTest, PriceFeed } from "../types"

import { toUSDC, toWei, ZERO_ADDRESS } from "../utils/conversion-helper"
import { deployRage, deployRangeOrder } from "../utils/rage-deployer"
//@ts-ignore
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { priceToSqrtPriceX96 } from "../utils/price-tick"
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS } from "./constants"

let signers: Signer[]
let usdcWhale: Signer
let liquidityPoolDummy: PerpHedgingTest
let liquidityPoolDummyAddress: string
let usdcContract: MintableERC20
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
let perpHedgingReactor: PerpHedgingReactor
let vTokenAddress: string
let vQuoteAddress: string
let rageOracle: OracleMock
let clearingHouse: ClearingHouse
let poolId: string
let collateralId: string
let clearingHouseLens: ClearingHouseLens


// edit depending on the chain id to be tested on
const chainId = 1
const USDC_SCALE = "1000000000000"

describe("PerpHedgingReactor", () => {
	before(async function () {
		await network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						chainId: 1,
						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
						blockNumber: 12821000
					}
				}
			]
		})
	})
	it("#deploys dummy LP", async () => {
		signers = await ethers.getSigners()
		const liquidityPoolDummyFactory = await ethers.getContractFactory("PerpHedgingTest")
		liquidityPoolDummy = (await liquidityPoolDummyFactory.deploy()) as PerpHedgingTest
		liquidityPoolDummyAddress = liquidityPoolDummy.address

		expect(liquidityPoolDummy).to.have.property("setHedgingReactorAddress")
		expect(liquidityPoolDummy).to.have.property("hedgeDelta")
	})

	it("#funds accounts", async () => {
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		usdcWhale = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		usdcContract = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDC_ADDRESS[chainId]
		)) as MintableERC20

		await usdcContract
			.connect(usdcWhale)
			.transfer(liquidityPoolDummyAddress, ethers.utils.parseUnits("1000000", 6))
		await usdcContract
			.connect(usdcWhale)
			.transfer(await signers[0].getAddress(), ethers.utils.parseUnits("1000000", 6))
		await usdcContract
			.connect(usdcWhale)
			.transfer(await signers[1].getAddress(), ethers.utils.parseUnits("10000000", 6))
		const LPContractBalance = parseFloat(
			ethers.utils.formatUnits(await usdcContract.balanceOf(liquidityPoolDummyAddress), 6)
		)
	})
	let authority: string
	it("#deploy price feed", async () => {
		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)
		const authorityFactory = await hre.ethers.getContractFactory("Authority")
		const senderAddress = await signers[0].getAddress()
		authority = (await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)).address
		const sequencerUptimeFeedFactory = await ethers.getContractFactory("MockChainlinkSequencerFeed")
		const sequencerUptimeFeed = await sequencerUptimeFeedFactory.deploy()
		const priceFeedFactory = await ethers.getContractFactory("contracts/PriceFeed.sol:PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy(
			authority,
			sequencerUptimeFeed.address
		)) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, USDC_ADDRESS[chainId], ethUSDAggregator.address)
		await priceFeed.addPriceFeed(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			ethUSDAggregator.address
		)
		const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, USDC_ADDRESS[chainId])
		expect(feedAddress).to.eq(ethUSDAggregator.address)
		rate = "2000000000"
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			rate,
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await ethUSDAggregator.mock.decimals.returns("6")
	})

	it("#deploys rage", async () => {
		let rageParams = await deployRage()
		clearingHouse = rageParams.clearingHouse
		poolId = rageParams.poolId
		collateralId = rageParams.collateralId
		vQuoteAddress = rageParams.vQuoteAddress
		vTokenAddress = rageParams.vTokenAddress
		rageOracle = rageParams.rageOracle
		clearingHouseLens = rageParams.clearingHouseLens
	})
	it("#deploys the hedging reactor", async () => {
		const perpHedgingReactorFactory = await ethers.getContractFactory("PerpHedgingReactor", {
			signer: signers[0]
		})
		perpHedgingReactor = (await perpHedgingReactorFactory.deploy(
			clearingHouse.address,
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			liquidityPoolDummyAddress,
			poolId,
			collateralId,
			priceFeed.address,
			authority
		)) as PerpHedgingReactor

		expect(perpHedgingReactor).to.have.property("hedgeDelta")
	})

	it("#deploy range order", async () => {
		await deployRangeOrder(
			signers,
			clearingHouse,
			usdcContract,
			collateralId,
			vTokenAddress,
			vQuoteAddress
		)
	})
	it("sets reactor address on LP contract", async () => {
		const reactorAddress = perpHedgingReactor.address

		await liquidityPoolDummy.setHedgingReactorAddress(reactorAddress)
		perpHedgingReactor.setKeeper(liquidityPoolDummy.address, true)
		expect(await liquidityPoolDummy.perpHedgingReactor()).to.equal(reactorAddress)
	})
	it("returns 0 if getPoolDenominatedValue if not initialised", async () => {
		const val = await perpHedgingReactor.getPoolDenominatedValue()
		expect(val).to.equal(0)
	})

	it("reverts hedgeDelta if not initialised", async () => {
		const delta = ethers.utils.parseEther("20")

		await expect(liquidityPoolDummy.hedgeDelta(delta)).to.be.revertedWith("IncorrectCollateral()")
	})
	it("reverts update if not initialised", async () => {
		await expect(liquidityPoolDummy.update()).to.be.revertedWith("IncorrectCollateral()")
	})
	it("initialises the reactor", async () => {
		await usdcContract.approve(perpHedgingReactor.address, 1)
		await perpHedgingReactor.initialiseReactor()
		await expect(perpHedgingReactor.initialiseReactor()).to.be.reverted
	})
	it("SETUP: ping price", async () => {
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2500000000",
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
	})
	it("hedges a positive delta when position is zero", async () => {
		const delta = ethers.utils.parseEther("20")
		const deltaHedge = ethers.utils.parseEther("-20")

		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const realSqrtPrice = await priceToSqrtPriceX96(2500, 6, 18)
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2500000000",
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		expect(reactorWethBalanceBefore).to.equal(0)
		const collatRequired = price
			.mul(delta)
			.div(toWei("1"))
			.mul(await perpHedgingReactor.healthFactor())
			.div(10000)
			.div(USDC_SCALE)
			.sub(1)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		await liquidityPoolDummy.hedgeDelta(delta)
		const reactorCollatBalanceAfter = (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(deltaHedge).to.equal(reactorDeltaAfter)
		expect(reactorWethBalanceBefore.add(deltaHedge)).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter.add(collatRequired))
		expect(reactorCollatBalanceAfter).to.eq(reactorCollatBalanceBefore.add(collatRequired))
	})

	it("hedges delta back to 0", async () => {
		const delta = ethers.utils.parseEther("-20")
		const deltaHedge = ethers.utils.parseEther("20")

		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const collatRequired = price
			.mul(delta)
			.div(toWei("1"))
			.mul(await perpHedgingReactor.healthFactor())
			.div(10000)
			.div(USDC_SCALE)
			.add(1)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		await liquidityPoolDummy.hedgeDelta(delta)
		const reactorCollatBalanceAfter = (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(reactorDeltaAfter).to.equal(0)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore.add(deltaHedge))
		expect(reactorWethBalanceBefore.add(deltaHedge)).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore.sub(LpUsdcBalanceAfter.add(collatRequired))).to.be.within(
			0,
			1000000000
		)
		expect(reactorCollatBalanceAfter).to.eq(reactorCollatBalanceBefore.add(collatRequired))
	})

	it("hedges a positive delta when position is zero again", async () => {
		const delta = ethers.utils.parseEther("20")
		const deltaHedge = ethers.utils.parseEther("-20")

		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const collatRequired = price
			.mul(delta)
			.div(toWei("1"))
			.mul(await perpHedgingReactor.healthFactor())
			.div(10000)
			.div(USDC_SCALE)
			.sub(1)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		await liquidityPoolDummy.hedgeDelta(delta)
		const reactorCollatBalanceAfter = (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(deltaHedge).to.equal(reactorDeltaAfter)
		expect(reactorWethBalanceBefore.add(deltaHedge)).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter.add(collatRequired))
		expect(reactorCollatBalanceAfter).to.eq(reactorCollatBalanceBefore.add(collatRequired))
	})
	it("syncs profits", async () => {
		const hedgeDeltaTx = await liquidityPoolDummy.syncAndUpdate()
		await hedgeDeltaTx.wait()
		const profit = await clearingHouse.getAccountNetProfit(0)
		expect(profit).to.equal(0)
	})
	it("SUCCEEDS: checkvault health if price goes up", async () => {
		const realSqrtPrice = await priceToSqrtPriceX96(3500, 6, 18)
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"3500000000",
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice)
		const accountId = await perpHedgingReactor.accountId()
		const poolId = await perpHedgingReactor.poolId()
		const priceQuote = await priceFeed.getRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const netPositon = (await clearingHouse.getAccountNetTokenPosition(accountId, poolId)).mul(-1)
		const healthFactor = await perpHedgingReactor.healthFactor()
		const collateralId = await perpHedgingReactor.collateralId()
		const collat = (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const accountVal = (
			await clearingHouse.getAccountMarketValueAndRequiredMargin(accountId, false)
		)[0]
		const expectedHealth = accountVal.mul(10000).mul(toWei("1")).div(netPositon.mul(priceQuote))
		const collatToTransfer = netPositon
			.mul(priceQuote)
			.div(toWei("1"))
			.mul(healthFactor)
			.div(10000)
			.sub(accountVal)
		const healthStatus = await perpHedgingReactor.checkVaultHealth()
		expect(healthStatus[0]).to.equal(true)
		expect(healthStatus[1]).to.equal(false)
		expect(healthStatus[2]).to.equal(expectedHealth)
		expect(healthStatus[3]).to.equal(collatToTransfer)
	})
	it("SUCCEEDS: syncAndUpdate to get vault back on ", async () => {
		const accountId = await perpHedgingReactor.accountId()
		const poolId = await perpHedgingReactor.poolId()
		const priceQuote = await priceFeed.getRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const netPositon = (await clearingHouse.getAccountNetTokenPosition(accountId, poolId)).mul(-1)
		const healthFactor = await perpHedgingReactor.healthFactor()
		const accountVal = (
			await clearingHouse.getAccountMarketValueAndRequiredMargin(accountId, false)
		)[0]
		const expectedHealth = accountVal.mul(10000).mul(toWei("1")).div(netPositon.mul(priceQuote))
		const collatToTransfer = netPositon
			.mul(priceQuote)
			.div(toWei("1"))
			.mul(healthFactor)
			.div(10000)
			.sub(accountVal)
		const healthStatus = await perpHedgingReactor.checkVaultHealth()
		await perpHedgingReactor.syncAndUpdate()
		const healthStatusAfter = await perpHedgingReactor.checkVaultHealth()
		expect(healthStatusAfter[0]).to.equal(false)
		expect(healthStatusAfter[1]).to.equal(false)
		expect(healthStatusAfter[2]).to.equal(healthFactor)
		expect(healthStatusAfter[3]).to.equal(0)
	})
	it("SUCCEEDS: checkvault health if price goes down", async () => {
		const realSqrtPrice = await priceToSqrtPriceX96(1500, 6, 18)

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"1500000000",
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice)
		const accountId = await perpHedgingReactor.accountId()
		const poolId = await perpHedgingReactor.poolId()
		const accountVal = (
			await clearingHouse.getAccountMarketValueAndRequiredMargin(accountId, false)
		)[0]
		const priceQuote = await priceFeed.getRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const netPositon = (await clearingHouse.getAccountNetTokenPosition(accountId, poolId)).mul(-1)
		const healthFactor = await perpHedgingReactor.healthFactor()
		const collateralId = await perpHedgingReactor.collateralId()
		const collat = (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const expectedHealth = accountVal.mul(10000).mul(toWei("1")).div(netPositon.mul(priceQuote))
		const collatToTransfer = accountVal.sub(
			netPositon.mul(priceQuote).div(toWei("1")).mul(healthFactor).div(10000)
		)
		const healthStatus = await perpHedgingReactor.checkVaultHealth()
		const realSqrt = await priceToSqrtPriceX96(2500, 6, 18)

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2500000000",
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrt)
		expect(healthStatus[0]).to.equal(false)
		expect(healthStatus[1]).to.equal(true)
		expect(healthStatus[2]).to.equal(expectedHealth)
		expect(healthStatus[3]).to.equal(collatToTransfer)
	})
	it("SUCCEEDS: syncAndUpdate to get vault back onto normal", async () => {
		const accountId = await perpHedgingReactor.accountId()
		const poolId = await perpHedgingReactor.poolId()
		const priceQuote = await priceFeed.getRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const netPositon = (await clearingHouse.getAccountNetTokenPosition(accountId, poolId)).mul(-1)
		const healthFactor = await perpHedgingReactor.healthFactor()
		const accountVal = (
			await clearingHouse.getAccountMarketValueAndRequiredMargin(accountId, false)
		)[0]
		const expectedHealth = accountVal.mul(10000).mul(toWei("1")).div(netPositon.mul(priceQuote))
		const collatToTransfer = netPositon
			.mul(priceQuote)
			.div(toWei("1"))
			.mul(healthFactor)
			.div(10000)
			.sub(accountVal)
		const healthStatus = await perpHedgingReactor.checkVaultHealth()
		await perpHedgingReactor.syncAndUpdate()
		const healthStatusAfter = await perpHedgingReactor.checkVaultHealth()
		expect(healthStatusAfter[0]).to.equal(false)
		expect(healthStatusAfter[1]).to.equal(false)
		expect(healthStatusAfter[2]).to.equal(healthFactor)
		expect(healthStatusAfter[3]).to.equal(0)
	})
	it("hedges a negative delta", async () => {
		const realSqrt = await priceToSqrtPriceX96(2500, 6, 18)

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2500000000",
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrt)
		const delta = ethers.utils.parseEther("-0.5")
		const deltaHedge = ethers.utils.parseEther("0.5")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(delta)
		await hedgeDeltaTx.wait()
		const reactorCollatBalanceAfter = (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore.sub(delta))
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore.sub(delta))
		// expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter.add(collatRequired))
		expect(reactorCollatBalanceAfter).to.equal(reactorCollatBalanceBefore.add(collatRequired))
	})
	it("getDelta returns correct value", async () => {
		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		expect(reactorDelta).to.equal(-19.5)
	})
	it("gets the portfolio value", async () => {
		const usdBalance = await usdcContract.balanceOf(perpHedgingReactor.address)
		const netProfit = await clearingHouse.getAccountNetProfit(0)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalance = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const val = (await perpHedgingReactor.getPoolDenominatedValue()).div(USDC_SCALE)
		expect(usdBalance.add(netProfit).add(reactorCollatBalance)).to.eq(val)
	})
	it("hedges a positive delta with sufficient funds", async () => {
		const delta = ethers.utils.parseEther("0.3")
		const deltaHedge = ethers.utils.parseEther("-0.3")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(delta)
		await hedgeDeltaTx.wait()
		const reactorCollatBalanceAfter = (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore.sub(delta))
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore.sub(delta))
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter.add(collatRequired))
		expect(reactorCollatBalanceAfter).to.equal(reactorCollatBalanceBefore.add(collatRequired))
	})
	it("hedges a positive delta with insufficient funds", async () => {
		// attempts to hedge a very large amount should fail
		const delta = ethers.utils.parseEther("9000")
		await expect(liquidityPoolDummy.hedgeDelta(delta)).to.be.revertedWith(
			"WithdrawExceedsLiquidity()"
		)
	})
	it("liquidates usdc held position", async () => {
		const withdrawAmount = "1000"
		await usdcContract
			.connect(usdcWhale)
			.transfer(perpHedgingReactor.address, ethers.utils.parseUnits(withdrawAmount, 6))
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		// withdraw more than current balance
		await liquidityPoolDummy.withdraw(ethers.utils.parseUnits(withdrawAmount, 18))
		const reactorCollatBalanceAfter = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorUsdcBalanceAfter = await usdcContract.balanceOf(perpHedgingReactor.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(reactorUsdcBalanceAfter.add(toUSDC(withdrawAmount))).to.equal(reactorUsdcBalanceBefore)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter.sub(toUSDC(withdrawAmount)))
		expect(reactorCollatBalanceBefore).to.eq(reactorCollatBalanceAfter)
	})
	it("syncs profits", async () => {
		const hedgeDeltaTx = await liquidityPoolDummy.syncAndUpdate()
		await hedgeDeltaTx.wait()
		const profit = await clearingHouse.getAccountNetProfit(0)
		expect(profit).to.equal(0)
	})
	it("liquidates a bit of position and withdraws sufficient funds", async () => {
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const withdrawAmount = "1000"
		// withdraw more than current balance
		await liquidityPoolDummy.withdraw(ethers.utils.parseUnits(withdrawAmount, 18))
		const reactorCollatBalanceAfter = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)

		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
		expect(reactorCollatBalanceBefore).to.eq(reactorCollatBalanceAfter)
	})
	it("update fixes balances one way", async () => {
		const realSqrtPrice = await priceToSqrtPriceX96(2510, 6, 18)

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2510000000",
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = price
			.mul(reactorDeltaBefore)
			.div(toWei("-1"))
			.mul(await perpHedgingReactor.healthFactor())
			.div(10000)
			.div(USDC_SCALE)
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorUsdcBalanceAfter = await usdcContract.balanceOf(perpHedgingReactor.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(reactorCollatBalanceAfter).to.eq(collatRequired)
		expect(reactorUsdcBalanceAfter).to.eq(reactorUsdcBalanceBefore)
		expect(LpUsdcBalanceAfter.sub(LpUsdcBalanceBefore)).to.eq(
			reactorCollatBalanceBefore.sub(reactorCollatBalanceAfter)
		)
	})
	it("update fixes balances other way", async () => {
		const realSqrtPrice = await priceToSqrtPriceX96(2500, 6, 18)

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2500000000",
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = price
			.mul(reactorDeltaBefore)
			.div(toWei("-1"))
			.mul(await perpHedgingReactor.healthFactor())
			.div(10000)
			.div(USDC_SCALE)
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorUsdcBalanceAfter = await usdcContract.balanceOf(perpHedgingReactor.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(reactorCollatBalanceAfter).to.eq(collatRequired)
		expect(reactorUsdcBalanceAfter).to.eq(reactorUsdcBalanceBefore)
		expect(LpUsdcBalanceAfter.sub(LpUsdcBalanceBefore)).to.eq(
			reactorCollatBalanceBefore.sub(reactorCollatBalanceAfter)
		)
	})
	it("update returns 0", async () => {
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = price
			.mul(reactorDeltaBefore)
			.div(toWei("-1"))
			.mul(await perpHedgingReactor.healthFactor())
			.div(10000)
			.div(USDC_SCALE)
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorUsdcBalanceAfter = await usdcContract.balanceOf(perpHedgingReactor.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(reactorCollatBalanceAfter).to.eq(collatRequired)
		expect(reactorUsdcBalanceAfter).to.eq(reactorUsdcBalanceBefore)
		expect(LpUsdcBalanceAfter.sub(LpUsdcBalanceBefore)).to.eq(
			reactorCollatBalanceBefore.sub(collatRequired)
		)
	})
	it("update reverts when not called by keeper", async () => {
		await expect(perpHedgingReactor.connect(signers[2]).update()).to.be.revertedWith("NotKeeper()")
	})
	it("liquidates all positions and withdraws", async () => {
		// If withdraw amount is greater than the value of assets in the reactor, it should liquidate everything and send all to the LP
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		await liquidityPoolDummy.hedgeDelta(reactorDeltaBefore)
		const withdrawAmount = "100000000"
		const tx = await liquidityPoolDummy.withdraw(ethers.utils.parseUnits(withdrawAmount, 18))

		await tx.wait()
		const reactorCollatBalanceAfter = (
			await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId)
		)[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(
			0,
			truncate(vTokenAddress)
		)
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorUsdcBalanceAfter = await usdcContract.balanceOf(perpHedgingReactor.address)
		expect(LpUsdcBalanceAfter).to.be.above(LpUsdcBalanceBefore)
		expect(reactorDeltaAfter).to.equal(0)
		expect(reactorWethBalanceAfter).to.equal(0)
		expect(reactorCollatBalanceAfter).to.equal(1)
		expect(reactorUsdcBalanceAfter).to.equal(0)
	})

	it("updates healthFactor", async () => {
		const tx = await perpHedgingReactor.setHealthFactor(15000)
		let healthFactor = await perpHedgingReactor.healthFactor()
		expect(healthFactor).to.equal(15000)
	})

	it("update health factor reverts if not owner", async () => {
		await expect(perpHedgingReactor.connect(signers[1]).setHealthFactor(10000)).to.be.reverted
		let healthFactor = await perpHedgingReactor.healthFactor()
		expect(healthFactor).to.equal(15000)
	})

	it("withdraw reverts if not called form liquidity pool", async () => {
		await expect(perpHedgingReactor.withdraw(100000000000)).to.be.revertedWith("!vault")
	})

	it("hedgeDelta reverts if not called from liquidity pool", async () => {
		await expect(perpHedgingReactor.hedgeDelta(ethers.utils.parseEther("-10"))).to.be.revertedWith(
			"!vault"
		)
	})
})
