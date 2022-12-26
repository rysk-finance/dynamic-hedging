// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.13;

import { sqrtPriceX96ToUint, encodePriceSqrt } from "../vendor/uniswap/Conversions.sol";

contract UniswapConversionsTest {

    function priceToSqrtX96(uint256 token0Token1, uint8 token0Decimals)
        public
        pure
        returns (uint160 sqrtPriceX96)
    {
        return encodePriceSqrt(token0Token1, token0Decimals);
    }

    function sqrtToPrice(uint160 sqrtPriceX96, uint8 token0Decimals)
        public
        pure
        returns (uint256)
    {
        return sqrtPriceX96ToUint(sqrtPriceX96, token0Decimals);
    }

}