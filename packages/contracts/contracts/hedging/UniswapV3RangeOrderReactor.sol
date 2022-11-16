// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { IUniswapV3MintCallback } from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import { PoolAddress } from "../vendor/uniswap/PoolAddress.sol";
import { LiquidityAmounts } from "../vendor/uniswap/LiquidityAmounts.sol";
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
	/// @notice address of the wETH contract using uniswap pool convention
    IERC20 public immutable token0;
	/// @notice stablecoin addresses to trade against wETH using uniswap pool convention
    IERC20 public immutable token1;
	/// @notice instance of the uniswap V3 pool
    IUniswapV3Pool public pool;
    /// @notice address of the uniswap V3 factory
    address public immutable factory;
	/// @notice uniswap v3 pool fee expressed at 10e6
	uint24 public immutable poolFee;


    constructor(
		address _factory,
		address _collateralAsset,
		address _wethAddress,
		address _parentLiquidityPool,
		uint24 _poolFee,
		address _priceFeed,
		address _authority
	) AccessControl(IAuthority(_authority)) {
        factory = _factory;
        address _token0 = _collateralAsset < _wethAddress ? _collateralAsset : _wethAddress;
        address _token1 = _collateralAsset < _wethAddress ? _wethAddress : _collateralAsset;
        pool =  IUniswapV3Pool(PoolAddress.getPoolAddress(factory, _token0, _token1, _poolFee));
        console.log("pool address: ", address(pool));

		token1 = IERC20(_collateralAsset);
		token0 = IERC20(_wethAddress);
		parentLiquidityPool = _parentLiquidityPool;
		poolFee = _poolFee;
		priceFeed = _priceFeed;

		//SafeTransferLib.safeApprove(ERC20(collateralAsset), address(swapRouter), MAX_UINT);
		//SafeTransferLib.safeApprove(ERC20(_wethAddress), address(swapRouter), MAX_UINT);
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
        pool.mint(address(this), tickLower, tickUpper, liquidity, "");
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