// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "prb-math/contracts/PRBMathUD60x18.sol";
import {FullMath} from "./FullMath.sol";

	using PRBMathUD60x18 for uint256;

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