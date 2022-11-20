// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { IUniswapV3MintCallback } from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import { PoolAddress } from "../vendor/uniswap/PoolAddress.sol";
import { LiquidityAmounts, FullMath } from "../vendor/uniswap/LiquidityAmounts.sol";
import "../vendor/uniswap/TickMath.sol";
import { IERC20, SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IHedgingReactor.sol";
import "../interfaces/ILiquidityPool.sol";
import "../libraries/AccessControl.sol";
import "hardhat/console.sol";
//import "../libraries/SafeTransferLib.sol";

contract UniswapV3RangeOrderReactor is IUniswapV3MintCallback, IHedgingReactor, AccessControl {

    using TickMath for int24;
    using SafeERC20 for IERC20;
    ///////////////////////////
	/// immutable variables ///
	///////////////////////////

	/// @notice address of the parent liquidity pool contract
	address public immutable parentLiquidityPool;
	/// @notice address of the price feed used for getting asset prices
	address public immutable priceFeed;
	/// @notice smaller address token using uniswap pool convention
    IERC20 public immutable token0;
	/// @notice larger address token using uniswap pool convention
    IERC20 public immutable token1;
	/// @notice instance of the uniswap V3 pool
    IUniswapV3Pool public pool;
    /// @notice generalised list of stablecoin addresses to trade against wETH
	address public immutable collateralAsset;
	/// @notice address of the wETH contract
	address public immutable wETH;
    /// @notice address of the uniswap V3 factory
    address public immutable factory;
	/// @notice uniswap v3 pool fee expressed at 10e6
	uint24 public immutable poolFee;
    /// @notice uniswap v3 pool lower tick spacing - set to 0 if no active range order
    int24 public activeLowerTick;
    /// @notice uniswap v3 pool upper tick spacing - set to 0 if no active range order
    int24 public activeUpperTick;
    /// @notice set to true if target is above tick at time of init position
    bool public activeRangeAboveTick;

    constructor(
		address _factory,
		address _collateralAsset,
		address _wethAddress,
		address _parentLiquidityPool,
		uint24 _poolFee,
		address _priceFeed,
		address _authority
	) AccessControl(IAuthority(_authority)) {
        collateralAsset = _collateralAsset;
        wETH = _wethAddress;
        factory = _factory;
        address _token0 = _collateralAsset < _wethAddress ? _collateralAsset : _wethAddress;
        address _token1 = _collateralAsset < _wethAddress ? _wethAddress : _collateralAsset;
        pool =  IUniswapV3Pool(PoolAddress.getPoolAddress(factory, _token0, _token1, _poolFee));
		token1 = IERC20(_token1);
		token0 = IERC20(_token0);
		parentLiquidityPool = _parentLiquidityPool;
		poolFee = _poolFee;
		priceFeed = _priceFeed;
	}
    
    /// @notice Uniswap V3 callback fn, called back on pool.mint
    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata /*_data*/
    ) external override {
        require(msg.sender == address(pool), "callback caller");

        if (amount0Owed > 0) token0.safeTransfer(msg.sender, amount0Owed);
        if (amount1Owed > 0) token1.safeTransfer(msg.sender, amount1Owed);
    }

    function getTicks() external view returns (int24 tick, uint160 sqrtPriceX96){
        (sqrtPriceX96, tick, , , , , ) = pool.slot0();
    }

    function createUniswapRangeOrderOneTickBelowMarket(uint256 amount0Desired, uint256 amount1Desired) external {
        // current price, current tick
        (uint160 sqrtPriceX96, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = pool.tickSpacing();
        int24 tickUpper = tick - tickSpacing;
        int24 tickLower = tick - (2 * tickSpacing);
        // compute the liquidity amount
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            amount0Desired, // amount of token0 being sent in
            amount1Desired // amount of token1 being sent in
        );
        token0.safeApprove(address(pool), amount0Desired);
        token1.safeApprove(address(pool), amount1Desired);
        pool.mint(address(this), tickLower, tickUpper, liquidity, "");
    }

    function getAmountsForLiquidity() public view {
        // current price, current tick
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        (uint128 liquidity, , , uint128 tokensOwed0, uint128 tokensOwed1) = pool.positions(_getPositionID());

        // compute the liquidity amount
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(activeLowerTick);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(activeUpperTick);

        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            liquidity
        );
        console.log("amount0 owed: ", amount0);
        console.log("amount1: owed ", amount1);
    }

    function createUniswapRangeOrderOneTickAboveMarket(uint256 amount0Desired) external {
        // current price, current tick
        (uint160 sqrtPriceX96, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = pool.tickSpacing();
        int24 nearestActiveTick = tick / tickSpacing * tickSpacing;
        int24 lowerTick = nearestActiveTick + tickSpacing;
        int24 upperTick = lowerTick + tickSpacing;
        // compute the liquidity amount
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(lowerTick);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(upperTick);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            amount0Desired, // amount of token0 being sent in
            0 // amount of token1 being sent in
        );
        token0.safeApprove(address(pool), amount0Desired);
        console.log("amount0Deposited: ", amount0Desired);
        //token1.safeApprove(address(pool), amount1Desired);
        pool.mint(address(this), lowerTick, upperTick, liquidity, "");
        // store the active range for later access
        activeLowerTick = lowerTick;
        activeUpperTick = upperTick;
        activeRangeAboveTick = true;
        //todo - emit event
    }

    function yankRangeOrderLiquidity() external {
        // struct definition: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol#L13
        (uint128 liquidity, , , ,) = pool.positions(_getPositionID());

        //(uint256 amount0, uint256 amount1) = pool.burn(activeLowerTick, activeUpperTick, liquidity);
        _withdraw(activeLowerTick, activeUpperTick, liquidity);
        //console.log("amount0: ", amount0, "amount1: ", amount1);
        // todo collect accumulated fees
        //pool.collect(address(this), activeLowerTick, activeUpperTick, type(uint128).max, type(uint128).max);
    }

    function _withdraw(
        int24 lowerTick_,
        int24 upperTick_,
        uint128 liquidity
    )
        private
        returns (
            uint256 burn0,
            uint256 burn1,
            uint256 fee0,
            uint256 fee1
        )
    {
        uint256 preBalance0 = token0.balanceOf(address(this));
        uint256 preBalance1 = token1.balanceOf(address(this));
        
        // returns amount of token0 and token1 sent to this vault
        (burn0, burn1) = pool.burn(lowerTick_, upperTick_, liquidity);

        // collect accumulated fees
        pool.collect(
            address(this),
            lowerTick_,
            upperTick_,
            type(uint128).max,
            type(uint128).max
        );

        // using this approach becaus the above collect method return amounts are unreliable
        fee0 = token0.balanceOf(address(this)) - preBalance0 - burn0;
        fee1 = token1.balanceOf(address(this)) - preBalance1 - burn1;
        //TODO emit events
    }

    /// @notice compute total underlying holdings of the vault token supply
    /// includes current liquidity invested in uniswap position, current fees earned, 
    /// and tokens held in vault
    /// @return amount0Current current total underlying balance of token0
    /// @return amount1Current current total underlying balance of token1
    function getUnderlyingBalances()
        public
        view
        returns (uint256 amount0Current, uint256 amount1Current)
    {
        (uint160 sqrtRatioX96, int24 tick, , , , , ) = pool.slot0();
        return _getUnderlyingBalances(sqrtRatioX96, tick);
    }

    function getUnderlyingBalancesAtPrice(uint160 sqrtRatioX96)
        external
        view
        returns (uint256 amount0Current, uint256 amount1Current)
    {
        (, int24 tick, , , , , ) = pool.slot0();
        return _getUnderlyingBalances(sqrtRatioX96, tick);
    }

    function _getUnderlyingBalances(uint160 sqrtRatioX96, int24 tick)
        internal
        view
        returns (uint256 amount0Current, uint256 amount1Current)
    {
        (
            uint128 liquidity,
            uint256 feeGrowthInside0Last,
            uint256 feeGrowthInside1Last,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = pool.positions(_getPositionID());

        // compute current holdings from liquidity
        (amount0Current, amount1Current) = LiquidityAmounts
            .getAmountsForLiquidity(
            sqrtRatioX96,
            activeLowerTick.getSqrtRatioAtTick(),
            activeUpperTick.getSqrtRatioAtTick(),
            liquidity
        );

        // compute current fees earned
        uint256 fee0 =
            _computeFeesEarned(true, feeGrowthInside0Last, tick, liquidity) +
                uint256(tokensOwed0);
        uint256 fee1 =
            _computeFeesEarned(false, feeGrowthInside1Last, tick, liquidity) +
                uint256(tokensOwed1);

        // add any leftover in contract to current holdings
        amount0Current +=
            fee0 +
            token0.balanceOf(address(this));
        amount1Current +=
            fee1 +
            token1.balanceOf(address(this));
    }

    /// credit: https://github.com/ArrakisFinance/vault-v1-core/blob/main/contracts/ArrakisVaultV1.sol#L721
    /// @notice Computes the fees earned by the position
    function _computeFeesEarned(
        bool isZero,
        uint256 feeGrowthInsideLast,
        int24 tick,
        uint128 liquidity
    ) private view returns (uint256 fee) {
        uint256 feeGrowthOutsideLower;
        uint256 feeGrowthOutsideUpper;
        uint256 feeGrowthGlobal;
        if (isZero) {
            feeGrowthGlobal = pool.feeGrowthGlobal0X128();
            (, , feeGrowthOutsideLower, , , , , ) = pool.ticks(activeLowerTick);
            (, , feeGrowthOutsideUpper, , , , , ) = pool.ticks(activeUpperTick);
        } else {
            feeGrowthGlobal = pool.feeGrowthGlobal1X128();
            (, , , feeGrowthOutsideLower, , , , ) = pool.ticks(activeLowerTick);
            (, , , feeGrowthOutsideUpper, , , , ) = pool.ticks(activeUpperTick);
        }

        unchecked {
            // calculate fee growth below
            uint256 feeGrowthBelow;
            if (tick >= activeLowerTick) {
                feeGrowthBelow = feeGrowthOutsideLower;
            } else {
                feeGrowthBelow = feeGrowthGlobal - feeGrowthOutsideLower;
            }

            // calculate fee growth above
            uint256 feeGrowthAbove;
            if (tick < activeUpperTick) {
                feeGrowthAbove = feeGrowthOutsideUpper;
            } else {
                feeGrowthAbove = feeGrowthGlobal - feeGrowthOutsideUpper;
            }

            uint256 feeGrowthInside =
                feeGrowthGlobal - feeGrowthBelow - feeGrowthAbove;
            fee = FullMath.mulDiv(
                liquidity,
                feeGrowthInside - feeGrowthInsideLast,
                0x100000000000000000000000000000000
            );
        }
    }

    function getPositionID() external view returns (bytes32) {
        return _getPositionID();
    }

    function _getPositionID() private view returns (bytes32 positionID) {
        return keccak256(abi.encodePacked(address(this), activeLowerTick, activeUpperTick));
    }

    //////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/// @inheritdoc IHedgingReactor
	function hedgeDelta(int256 _delta) external returns (int256) {}

    /// @inheritdoc IHedgingReactor
	function withdraw(uint256 _amount) external returns (uint256) {}

    /////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/// @inheritdoc IHedgingReactor
	function update() external pure returns (uint256) {
		return 0;
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	/// @inheritdoc IHedgingReactor
	function getDelta() external view returns (int256 delta) {}

	/// @inheritdoc IHedgingReactor
	function getPoolDenominatedValue() external view returns (uint256 value) {}
}