// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

contract EphemeralPortfolioValues is Ownable {

  /////////////////////////////////////
  /// governance settable variables ///
  /////////////////////////////////////

  address public liquidityPool;
  address public portfolioValuesFeed;


  /////////////////////////
  /// dynamic variables ///
  /////////////////////////

  // ephemeral liabilities of the pool
  uint256 public ephemeralLiabilities;
  // ephemeral delta of the pool
  int256 public ephemeralDelta;


  constructor() {}

  ///////////////
  /// setters ///
  ///////////////

  function setLiquidityPool(address _liquidityPool) external onlyOwner {
    liquidityPool = _liquidityPool;
  }

  function setPortfolioValuesFeed(address _pvFeed) external onlyOwner {
    liquidityPool = _pvFeed;
  }
  //////////////////////////////////////////////////////
  /// access-controlled state changing functionality ///
  //////////////////////////////////////////////////////
  
function updateEphemeralVariables(uint256 _liability, int256 _delta, Types.OptionSeries memory optionSeries) external {
    require(msg.sender == liquidityPool, "!auth");
    ephemeralLiabilities += _liability;
    ephemeralDelta += _delta;
}

function resetEphemeralVariables(uint256 _liability, int256 delta) external {
    require(msg.sender == portfolioValuesFeed, "!auth");
    delete ephemeralLiabilities;
    delete ephemeralDelta;
}
}