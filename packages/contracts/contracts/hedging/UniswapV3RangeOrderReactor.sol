// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "prb-math/contracts/PRBMathUD60x18.sol";
import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { IUniswapV3MintCallback } from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import { PoolAddress } from "../vendor/uniswap/PoolAddress.sol";
import { LiquidityAmounts, FullMath } from "../vendor/uniswap/LiquidityAmounts.sol";
import "../vendor/uniswap/TickMath.sol";
import "../interfaces/IHedgingReactor.sol";
import "../interfaces/ILiquidityPool.sol";
import "../libraries/AccessControl.sol";
import "../libraries/OptionsCompute.sol";
import "../libraries/SafeTransferLib.sol";
import "../PriceFeed.sol";
import "hardhat/console.sol";

contract UniswapV3RangeOrderReactor is IUniswapV3MintCallback, IHedgingReactor, AccessControl {

    using PRBMathUD60x18 for uint256;
    using TickMath for int24;
    using SafeTransferLib for ERC20;
    ///////////////////////////
	/// immutable variables ///
	///////////////////////////

	/// @notice address of the parent liquidity pool contract
	address public immutable parentLiquidityPool;
	/// @notice address of the price feed used for getting asset prices
	address public immutable priceFeed;
    /// @notice generalised list of stablecoin addresses to trade against wETH
	address public immutable collateralAsset;
	/// @notice address of the wETH contract
	address public immutable wETH;
	/// @notice smaller address token using uniswap pool convention
    ERC20 public immutable token0;
	/// @notice larger address token using uniswap pool convention
    ERC20 public immutable token1;
    /// @notice address of the uniswap V3 factory
    address public immutable factory;
	/// @notice uniswap v3 pool fee expressed at 10e6
	uint24 public immutable poolFee;


	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	/// @notice instance of the uniswap V3 pool
    IUniswapV3Pool public pool;
    /// @notice limit to ensure we arent doing inefficient computation for dust amounts
	uint256 public minAmount = 1e16;

	/////////////////////////
	/// dynamic variables ///
	/////////////////////////

    /// @notice uniswap v3 pool lower tick spacing - set to 0 if no active range order
    //int24 public activeLowerTick;
    /// @notice uniswap v3 pool upper tick spacing - set to 0 if no active range order
    //int24 public activeUpperTick;
    /// @notice set to true if target is above tick at time of init position
    //bool public activeRangeAboveTick;
    /// @notice current range order position
    Position public currentPosition;

    ////////////////////////
    //      structs       //
    ////////////////////////

    struct Position {
        int24 activeLowerTick; // uniswap v3 pool lower tick spacing - set to 0 if no active range order
        int24 activeUpperTick; // uniswap v3 pool upper tick spacing - set to 0 if no active range order
        bool activeRangeAboveTick; // set to true if target is above tick at time of init position
    }




    /////////////////////////
	///       events      ///
	/////////////////////////
    
    event Minted(
        address receiver,
        uint256 mintAmount,
        uint256 amount0In,
        uint256 amount1In,
        uint128 liquidityMinted
    );

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
		token1 = ERC20(_token1);
		token0 = ERC20(_token0);
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

    /// @notice returns the current price of the underlying asset and the inverse symbol price
    /// ie: USDC/WETH and WETH/USDC
    function getPoolPrice() public view returns (uint256 price, uint256 inversed){
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        uint256 p = sqrtPriceX96 / (2 ** 96);
        price = p ** 2;
        bool token1DecimalsGTE = token1.decimals() >= token0.decimals();
        if (token1DecimalsGTE){
            inversed = (1e18 / price) * (10 ** (token1.decimals() - token0.decimals()));
        } else {
            inversed = (10 ** token1.decimals()) / price;
        }
        // 1e18 format
        price = price * (10 ** token0.decimals());
    }

    /// @notice take a price quote in token1/token0 format and convert to sqrtPriceX96 token0/token1 format
    function sqrtPriceFromWei(uint256 weiPrice) public view returns (uint160 sqrtPriceX96){
        uint256 inverse = uint256(1e18).div(weiPrice);
        sqrtPriceX96 = uint160(PRBMathUD60x18.sqrt(inverse).mul(2 ** 96)) * uint160(10 ** token0.decimals());
    }

    function weiToSqrtx96(uint256 weiPrice) public pure returns (uint160 sqrtPriceX96){
        sqrtPriceX96 = uint160(PRBMathUD60x18.sqrt(weiPrice) * 2 ** 96);
    }

    function sqrtPriceX96ToUint(uint160 sqrtPriceX96, uint8 token0Decimals)
        public 
        pure
        returns (uint256)
    {
        uint256 numerator1 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        uint256 numerator2 = 10**token0Decimals;
        return FullMath.mulDiv(numerator1, numerator2, 1 << 192);
    }

    function SqrtPriceX96ToNearestTick(uint160 sqrtPriceX96, int24 tickSpacing) public pure returns (int24 nearestActiveTick){
        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        nearestActiveTick = tick / tickSpacing * tickSpacing;
    }

    function createUniswapRangeOrderOneTickBelowMarket(uint256 amount1Desired) external {
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
            0, // amount of token0 being sent in
            amount1Desired // amount of token1 being sent in
        );
        //token0.safeApprove(address(pool), amount0Desired);
        token1.safeApprove(address(pool), amount1Desired);
        pool.mint(address(this), tickLower, tickUpper, liquidity, "");
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
        pool.mint(address(this), lowerTick, upperTick, liquidity, "");
        // store the active range for later access
        currentPosition.activeLowerTick = lowerTick;
        currentPosition.activeUpperTick = upperTick;
        currentPosition.activeRangeAboveTick = true;
        //todo - emit event
    }

    function createUniswapRangeOrderOneTickAbove(uint160 sqrtPriceX96, uint256 amount0Desired) internal {
        int24 tickSpacing = pool.tickSpacing();
        int24 nearestActiveTick = SqrtPriceX96ToNearestTick(sqrtPriceX96, tickSpacing);
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

		SafeTransferLib.safeTransferFrom(address(token0), msg.sender, address(this), amount0Desired);
        token0.safeApprove(address(pool), amount0Desired);
        pool.mint(address(this), lowerTick, upperTick, liquidity, "");
        // store the active range for later access
        currentPosition.activeLowerTick = lowerTick;
        currentPosition.activeUpperTick = upperTick;
        currentPosition.activeRangeAboveTick = true;
        //TODO emit event
    }

    function createUniswapRangeOrderOneTickBelow(uint160 sqrtPriceX96, uint256 amount1Desired) internal {
        int24 tickSpacing = pool.tickSpacing();
        int24 nearestActivetick = SqrtPriceX96ToNearestTick(sqrtPriceX96, tickSpacing);
        int24 upperTick = nearestActivetick - tickSpacing;
        int24 lowerTick = upperTick - tickSpacing;
        // compute the liquidity amount
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(lowerTick);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(upperTick);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            0, // amount of token0 being sent in
            amount1Desired // amount of token1 being sent in
        );

        token1.safeApprove(address(pool), amount1Desired);
        pool.mint(address(this), lowerTick, upperTick, liquidity, "");
        // store the active range for later access
        currentPosition.activeLowerTick = lowerTick;
        currentPosition.activeUpperTick = upperTick;
        currentPosition.activeRangeAboveTick = false;
        //event emit can be skipped due to uniswap pool emitting Mint event
    }

    /// @notice Permissionlessly withdraws liquidity from an active range if it's 100% in the position target
    function fullfillActiveRangeOrder() external {
        (, int24 tick, , , , , ) = pool.slot0();
        (uint128 liquidity, , , ,) = pool.positions(_getPositionID());
        if (currentPosition.activeRangeAboveTick) {
            // check if the current price is above the upper tick
            if (tick > currentPosition.activeUpperTick) {
                _withdraw(currentPosition.activeLowerTick, currentPosition.activeUpperTick, liquidity);
            }
            // consider throwing an error if the current price is below the lower tick
        } else {
            // if the active range target is below the current price
            // if the current price is below the lower tick
            if (tick <= currentPosition.activeLowerTick) {
                _withdraw(currentPosition.activeLowerTick, currentPosition.activeUpperTick, liquidity);
            }
            // consider throwing an error if the current price is above the lower tick
        }
    }

    /// @notice Withdraws all liquidity from a range order and collection outstanding fees
    function _yankRangeOrderLiquidity() private {
        // struct definition: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol#L13
        (uint128 liquidity, , , ,) = pool.positions(_getPositionID());
        _withdraw(currentPosition.activeLowerTick, currentPosition.activeUpperTick, liquidity);
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
        // emits Burn event in the uniswap pool
        (burn0, burn1) = pool.burn(lowerTick_, upperTick_, liquidity);

        // collect accumulated fees
        // emits collect event in the uniswap pool
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
        // mark no current position
        delete currentPosition;
        //TODO check if we need to emit event based on final balances and fees received
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
        (amount0Current, amount1Current) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtRatioX96,
            currentPosition.activeLowerTick.getSqrtRatioAtTick(),
            currentPosition.activeUpperTick.getSqrtRatioAtTick(),
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
            (, , feeGrowthOutsideLower, , , , , ) = pool.ticks(currentPosition.activeLowerTick);
            (, , feeGrowthOutsideUpper, , , , , ) = pool.ticks(currentPosition.activeUpperTick);
        } else {
            feeGrowthGlobal = pool.feeGrowthGlobal1X128();
            (, , , feeGrowthOutsideLower, , , , ) = pool.ticks(currentPosition.activeLowerTick);
            (, , , feeGrowthOutsideUpper, , , , ) = pool.ticks(currentPosition.activeUpperTick);
        }

        unchecked {
            // calculate fee growth below
            uint256 feeGrowthBelow;
            if (tick >= currentPosition.activeLowerTick) {
                feeGrowthBelow = feeGrowthOutsideLower;
            } else {
                feeGrowthBelow = feeGrowthGlobal - feeGrowthOutsideLower;
            }

            // calculate fee growth above
            uint256 feeGrowthAbove;
            if (tick < currentPosition.activeUpperTick) {
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
        return keccak256(abi.encodePacked(address(this), currentPosition.activeLowerTick, currentPosition.activeUpperTick));
    }

    //////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/// @inheritdoc IHedgingReactor
	function hedgeDelta(int256 _delta) external returns (int256) {
		require(msg.sender == parentLiquidityPool, "!vault");
        // check for existing range order first amd return if found
        if (inActivePosition()) _yankRangeOrderLiquidity();

        bool inversed = collateralAsset == address(token0);
        uint256 underlyingPrice = getUnderlyingPrice(wETH, collateralAsset);
        (uint256 amount0Current, uint256 amount1Current) = getUnderlyingBalances();
        (uint256 poolPrice, uint256 inversedPrice) = getPoolPrice();
        uint256 quotePrice = inversed ? inversedPrice : poolPrice;
        if (_delta < 0) {
            // buy wETH
            uint256 priceToUse = quotePrice < underlyingPrice ? quotePrice : underlyingPrice;
            uint256 amountCollateralInToken1 = uint256(-_delta).mul(underlyingPrice);
            uint256 amountDesiredInCollateralToken = OptionsCompute.convertToDecimals(amountCollateralInToken1, ERC20(collateralAsset).decimals());
            uint160 underlyingSqrtx96 = sqrtPriceFromWei(priceToUse);
            if (inversed) {
                createUniswapRangeOrderOneTickAbove(underlyingSqrtx96, amountDesiredInCollateralToken);
            } else {
                createUniswapRangeOrderOneTickBelow(underlyingSqrtx96, amountDesiredInCollateralToken);
            }
        } else {
            // sell wETH
            uint256 wethBalance = inversed ? amount1Current : amount0Current;
            if (wethBalance < minAmount) return 0;
            uint256 priceToUse = quotePrice < underlyingPrice ? underlyingPrice : quotePrice;
            uint160 underlyingSqrtx96 = sqrtPriceFromWei(priceToUse);
            uint256 deltaToUse = _delta > int256(wethBalance) ? wethBalance : uint256(_delta);
            uint256 amountCollateralInToken1 = deltaToUse.mul(underlyingPrice);
            uint256 amountDesiredInCollateralToken = OptionsCompute.convertToDecimals(amountCollateralInToken1, ERC20(collateralAsset).decimals());
            // TODO withdraw and collect first
            if (inversed) {
                createUniswapRangeOrderOneTickBelow(underlyingSqrtx96, amountDesiredInCollateralToken);
            } else {
                createUniswapRangeOrderOneTickAbove(underlyingSqrtx96, amountDesiredInCollateralToken);
            }
        }
        // satisfy interface, delta only changes when range order is filled
        return 0;
    }

    /// @inheritdoc IHedgingReactor
	function withdraw(uint256 _amount) external returns (uint256) {}

    /////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/// @inheritdoc IHedgingReactor
	function update() external pure returns (uint256) {
        // Remove range order if possible
		return 0;
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	/// @inheritdoc IHedgingReactor
	function getDelta() 
        external
        view
        returns (int256 delta) 
    {
        (uint256 amount0Current, uint256 amount1Current) = getUnderlyingBalances();
        delta = wETH == address(token0) ? int256(amount0Current) : int256(amount1Current);
    }

	/// @inheritdoc IHedgingReactor
	function getPoolDenominatedValue() external view returns (uint256 value) {
        (uint256 amount0Current, uint256 amount1Current) = getUnderlyingBalances();
        uint256 collateral = wETH == address(token0) ? amount1Current : amount0Current;
        uint256 wethBalance = wETH == address(token0) ? amount0Current : amount1Current;
        uint256 collateralValue = OptionsCompute.convertFromDecimals(collateral, ERC20(collateralAsset).decimals());
        uint256 wethValue = PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset) * wethBalance;
        value = collateralValue + wethValue;
    }

    //////////////////////////
	/// internal utilities ///
	//////////////////////////

	/**
	 * @notice get the underlying price with just the underlying asset and strike asset
	 * @param underlying   the asset that is used as the reference asset
	 * @param _strikeAsset the asset that the underlying value is denominated in
	 * @return the underlying price
	 */
	function getUnderlyingPrice(address underlying, address _strikeAsset)
		internal
		view
		returns (uint256)
	{
		return PriceFeed(priceFeed).getNormalizedRate(underlying, _strikeAsset);
	}

    /**
     * @notice determine if the pool is in an range order
     * @return true if the pool is in a range order
     */
    function inActivePosition() internal view returns (bool) {
        return currentPosition.activeLowerTick != currentPosition.activeUpperTick;
    }

    //TODO - add method to retrieve any ERC20 token held by vault
}