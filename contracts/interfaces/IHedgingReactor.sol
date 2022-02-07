// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.9;

/// @title Reactors to hedge delta using means outside of the option pricing skew.

interface IHedgingReactor {
    
    /// @notice Execute a strategy to hedge delta exposure
    /// @param delta The exposure of the liquidity pool that the reactor needs to hedge against
    /// @return deltaChange The difference in delta exposure as a result of strategy execution
    function hedgeDelta(int256 delta) external returns(int256 deltaChange);

    /// @notice Returns the delta exposure of the reactor
    function getDelta() view external returns (int256 delta);

    /// @notice Withdraw a given asset from the hedging reactor to the calling liquidity pool.
    /// @param amount The amount to withdraw
    /// @param token The asset to withdraw
    function withdraw(uint256 amount, address token) external;

    /// @notice Handle events such as collateralisation rebalancing
    function update() external returns (int256);

}