// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "prb-math/contracts/PRBMathUD60x18.sol";
import {FullMath} from "./FullMath.sol";

	using PRBMathUD60x18 for uint256;

    /// @notice enum to indicate the direction of the range order
    enum RangeOrderDirection{ ABOVE, BELOW }

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
        uint256 sqrtPrice96 = sqrtReserves.mul(2 ** 96);
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
        uint256 numerator1 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        uint256 numerator2 = 10**token0Decimals;
        return FullMath.mulDiv(numerator1, numerator2, 1 << 192);
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