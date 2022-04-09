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
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const UNISWAP_V3_DEFAULT_FEE_TIER = 500;
// edit depending on the chain id to be tested on
const chainId = 1
const USDC_SCALE = '1000000000000'
const e18 = '1000000000000000000'

async function initializePool(
    rageTradeFactory: RageTradeFactory,
    initialMarginRatioBps: BigNumberish,
    maintainanceMarginRatioBps: BigNumberish,
    twapDuration: BigNumberish,
    initialPrice: BigNumberish,
  ) {
    const realToken = await hre.ethers.getContractAt('MintableERC20', WETH_ADDRESS[chainId]);

    const oracleFactory = await hre.ethers.getContractFactory('OracleMock');
    const oracle = await oracleFactory.deploy();
    await oracle.setSqrtPriceX96(initialPrice);

    await rageTradeFactory.initializePool({
      deployVTokenParams: {
        vTokenName: 'vWETH',
        vTokenSymbol: 'vWETH',
        cTokenDecimals: 18,
      },
      poolInitialSettings: {
        initialMarginRatioBps,
        maintainanceMarginRatioBps,
        maxVirtualPriceDeviationRatioBps: 10000,
        twapDuration,
        isAllowedForTrade: true,
        isCrossMargined: false,
        oracle: oracle.address,
      },
      liquidityFeePips: 500,
      protocolFeePips: 500,
      slotsToInitialize: 100,
    });

    const eventFilter = rageTradeFactory.filters.PoolInitialized();
    const events = await rageTradeFactory.queryFilter(eventFilter, 'latest');
    const vPool = events[0].args[0];
    const vTokenAddress = events[0].args[1];
    const vPoolWrapper = events[0].args[2];

    return { vTokenAddress, realToken, oracle, vPool };
  }
async function updateRangeOrder(
    user: Signer,
    userAccountNo: BigNumberish,
    tokenAddress: string,
    tickLower: BigNumberish,
    tickUpper: BigNumberish,
    liquidityDelta: BigNumberish,
    closeTokenPosition: boolean,
    limitOrderType: number,
  ) {
    const truncatedAddress = truncate(tokenAddress);

    let liquidityChangeParams = {
      tickLower: tickLower,
      tickUpper: tickUpper,
      liquidityDelta: liquidityDelta,
      sqrtPriceCurrent: 0,
      slippageToleranceBps: 0,
      closeTokenPosition: closeTokenPosition,
      limitOrderType: limitOrderType,
	  settleProfit: false
    };

    await clearingHouse.connect(user).updateRangeOrder(userAccountNo, truncatedAddress, liquidityChangeParams);
  }
  async function updateRangeOrderAndCheck(
    user: Signer,
    userAccountNo: BigNumberish,
    tokenAddress: string,
    vQuoteAddress: string,
    tickLower: BigNumberish,
    tickUpper: BigNumberish,
    liquidityDelta: BigNumberish,
    closeTokenPosition: boolean,
    limitOrderType: number,
    liquidityPositionNum: BigNumberish,
    expectedEndLiquidityPositionNum: BigNumberish,
    expectedEndVTokenBalance: BigNumberish,
    expectedEndVQuoteBalance: BigNumberish,
    checkApproximateVTokenBalance: Boolean,
    expectedSumALast?: BigNumberish,
    expectedSumBLast?: BigNumberish,
    expectedSumFpLast?: BigNumberish,
    expectedSumFeeLast?: BigNumberish,
  ) {
    await updateRangeOrder(
      user,
      userAccountNo,
      tokenAddress,
      tickLower,
      tickUpper,
      liquidityDelta,
      closeTokenPosition,
      limitOrderType,
    );
  }
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
	let vTokenAddress : string
	let vQuoteAddress : string
	let rageOracle : OracleMock
	it("#deploys rage", async () => {
		let accountLib = (await (await hre.ethers.getContractFactory('Account')).deploy());
		const clearingHouseLogic = await (
		  await hre.ethers.getContractFactory('ClearingHouse', {
			libraries: {
			  Account: accountLib.address,
			},
		  })
		).deploy();
		let vPoolWrapperLogic = await (await hre.ethers.getContractFactory('VPoolWrapper')).deploy();
		const insuranceFundLogic = await (await hre.ethers.getContractFactory('InsuranceFund')).deploy();
	
		const rageTradeFactory = await (
		  await hre.ethers.getContractFactory('RageTradeFactory')
		).deploy(
		  clearingHouseLogic.address,
		  vPoolWrapperLogic.address,
		  insuranceFundLogic.address,
		  USDC_ADDRESS[chainId],
		) as RageTradeFactory
	
		clearingHouse = await hre.ethers.getContractAt('ClearingHouse', await rageTradeFactory.clearingHouse()) as ClearingHouse;
	
		const insuranceFund = await hre.ethers.getContractAt('InsuranceFund', await clearingHouse.insuranceFund());
	
		const vQuote = await hre.ethers.getContractAt('VQuote', await rageTradeFactory.vQuote());
		vQuoteAddress = vQuote.address;
	
		// await vQuote.transferOwnership(VPoolFactory.address);
		// const realTokenFactory = await hre.ethers.getContractFactory('RealTokenMock');
		// realToken = await realTokenFactory.deploy();
	
		let out = await initializePool(
		  rageTradeFactory,
		  2000,
		  1000,
		  1,
		  await priceToSqrtPriceX96(2000, 6, 18),
		  // .div(60 * 10 ** 6),
		);
	
		vTokenAddress = out.vTokenAddress;
		rageOracle = out.oracle as OracleMock;
		const realToken = out.realToken;
		const vPool = (await hre.ethers.getContractAt(
		  '@uniswap/v3-core-0.8-support/contracts/interfaces/IUniswapV3Pool.sol:IUniswapV3Pool',
		  out.vPool,
		)) as IUniswapV3Pool;

		settlementTokenOracle = await (await hre.ethers.getContractFactory('OracleMock')).deploy() as OracleMock;
		await clearingHouse.updateCollateralSettings(USDC_ADDRESS[chainId], {
		  oracle: settlementTokenOracle.address,
		  twapDuration: 300,
		  isAllowedForDeposit: true,
		});
	  const liquidationParams = {
        rangeLiquidationFeeFraction: 1500,
        tokenLiquidationFeeFraction: 3000,
        insuranceFundFeeShareBps: 5000,
        maxRangeLiquidationFees: 100000000,
        closeFactorMMThresholdBps: 7500,
        partialLiquidationCloseFactorBps: 5000,
        liquidationSlippageSqrtToleranceBps: 150,
        minNotionalLiquidatable: 100000000,
      };

      const removeLimitOrderFee = parseTokenAmount(10, 6);
      const minimumOrderNotional = parseTokenAmount(1, 6).div(100);
      const minRequiredMargin = parseTokenAmount(20, 6);

      await clearingHouse.updateProtocolSettings(
        liquidationParams,
        removeLimitOrderFee,
        minimumOrderNotional,
        minRequiredMargin,
      );
	  poolId = truncate(vTokenAddress)
	  collateralId = truncate(USDC_ADDRESS[chainId])
	})
	it("deploys the hedging reactor", async () => {
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

	it('Acct[0] Adds Liq b/w ticks (-200820 to -199360) @ tickCurrent = -199590', async () => {
		const user0 = signers[1]
		await clearingHouse.connect(user0).createAccount();
		const user0AccountNo = 1;
		await usdcContract.connect(user0).approve(clearingHouse.address, parseTokenAmount(10 ** 5, 6))
		await clearingHouse.connect(user0).updateMargin(user0AccountNo, collateralId, parseTokenAmount(10 ** 5, 6))
		const tickLower = -200820;
		const tickUpper = -199360;
		const liquidityDelta = "75407230733517400";
		const limitOrderType = 0;
		const expectedVTokenBalance = "-18595999999997900000";
		const expectedVQuoteBalance = '-208523902880';
  
		const expectedSumALast = 0;
		const expectedSumBLast = 0;
		const expectedSumFpLast = 0;
		const expectedSumFeeLast = 0;
  
		await updateRangeOrderAndCheck(
		  user0,
		  user0AccountNo,
		  vTokenAddress,
		  vQuoteAddress,
		  tickLower,
		  tickUpper,
		  liquidityDelta,
		  false,
		  limitOrderType,
		  0,
		  1,
		  expectedVTokenBalance,
		  expectedVQuoteBalance,
		  true,
		  expectedSumALast,
		  expectedSumBLast,
		  expectedSumFpLast,
		  expectedSumFeeLast,
		);
	  });
	it("sets reactor address on LP contract", async () => {
		const reactorAddress = perpHedgingReactor.address

		await liquidityPoolDummy.setHedgingReactorAddress(reactorAddress)
		perpHedgingReactor.setKeeper(liquidityPoolDummy.address)
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
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		expect(reactorWethBalanceBefore).to.equal(0)
		const collatRequired = -((price.mul(delta).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE).add(1)
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
	it("hedges more negative delta", async () => {
		const delta = ethers.utils.parseEther("-0.5")
		const deltaHedge =  ethers.utils.parseEther("0.5")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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
		console.log(reactorDeltaBefore)
		const collatRequired = ((price.mul(deltaHedge.add(reactorDeltaBefore)).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
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
		expect(LpUsdcBalanceBefore.sub(LpUsdcBalanceAfter)).to.equal(reactorCollatBalanceAfter.sub(reactorCollatBalanceBefore)).to.equal(collatRequired.sub(reactorCollatBalanceBefore))
	})
	it("hedges a positive delta", async () => {
		const delta = ethers.utils.parseEther("0.5")
		const deltaHedge = ethers.utils.parseEther("-0.5")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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
		const reactorCollatBalance =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const val = await perpHedgingReactor.getPoolDenominatedValue()
		expect(usdBalance.add(netProfit).add(reactorCollatBalance)).to.eq(val)
	})
	it("hedges a negative delta with sufficient funds", async () => {
		const delta = ethers.utils.parseEther("-0.3")
		const deltaHedge = ethers.utils.parseEther("0.3")
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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
		const reactorCollatBalanceAfter =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
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
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE)
		console.log(await clearingHouse.getAccountMarketValueAndRequiredMargin(0, true))
		console.log(await clearingHouse.getAccountNetProfit(0))
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
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const reactorUsdcBalanceBefore = await usdcContract.balanceOf(perpHedgingReactor.address)
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE).sub(1)
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
		const collatRequired = ((price.mul(reactorDeltaBefore).div(toWei('1'))).mul(await perpHedgingReactor.healthFactor()).div(10000)).div(USDC_SCALE).sub(1)
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

	it("liquidates all positions and withdraws", async () => {
		// If withdraw amount is greater than the value of assets in the reactor, it should liquidate everything and send all to the LP
		const reactorDeltaBefore = await liquidityPoolDummy.getDelta()
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const reactorWethBalanceBefore = await clearingHouse.getAccountNetTokenPosition(0, truncate(vTokenAddress))
		const reactorCollatBalanceBefore =  (await clearingHouse.getAccountInfo(0)).collateralDeposits[0].balance
		const price = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		
		const withdrawAmount = "100000000" //100 million
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
})
