import hre, { ethers, network } from "hardhat"
import { Signer, BigNumber, BigNumberish } from "ethers"
import { expect } from "chai"
import { truncate } from "@ragetrade/sdk"
import {
	parseTokenAmount, toUSDC, toWei,
} from "../utils/conversion-helper"
import { MintableERC20 } from "../types/MintableERC20"
import { PerpHedgingReactor } from "../types/PerpHedgingReactor"
import { RageTradeFactory } from "../types/RageTradeFactory"
import { PerpHedgingTest } from "../types/PerpHedgingTest"
import {deployRage, deployRangeOrder} from "../utils/rage-deployer"
//@ts-ignore
import { IUniswapV3Pool } from "../artifacts/@uniswap/v3-core-0.8-support/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import { ClearingHouse } from "../types/ClearingHouse"
import {OracleMock} from "../types/OracleMock"
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER } from "./constants"
import { PriceFeed } from "../types/PriceFeed"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import { priceToSqrtPriceX96, sqrtPriceX96ToPrice, sqrtPriceX96ToTick } from '../utils/price-tick';
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { ClearingHouseLens } from "../types/ClearingHouseLens"

let signers: Signer[]
let usdcWhale: Signer
let clearingHouse: ClearingHouse
let poolId: string
let settlementTokenOracle: OracleMock
let collateralId: string
let liquidityPoolDummy: PerpHedgingTest
let liquidityPoolDummyAddress: string
let perpHedgingReactor: PerpHedgingReactor
let usdcContract: MintableERC20
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
let vTokenAddress : string
let vQuoteAddress : string
let rageOracle : OracleMock
let clearingHouseLens: ClearingHouseLens
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const UNISWAP_V3_DEFAULT_FEE_TIER = 500;
// edit depending on the chain id to be tested on
const chainId = 1
const USDC_SCALE = '1000000000000'
const e18 = '1000000000000000000'

describe("PerpHedgingReactor Sc2", () => {
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
	let authority: string
	it("#deploy price feed", async () => {
		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)
		const authorityFactory = await hre.ethers.getContractFactory("Authority")
		const senderAddress = await signers[0].getAddress()
		authority = (await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)).address
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy(authority)) as PriceFeed
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
		clearingHouseLens = rageParams.clearingHouseLens
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
			priceFeed.address,
			authority
		)) as PerpHedgingReactor

		expect(perpHedgingReactor).to.have.property("hedgeDelta")
	})

	it('#deploy range order', async () => {
		await deployRangeOrder(signers, clearingHouse, usdcContract, collateralId, vTokenAddress, vQuoteAddress)
	  });
	it("sets reactor address on LP contract", async () => {
		const reactorAddress = perpHedgingReactor.address

		await liquidityPoolDummy.setHedgingReactorAddress(reactorAddress)
		perpHedgingReactor.setKeeper(liquidityPoolDummy.address, true)
		expect(await liquidityPoolDummy.perpHedgingReactor()).to.equal(reactorAddress)
	})
	it("initialises the reactor", async () => {
		await usdcContract.approve(perpHedgingReactor.address, 1)
		await perpHedgingReactor.initialiseReactor()
		await expect(perpHedgingReactor.initialiseReactor()).to.be.reverted
	})

	it("hedges a negative delta when position is zero", async () => {
		const delta = ethers.utils.parseEther("-20")
		const deltaHedge = ethers.utils.parseEther("20")

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
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		expect(reactorWethBalanceBefore).to.equal(0)
		const collatRequired = -((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE).add(1)
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		await liquidityPoolDummy.hedgeDelta(delta)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(deltaHedge).to.equal(reactorDeltaAfter)
		expect(reactorWethBalanceBefore.add(deltaHedge)).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter.add(collatRequired))
		expect(reactorCollatBalanceAfter).to.eq(reactorCollatBalanceBefore.add(collatRequired))
	})
	it("hedges more negative delta", async () => {
		const delta = ethers.utils.parseEther("-0.5")
		const deltaHedge =  ethers.utils.parseEther("0.5")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const realSqrtPrice = await priceToSqrtPriceX96(2800, 6, 18);
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2800000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(deltaHedge.add(reactorDeltaBefore)).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(delta)
		await hedgeDeltaTx.wait()
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore.sub(delta))
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore.sub(delta))
		expect(LpUsdcBalanceBefore.sub(LpUsdcBalanceAfter)).to.equal(reactorCollatBalanceAfter.sub(reactorCollatBalanceBefore)).to.equal(collatRequired.sub(reactorCollatBalanceBefore))
	})
	it("hedges a positive delta", async () => {
		const delta = ethers.utils.parseEther("0.5")
		const deltaHedge = ethers.utils.parseEther("-0.5")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const realSqrtPrice = await priceToSqrtPriceX96(2900, 6, 18);
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2900000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(deltaHedge.add(reactorDeltaBefore)).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(delta)
		await hedgeDeltaTx.wait()
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore.sub(delta))
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore.sub(delta))
		expect(LpUsdcBalanceBefore.sub(LpUsdcBalanceAfter)).to.equal(reactorCollatBalanceAfter.sub(reactorCollatBalanceBefore)).to.equal(collatRequired.sub(reactorCollatBalanceBefore))
	})
	it("syncs profits", async () => {
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const hedgeDeltaTx = await liquidityPoolDummy.syncAndUpdate()
		await hedgeDeltaTx.wait()
		const profit = await clearingHouse.getAccountNetProfit(0)
		expect(profit).to.equal(0)
	})
	it("getDelta returns correct value", async () => {
		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		expect(reactorDelta).to.equal(20)
	})
	it("gets the portfolio value", async () => {
		const usdBalance = await usdcContract.balanceOf(perpHedgingReactor.address)
		const netProfit = await clearingHouse.getAccountNetProfit(0)
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const collat =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const val = (await perpHedgingReactor.getPoolDenominatedValue()).div(USDC_SCALE)
		expect(usdBalance.add(netProfit).add(collat)).to.eq(val)
	})
	it("hedges a negative delta with sufficient funds", async () => {
		const delta = ethers.utils.parseEther("-0.3")
		const deltaHedge = ethers.utils.parseEther("0.3")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const realSqrtPrice = await priceToSqrtPriceX96(3000, 6, 18);
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"3000000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(deltaHedge.add(reactorDeltaBefore)).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(delta)
		await hedgeDeltaTx.wait()
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore.sub(delta))
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore.sub(delta))
		expect(LpUsdcBalanceBefore.sub(LpUsdcBalanceAfter)).to.equal(reactorCollatBalanceAfter.sub(reactorCollatBalanceBefore)).to.equal(collatRequired.sub(reactorCollatBalanceBefore))
	})
	it("hedges a negative delta with insufficient funds", async () => {
		// attempts to hedge a very large amount should fail
		const delta = ethers.utils.parseEther("-380")
		await expect((liquidityPoolDummy.hedgeDelta(delta))).to.be.revertedWith('ERC20: transfer amount exceeds balance')

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
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const realSqrtPrice = await priceToSqrtPriceX96(3100, 6, 18);
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"3100000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const withdrawAmount = "10000"
		const newCollat = reactorCollatBalanceBefore.sub(toUSDC(withdrawAmount))
		const expectedDelta = newCollat.mul(10000).mul(e18).div((await perpHedgingReactor.healthFactor()).mul(price.div(USDC_SCALE)));
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		// withdraw more than current balance
		await liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18)
		)
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorWethBalanceAfter = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorDeltaAfter = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(reactorDeltaAfter).to.equal(reactorDeltaBefore)
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
		expect(reactorCollatBalanceBefore).to.eq(reactorCollatBalanceAfter)
	})

	it("update fixes balances one way", async () => {
		const realSqrtPrice = await priceToSqrtPriceX96(2600, 6, 18);

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2600000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
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
		const realSqrtPrice = await priceToSqrtPriceX96(2400, 6, 18);

		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			"2400000000",
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await rageOracle.setSqrtPriceX96(realSqrtPrice);
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
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
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		const tx = await liquidityPoolDummy.update()
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
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

	it("liquidates all positions and withdraws", async () => {
		// If withdraw amount is greater than the value of assets in the reactor, it should liquidate everything and send all to the LP
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const accountId = await perpHedgingReactor.accountId()
		const collateralId = await perpHedgingReactor.collateralId()
		const reactorCollatBalanceBefore =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		await liquidityPoolDummy.hedgeDelta(reactorDeltaBefore)
		const withdrawAmount = "100000000" //100 million
		const tx = await liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18)
		)

		await tx.wait()
		const reactorCollatBalanceAfter =  (await clearingHouseLens.getAccountCollateralInfo(accountId, collateralId))[1]
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
})
