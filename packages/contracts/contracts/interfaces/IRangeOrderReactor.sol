// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.0;

/// @title Functionality unique to range order reactor outside of IHedging Reactor.

struct Position {
    int24 activeLowerTick; // uniswap v3 pool lower tick spacing - set to 0 if no active range order
    int24 activeUpperTick; // uniswap v3 pool upper tick spacing - set to 0 if no active range order
    bool activeRangeAboveTick; // set to true if target is above tick at time of init position
}

// truncating slot0 to prevent stack too deep error
// We only require tick
interface IUniswapV3PoolState {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick
        );
}

interface IRangeOrderReactor {

    function pool() external view returns (IUniswapV3PoolState);
    function currentPosition() external view returns (Position memory);
    function exitActiveRangeOrder() external;

    //function createUniswapRangeOrder(RangeOrderParams calldata params, uint256 amountDesired) external;

}
