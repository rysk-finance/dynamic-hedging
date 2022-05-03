// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

interface IEphemeralPortfolioValues {

  ///////////////////////////
  /// non-complex getters ///
  ///////////////////////////

  function ephemeralLiabilities() external view returns (uint256);
  function ephemeralDelta() external view returns (int256);
  function updateEphemeralVariables() external;
}
