// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "prb-math/contracts/PRBMathUD60x18.sol";
import {FullMath} from "./FullMath.sol";
import {TickMath} from "./TickMath.sol";

	using PRBMathUD60x18 for uint256;
    using TickMath for int24;

    uint256 constant Q96 = 0x1000000000000000000000000;

    /// @notice enum to indicate the direction of the range order
    enum RangeOrderDirection{ ABOVE, BELOW }

    ////////////////////////
    //      structs       //
    ////////////////////////

    struct RangeOrderParams {
        int24 lowerTick;
        int24 upperTick;
        uint160 sqrtPriceX96;
        uint256 meanPrice;
        RangeOrderDirection direction;
    }

    /**
     * @param token0Token1 the price of token0/token1 in token1 decimals
     * @param token0Decimals the decimals of token0
     * @return sqrtPriceX96 sqrt price of token0/token1
     */
    function encodePriceSqrt(uint256 token0Token1, uint8 token0Decimals)
        pure
        returns (uint160 sqrtPriceX96)
    {
        uint256 oneDecimals = 10 ** token0Decimals;
        uint256 sqrtReserves = PRBMathUD60x18.sqrt(token0Token1.div(oneDecimals));
        uint256 sqrtPrice96 = sqrtReserves.mul(Q96);
        return uint160(sqrtPrice96);
    }

    /**
     * @param sqrtPriceX96 the sqrt price of token0/token1
     * @param token0Decimals the decimals of token0
     * @return the price as token0/token1 in token1 decimals
     */
    function sqrtPriceX96ToUint(uint160 sqrtPriceX96, uint8 token0Decimals)
        pure
        returns (uint256)
    {
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        if (sqrtPrice > Q96) {
            uint256 sqrtP = FullMath.mulDiv(sqrtPrice, 10 ** token0Decimals, Q96);
            return FullMath.mulDiv(sqrtP, sqrtP, 10 ** token0Decimals);
        } else {
            uint256 numerator1 = FullMath.mulDiv(sqrtPrice, sqrtPrice, 1);
            uint256 numerator2 = 10 ** token0Decimals;
            return FullMath.mulDiv(numerator1, numerator2, 1 << 192);
        }
    }

    /**
     * @param price0 the price of underlying/collateral token in 1e18 decimals
     * @param price1 the price of collateral token/underlying token in 1e18 decimals
     * @param inversed whether the pool token0/token1 ordering is inverted to underlying/collateral
     * @param direction the direction of the range order
     * @return the price to use for the range order
     */
    function getPriceToUse(
        uint256 price0,
        uint256 price1,
        bool inversed,
        RangeOrderDirection direction
    ) 
        pure
        returns (uint256) 
    {
        if (inversed) {
            if (direction == RangeOrderDirection.ABOVE) {
                // ABOVE is selling collateral token for underlying, use lowest price for best price
                return price0 < price1 ? price0 : price1;
            } else {
                // BELOW is buying collateral token for underlying, use highest price for best price
                return price0 > price1 ? price0 : price1;
            }
        } else {
            if (direction == RangeOrderDirection.ABOVE) {
                // ABOVE is selling underlying for collateral token, use highest price for best price
                return price0 > price1 ? price0 : price1;
            } else {
                // BELOW is buying selling underlying for collateral token, use lowest price for best price
                return price0 < price1 ? price0 : price1;
            } 
        }
    }

        /**
     * @dev takes a price quote converts to sqrtPriceX96 token0/token1 format
     * @param weiPrice the price of in wei
     * @param inversed true if token0 is the collateral token
     * @return sqrtPriceX96 the sqrtPriceX96 of the price
     */
    function sqrtPriceFromWei(
        uint256 weiPrice,
        bool inversed,
        uint8 token0Decimals
    ) pure returns (uint160 sqrtPriceX96){
        uint256 price = inversed ? uint256(1e18).div(weiPrice) : weiPrice;
        sqrtPriceX96 = uint160(PRBMathUD60x18.sqrt(price).mul(2 ** 96)) * uint160(10 ** token0Decimals);
    }

    /**
     * @param tick the tick of the pool
     * @param token0Decimals the decimals of token0
     * @param inversed whether the pool token0/token1 ordering is inverted to underlying/collateral
     * @return the price of underlying/collateral token in collateral decimals
     */
    function tickToTokenPrice(
        int24 tick,
        uint8 token0Decimals,
        bool inversed
    )
        pure
        returns (uint256)
    {
        uint256 price = sqrtPriceX96ToUint(tick.getSqrtRatioAtTick(), token0Decimals);
        if (!inversed) {
            // underlying/collateral is token0/token1
            return price;
        } else {
            // underlying/collateral is token1/token0
            uint256 ONE = 10 ** (token0Decimals);
            return ONE.div(price);
        }
    }