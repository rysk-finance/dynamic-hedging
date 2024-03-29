// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.13;

import { sqrtPriceX96ToUint, encodePriceSqrt, getPriceToUse, RangeOrderDirection, tickToTokenPrice, sqrtPriceFromWei } from "../vendor/uniswap/RangeOrderUtils.sol";

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

    function priceToSqrt(uint256 weiPrice, bool inversed, uint8 token0Decimals)
        public
        pure
        returns (uint160 sqrtPriceX96)
    {
        uint256 token0Token1 = inversed ? 10 ** token0Decimals / weiPrice : weiPrice;
        return encodePriceSqrt(token0Token1, token0Decimals);
    }

    function mockPriceToUse(
        uint256 price0,
        uint256 price1,
        bool inversed,
        RangeOrderDirection direction
    ) 
        public
        pure
        returns (uint256) 
    {
        return getPriceToUse(price0, price1, inversed, direction);
    }

    function mockTickToTokenPrice(
        int24 tick,
        uint8 token0Decimals,
        bool inversed
    ) 
        public
        pure
        returns (uint256) 
    {
        return tickToTokenPrice(tick, token0Decimals, inversed);
    }

}