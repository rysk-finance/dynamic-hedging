// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.0;

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/// @title Functionality unique to range order reactor outside of IHedging Reactor.

struct Position {
    int24 activeLowerTick; // uniswap v3 pool lower tick spacing - set to 0 if no active range order
    int24 activeUpperTick; // uniswap v3 pool upper tick spacing - set to 0 if no active range order
    bool activeRangeAboveTick; // set to true if target is above tick at time of init position
}

interface IRangeOrderReactor {

    function pool() external view returns (IUniswapV3Pool);
    function currentPosition() external view returns (Position memory);
    function exitActiveRangeOrder() external;

    //function createUniswapRangeOrder(RangeOrderParams calldata params, uint256 amountDesired) external;

}
