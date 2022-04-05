import hre, { ethers, network } from "hardhat"
import { Signer, BigNumber, BigNumberish } from "ethers"
import { expect } from "chai"
import { truncate } from "@ragetrade/sdk"
import {
	parseTokenAmount,
} from "../utils/conversion-helper"
import { MintableERC20 } from "../types/MintableERC20"
import { PerpHedgingReactor } from "../types/PerpHedgingReactor"
import { RageTradeFactory } from "../types/RageTradeFactory"
import { PerpHedgingTest } from "../types/PerpHedgingTest"
//@ts-ignore
import { IUniswapV3Pool } from "../artifacts/@uniswap/v3-core-0.8-support/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import { ClearingHouse } from "../types/ClearingHouse"
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER } from "./constants"
import { PriceFeed } from "../types/PriceFeed"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import { priceToSqrtPriceX96, sqrtPriceX96ToTick } from '../utils/price-tick';
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
let signers: Signer[]
let usdcWhale: Signer
let clearingHouse: ClearingHouse
let usdcWhaleAddress: string
let poolId: string
let collateralId: string
let liquidityPoolDummy: PerpHedgingTest
let liquidityPoolDummyAddress: string
let perpHedgingReactor: PerpHedgingReactor
let usdcContract: MintableERC20
let wethContract: MintableERC20
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const UNISWAP_V3_DEFAULT_FEE_TIER = 500;
// edit depending on the chain id to be tested on
const chainId = 1

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
		usdcWhaleAddress = await usdcWhale.getAddress()
		usdcContract = (await ethers.getContractAt("contracts/tokens/ERC20.sol:ERC20", USDC_ADDRESS[chainId])) as MintableERC20

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

		expect(LPContractBalance).to.equal(1000000)
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
		rate = "2890000000"
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
		  await priceToSqrtPriceX96(4000, 6, 18),
		  // .div(60 * 10 ** 6),
		);
	
		vTokenAddress = out.vTokenAddress;
		const rageOracle = out.oracle;
		const realToken = out.realToken;
		const vPool = (await hre.ethers.getContractAt(
		  '@uniswap/v3-core-0.8-support/contracts/interfaces/IUniswapV3Pool.sol:IUniswapV3Pool',
		  out.vPool,
		)) as IUniswapV3Pool;
		
	
		// console.log('### Is VToken 0 ? ###');
		// console.log(BigNumber.from(vTokenAddress).lt(vQuoteAddress));
		// console.log(vTokenAddress);
		// console.log(vQuoteAddress);
		// console.log('###VQuote decimals ###');
		// console.log(await vQuote.decimals());
	
		// constants = await VPoolFactory.constants();
		const settlementTokenOracle = await (await hre.ethers.getContractFactory('OracleMock')).deploy();
	
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
		await usdcContract.approve(perpHedgingReactor.address, 1)
		await perpHedgingReactor.initialiseReactor()
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
	it("updates minAmount parameter", async () => {
		await perpHedgingReactor.setMinAmount(1e10)
		const minAmount = await perpHedgingReactor.minAmount()
		expect(minAmount).to.equal(ethers.utils.parseUnits("1", 10))
	})

	it("sets reactor address on LP contract", async () => {
		const reactorAddress = perpHedgingReactor.address

		await liquidityPoolDummy.setHedgingReactorAddress(reactorAddress)
		perpHedgingReactor.setKeeper(liquidityPoolDummy.address)
		expect(await liquidityPoolDummy.perpHedgingReactor()).to.equal(reactorAddress)
	})

	it("changes nothing if no ETH balance and hedging positive delta", async () => {
		wethContract = (await ethers.getContractAt("contracts/tokens/ERC20.sol:ERC20", WETH_ADDRESS[chainId])) as MintableERC20
		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)

		expect(reactorWethBalanceBefore).to.equal(0)

		const reactorDeltaBefore = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		
		await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("20"))

		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)
		const reactorDeltaAfter = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		expect(reactorDeltaBefore).to.equal(reactorDeltaAfter)
		expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
	})

	it("hedges a negative delta", async () => {
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("-0.5"))
		await hedgeDeltaTx.wait()
		const reactorWethBalance = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)

		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		expect(reactorDelta).to.equal(0.5)
		expect(reactorWethBalance).to.equal(0.5)
		expect(LpUsdcBalanceBefore).to.be.above(LpUsdcBalanceAfter)
	})
	it("getDelta returns correct value", async () => {
		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		expect(reactorDelta).to.equal(0.5)
	})
	it("gets the portfolio value", async () => {
		const usdBalance = await usdcContract.balanceOf(perpHedgingReactor.address)
		const wethBalance = await wethContract.balanceOf(perpHedgingReactor.address)
		const val = await perpHedgingReactor.getPoolDenominatedValue()
		const usdValue = usdBalance.mul(1000000000000)
		const wethValue = wethBalance.mul(rate).div(1000000)
		expect(usdValue.add(wethValue)).to.eq(val)
	})
	it("hedges a positive delta with sufficient funds", async () => {
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("0.3"))
		await hedgeDeltaTx.wait()

		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const reactorWethBalance = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)

		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		// no funds being withdrawn to LP so balance should be unchanged
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
		expect(reactorDelta).to.equal(0.2)
		expect(reactorWethBalance).to.equal(0.2)
	})
	it("hedges a positive delta with insufficient funds", async () => {
		// has a balance of 5 wETH at this point
		// try to hedge another 15 delta
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("15"))

		await hedgeDeltaTx.wait()

		const reactorWethBalance = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)
		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
		expect(reactorWethBalance).to.equal(0)
		expect(reactorDelta).to.equal(0)
	})

	it("withdraws funds without liquidation", async () => {
		// give it ETH balance
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("-0.5"))
		await hedgeDeltaTx.wait()

		let reactorUsdcBalance = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(perpHedgingReactor.address)),
				6
			)
		)

		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)

		const reactorDeltaBefore = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)

		expect(reactorWethBalanceBefore).to.equal(0.5)

		const withdrawAmount = "500"
		expect(parseFloat(withdrawAmount)).to.be.below(reactorUsdcBalance)

		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const withdrawTx = await liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18),
			usdcContract.address
		)
		let reactorUsdcBalanceOld = reactorUsdcBalance
		reactorUsdcBalance = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(perpHedgingReactor.address)),
				6
			)
		)
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)
		const reactorDeltaAfter = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		// expect LP balance to go up by withdrawAmount
		expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.equal(parseFloat(withdrawAmount))
		// expect reactor balance to go down by withdrawAmount
		expect(reactorUsdcBalance.toFixed(6)).to.equal(
			(reactorUsdcBalanceOld - parseFloat(withdrawAmount)).toFixed(6)
		)
		// expect reactor wETH balance to be unchanged
		expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
		expect(reactorDeltaAfter).to.equal(reactorWethBalanceAfter)
		expect(reactorDeltaBefore).to.equal(reactorDeltaAfter)
	})

	it("liquidates WETH and withdraws sufficient funds", async () => {
		const reactorUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(perpHedgingReactor.address)),
				6
			)
		)
		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const withdrawAmount = "1000"

		expect(reactorWethBalanceBefore).to.equal(0.5)
		expect(parseFloat(withdrawAmount)).to.be.above(reactorUsdcBalanceBefore)
		// withdraw more than current balance
		await liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18),
			usdcContract.address
		)
		await liquidityPoolDummy.getDelta()
		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)
		const reactorUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(perpHedgingReactor.address)),
				6
			)
		)

		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)

		expect(reactorWethBalanceAfter).to.be.below(reactorWethBalanceBefore)
		expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.equal(parseFloat(withdrawAmount))
		expect(reactorUsdcBalanceAfter).to.equal(0)
		expect(reactorDelta).to.equal(reactorWethBalanceAfter)
	})

	it("liquidates all ETH and withdraws but does not have enough funds", async () => {
		// If withdraw amount is greater than the value of assets in the reactor, it should liquidate everything and send all to the LP
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)
		expect(reactorWethBalanceBefore).to.be.above(0)
		const withdrawAmount = "100000000" //100 million
		const tx = await liquidityPoolDummy.withdraw(
			ethers.utils.parseUnits(withdrawAmount, 18),
			usdcContract.address
		)

		await tx.wait()
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		const reactorUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(perpHedgingReactor.address)),
				6
			)
		)
		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)

		expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.be.below(parseFloat(withdrawAmount))
		expect(reactorWethBalanceAfter).to.equal(0)
		expect(reactorUsdcBalanceAfter).to.equal(0)
	})

	it("update changes no balances", async () => {
		const reactorUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(perpHedgingReactor.address)),
				6
			)
		)
		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const tx = await liquidityPoolDummy.update()
		const reactorUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(perpHedgingReactor.address)),
				6
			)
		)
		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(perpHedgingReactor.address))
			)
		)
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		expect(reactorUsdcBalanceBefore).to.equal(reactorUsdcBalanceAfter)
		expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
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
