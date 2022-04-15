import hre, { ethers, network } from "hardhat"
import { Signer, BigNumber, BigNumberish } from "ethers"
import { expect } from "chai"
import { truncate } from "@ragetrade/sdk"
import {
	parseTokenAmount, toUSDC, toWei,
} from "../utils/conversion-helper"
import {deployRage, deployRangeOrder} from "../utils/rage-deployer"
import { MintableERC20 } from "../types/MintableERC20"
import { PerpHedgingReactor } from "../types/PerpHedgingReactor"
import { RageTradeFactory } from "../types/RageTradeFactory"
import { PerpHedgingTest } from "../types/PerpHedgingTest"
//@ts-ignore
import { IUniswapV3Pool } from "../artifacts/@uniswap/v3-core-0.8-support/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import { ClearingHouse } from "../types/ClearingHouse"
import {OracleMock} from "../types/OracleMock"
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER } from "./constants"
import { PriceFeed } from "../types/PriceFeed"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import { priceToSqrtPriceX96, sqrtPriceX96ToPrice, sqrtPriceX96ToTick } from '../utils/price-tick';
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"

let signers: Signer[]
let usdcWhale: Signer
let liquidityPoolDummy: PerpHedgingTest
let liquidityPoolDummyAddress: string
let usdcContract: MintableERC20
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
let perpHedgingReactor: PerpHedgingReactor
let vTokenAddress : string
let vQuoteAddress : string
let rageOracle : OracleMock
let clearingHouse: ClearingHouse
let poolId: string
let settlementTokenOracle: OracleMock
let collateralId: string
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const UNISWAP_V3_DEFAULT_FEE_TIER = 500;
// edit depending on the chain id to be tested on
const chainId = 1
const USDC_SCALE = '1000000000000'
const e18 = '1000000000000000000'

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
		usdcContract = (await ethers.getContractAt("contracts/tokens/ERC20.sol:ERC20", USDC_ADDRESS[chainId])) as MintableERC20

		await usdcContract
			.connect(usdcWhale)
			.transfer(liquidityPoolDummyAddress, (ethers.utils.parseUnits("1000000", 6)))
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
	it("#deploy price feed", async () => {
		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)

		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
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
		settlementTokenOracle = rageParams.settlementTokenOracle
	})
	it("#deploys the hedging reactor", async () => {
		const perpHedgingReactorFactory = await ethers.getContractFactory(
			"PerpHedgingReactor",
			{
				signer: signers[0]
			}
		)
		perpHedgingReactor = (await perpHedgingReactorFactory.deploy(
			clearingHouse.address,
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			liquidityPoolDummyAddress,
			poolId,
			collateralId,
			priceFeed.address
		)) as PerpHedgingReactor

		expect(perpHedgingReactor).to.have.property("hedgeDelta")
		const minAmount = await perpHedgingReactor.minAmount()
		expect(minAmount).to.equal(ethers.utils.parseUnits("1", 16))
	})

	it('#deploy range order', async () => {
		await deployRangeOrder(signers, clearingHouse, usdcContract, collateralId, vTokenAddress, vQuoteAddress)
	  });
	it("sets reactor address on LP contract", async () => {
		const reactorAddress = perpHedgingReactor.address

		await liquidityPoolDummy.setHedgingReactorAddress(reactorAddress)
		perpHedgingReactor.setKeeper(liquidityPoolDummy.address)
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
	it("reverts withdrawal if not initialised", async () => {
		const withdrawAmount = "1000"
		await expect(liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18),
			usdcContract.address
		)).to.be.revertedWith("IncorrectCollateral()")
	})
	it("initialises the reactor", async () => {
		await usdcContract.approve(perpHedgingReactor.address, 1)
		await perpHedgingReactor.initialiseReactor()
		await expect(perpHedgingReactor.initialiseReactor()).to.be.reverted
	})

	it("updates minAmount parameter", async () => {
		await perpHedgingReactor.setMinAmount(1e10)
		const minAmount = await perpHedgingReactor.minAmount()
		expect(minAmount).to.equal(ethers.utils.parseUnits("1", 10))
	})

	it("hedges a positive delta when position is zero", async () => {
		const delta = ethers.utils.parseEther("20")
		const deltaHedge = ethers.utils.parseEther("-20")

		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const realSqrtPrice = await priceToSqrtPriceX96(2500, 6, 18);

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2500000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		expect(reactorWethBalanceBefore).to.equal(0)
		const collatRequired = ((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE).sub(1)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		await liquidityPoolDummy.hedgeDelta(delta)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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

		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const collatRequired = ((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE).add(1)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		await liquidityPoolDummy.hedgeDelta(delta)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(reactorDeltaAfter).to.equal(0)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore.add(deltaHedge))
		expect(reactorWethBalanceBefore.add(deltaHedge)).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore.sub(LpUsdcBalanceAfter.add(collatRequired))).to.be.within(0, 1000000000)
		expect(reactorCollatBalanceAfter).to.eq(reactorCollatBalanceBefore.add(collatRequired))
	})

	it("hedges a positive delta when position is zero again", async () => {
		const delta = ethers.utils.parseEther("20")
		const deltaHedge = ethers.utils.parseEther("-20")

		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const collatRequired = ((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE).sub(1)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		await liquidityPoolDummy.hedgeDelta(delta)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(deltaHedge).to.equal(reactorDeltaAfter)
		expect(reactorWethBalanceBefore.add(deltaHedge)).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter.add(collatRequired))
		expect(reactorCollatBalanceAfter).to.eq(reactorCollatBalanceBefore.add(collatRequired))
	})
	it("syncs profits", async () => {
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const hedgeDeltaTx = await liquidityPoolDummy.syncAndUpdate()
		await hedgeDeltaTx.wait()
		const profit = await clearingHouse.getAccountNetProfit(0)
		expect(profit).to.equal(0)
	})
	it("hedges a negative delta", async () => {
		const delta = ethers.utils.parseEther("-0.5")
		const deltaHedge = ethers.utils.parseEther("0.5")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(delta)
		await hedgeDeltaTx.wait()
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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
		const reactorCollatBalance =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const val = (await perpHedgingReactor.getPoolDenominatedValue()).div(USDC_SCALE)
		expect(usdBalance.add(netProfit).add(reactorCollatBalance)).to.eq(val)
	})
	it("hedges a positive delta with sufficient funds", async () => {
		const delta = ethers.utils.parseEther("0.3")
		const deltaHedge = ethers.utils.parseEther("-0.3")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(delta)
		await hedgeDeltaTx.wait()
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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
		const delta = ethers.utils.parseEther("380")
		await expect((liquidityPoolDummy.hedgeDelta(delta))).to.be.revertedWith('ERC20: transfer amount exceeds balance')

	})
	it("reverts withdrawal if incorrect token input", async () => {
		const withdrawAmount = "1000"
		await expect(liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18),
			ZERO_ADDRESS
		)).to.be.revertedWith("IncorrectCollateral()")
	})
	it("liquidates usdc held position", async () => {
		const withdrawAmount = "1000"
		await usdcContract
		.connect(usdcWhale)
		.transfer(perpHedgingReactor.address, (ethers.utils.parseUnits(withdrawAmount, 6)))
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		// withdraw more than current balance
		await liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18),
			usdcContract.address
		)
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
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
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const hedgeDeltaTx = await liquidityPoolDummy.syncAndUpdate()
		await hedgeDeltaTx.wait()
		const profit = await clearingHouse.getAccountNetProfit(0)
		expect(profit).to.equal(0)
	})
	it("liquidates a bit of position and withdraws sufficient funds", async () => {
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const withdrawAmount = "1000"
		const newCollat = reactorCollatBalanceBefore.sub(toUSDC(withdrawAmount))
		const expectedDelta = (newCollat.mul(-10000).mul(e18).div((await perpHedgingReactor.healthFactor()).mul(price.div(USDC_SCALE))));
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		// withdraw more than current balance
		await liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18),
			usdcContract.address
		)
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		
		expect(reactorDeltaAfter).to.equal(expectedDelta)
		expect(reactorWethBalanceAfter).to.equal(expectedDelta)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter.sub(toUSDC(withdrawAmount)))
		expect(newCollat).to.eq(reactorCollatBalanceAfter)
	})
	it("update fixes balances one way", async () => {
		const realSqrtPrice = await priceToSqrtPriceX96(2510, 6, 18);

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2510000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('-1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorUsdcBalanceAfter = await usdcContract.balanceOf(perpHedgingReactor.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(reactorCollatBalanceAfter).to.eq(collatRequired)
		expect(reactorUsdcBalanceAfter).to.eq(reactorUsdcBalanceBefore)
		expect(LpUsdcBalanceAfter.sub(LpUsdcBalanceBefore)).to.eq((reactorCollatBalanceBefore.sub(reactorCollatBalanceAfter)))
	})
	it("update fixes balances other way", async () => {
		const realSqrtPrice = await priceToSqrtPriceX96(2500, 6, 18);

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2500000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('-1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorUsdcBalanceAfter = await usdcContract.balanceOf(perpHedgingReactor.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(reactorCollatBalanceAfter).to.eq(collatRequired)
		expect(reactorUsdcBalanceAfter).to.eq(reactorUsdcBalanceBefore)
		expect(LpUsdcBalanceAfter.sub(LpUsdcBalanceBefore)).to.eq((reactorCollatBalanceBefore.sub(reactorCollatBalanceAfter)))
	})
	it("update returns 0", async () => {
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('-1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorUsdcBalanceAfter = await usdcContract.balanceOf(perpHedgingReactor.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(reactorCollatBalanceAfter).to.eq(collatRequired)
		expect(reactorUsdcBalanceAfter).to.eq(reactorUsdcBalanceBefore)
		expect(LpUsdcBalanceAfter.sub(LpUsdcBalanceBefore)).to.eq(reactorCollatBalanceBefore.sub(collatRequired))
	})
	it("update reverts when not called by keeper", async () => {
		await expect(perpHedgingReactor.update()).to.be.revertedWith("InvalidSender()")
	})
	it("liquidates all positions and withdraws", async () => {
		// If withdraw amount is greater than the value of assets in the reactor, it should liquidate everything and send all to the LP
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		
		const withdrawAmount = "100000000" 
		const tx = await liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18),
			usdcContract.address
		)

		await tx.wait()
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
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
		let healthFactor = await perpHedgingReactor.healthFactor()
		expect(healthFactor).to.equal(12000)
		const tx = await perpHedgingReactor.setHealthFactor(15000)
		healthFactor = await perpHedgingReactor.healthFactor()
		expect(healthFactor).to.equal(15000)
	})

	it("update health factor reverts if not owner", async () => {
		await expect(perpHedgingReactor.connect(signers[1]).setHealthFactor(10000)).to.be.reverted
		let healthFactor = await perpHedgingReactor.healthFactor()
		expect(healthFactor).to.equal(15000)
	})

	it("update health factor fails if too low", async () => {
		await expect(perpHedgingReactor.setHealthFactor(9999)).to.be.revertedWith("InvalidHealthFactor()")
		let healthFactor = await perpHedgingReactor.healthFactor()
		expect(healthFactor).to.equal(15000)
	})

	it("withdraw reverts if not called form liquidity pool", async () => {
		await expect(
			perpHedgingReactor.withdraw(100000000000, usdcContract.address)
		).to.be.revertedWith("!vault")
	})

	it("hedgeDelta reverts if not called from liquidity pool", async () => {
		await expect(
			perpHedgingReactor.hedgeDelta(ethers.utils.parseEther("-10"))
		).to.be.revertedWith("!vault")
	})
})
