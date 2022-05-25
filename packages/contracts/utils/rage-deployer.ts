import hre, { network } from "hardhat"
import ethers from "hardhat"
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
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER } from "../test/constants"
import { PriceFeed } from "../types/PriceFeed"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import { priceToSqrtPriceX96, sqrtPriceX96ToPrice, sqrtPriceX96ToTick } from '../utils/price-tick';
const chainId = 1
export async function initializePool(
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
export async function updateRangeOrder(
    user: Signer,
    userAccountNo: BigNumberish,
    tokenAddress: string,
    tickLower: BigNumberish,
    tickUpper: BigNumberish,
    liquidityDelta: BigNumberish,
    closeTokenPosition: boolean,
    limitOrderType: number,
    clearingHouse: ClearingHouse
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
  export async function updateRangeOrderAndCheck(
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
    clearingHouse: ClearingHouse,
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
      clearingHouse
    );
  }


    export async function deployRage() {
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
	
		const clearingHouse = await hre.ethers.getContractAt('ClearingHouse', await rageTradeFactory.clearingHouse()) as ClearingHouse;
	
		const insuranceFund = await hre.ethers.getContractAt('InsuranceFund', await clearingHouse.insuranceFund());
	
		const vQuote = await hre.ethers.getContractAt('VQuote', await rageTradeFactory.vQuote());
		const vQuoteAddress = vQuote.address;
	
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
	
		const vTokenAddress = out.vTokenAddress;
		const rageOracle = out.oracle as OracleMock;
		const realToken = out.realToken;
		const vPool = (await hre.ethers.getContractAt(
		  '@uniswap/v3-core-0.8-support/contracts/interfaces/IUniswapV3Pool.sol:IUniswapV3Pool',
		  out.vPool,
		)) as IUniswapV3Pool;

		const settlementTokenOracle = await (await hre.ethers.getContractFactory('OracleMock')).deploy() as OracleMock;
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
	  const poolId = truncate(vTokenAddress)
	  const collateralId = truncate(USDC_ADDRESS[chainId])
      return {
          clearingHouse: clearingHouse, 
          poolId: poolId, 
          collateralId: collateralId, 
          vQuoteAddress: vQuoteAddress, 
          vTokenAddress: vTokenAddress, 
          rageOracle: rageOracle, 
          settlementTokenOracle: settlementTokenOracle
        }
	}

	export async function deployRangeOrder(
        signers: Signer[],
        clearingHouse: ClearingHouse,
        usdcContract: MintableERC20,
        collateralId: string,
        vTokenAddress: string,
        vQuoteAddress: string,
    ) {
		const user0 = signers[0]
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
          clearingHouse
		);
	  }