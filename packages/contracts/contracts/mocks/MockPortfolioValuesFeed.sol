// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import { OptionsCompute } from "../libraries/OptionsCompute.sol";
import "../interfaces/ILiquidityPool.sol";
import "../libraries/Types.sol";

/**
 * @title The Mock PortfolioValuesFeed contract - NEVER USE THIS IN PRODUCTION! FOR TESTING ONLY!
 * @notice An external adapter Consumer contract that makes requests to obtain portfolio values for different pools
 */
contract MockPortfolioValuesFeed is Ownable, ChainlinkClient {
  using Chainlink for Chainlink.Request;

  ///////////////////////////
  /// immutable variables ///
  ///////////////////////////

  address private immutable oracle;
  bytes32 private immutable jobId;
  uint256 private immutable fee;
  address private immutable link;

  /////////////////////////////////
  /// oracle settable variables ///
  /////////////////////////////////

  mapping(address => mapping(address => Types.PortfolioValues)) private portfolioValues;

  /////////////////////////////////
  /// govern settable variables ///
  /////////////////////////////////

  ILiquidityPool public liquidityPool;
  // mapping of addresses to their string versions
  mapping(address => string) public stringedAddresses;
  // max time to allow between oracle updates for an underlying and strike
  mapping(address => mapping(address => uint256)) public maxTimeDeviationThreshold;
  // max price difference to allow between oracle updates for an underlying and strike
  mapping(address => mapping(address => uint256)) public maxPriceDeviationThreshold;

  ////////////////////////
  /// events && errors ///
  ////////////////////////

  event DataFullfilled(address indexed underlying, address indexed strike, int256 delta, int256 gamma, int256 vega, int256 theta, uint256 callPutsValue);

  error TimeDeltaExceedsThreshold(uint256 timeDelta);
  error PriceDeltaExceedsThreshold(uint256 priceDelta);

  /**
   * @notice Executes once when a contract is created to initialize state variables
   *
   * @param _oracle - address of the specific Chainlink node that a contract makes an API call from
   * @param _jobId - specific job for :_oracle: to run; each job is unique and returns different types of data
   * @param _fee - node operator price per API call / data request
   * @param _link - LINK token address on the corresponding network
   */
  constructor(
    address _oracle,
    bytes32 _jobId,
    uint256 _fee,
    address _link
  ) {
    if (_link == address(0)) {
      setPublicChainlinkToken();
    } else {
      setChainlinkToken(_link);
    }
    oracle = _oracle;
    jobId = _jobId;
    fee = _fee;
    link = _link;
  }

  ///////////////
  /// setters ///
  ///////////////

  function setLiquidityPool(address _liquidityPool) external onlyOwner {
    liquidityPool = ILiquidityPool(_liquidityPool);
  }

  function setAddressStringMapping(address _asset, string memory _stringVersion) external onlyOwner {
    stringedAddresses[_asset] = _stringVersion;
  }

  function setMaxTimeDeviationThreshold(uint256 _maxTimeDeviationThreshold, address underlying, address strike) external onlyOwner {
    maxTimeDeviationThreshold[underlying][strike] = _maxTimeDeviationThreshold;
  }
  function setMaxPriceDeviationThreshold(uint256 _maxPriceDeviationThreshold, address underlying, address strike) external onlyOwner {
    maxPriceDeviationThreshold[underlying][strike] = _maxPriceDeviationThreshold;
  }
  //////////////////////////////////////////////////////
  /// access-controlled state changing functionality ///
  //////////////////////////////////////////////////////
  
  /**
   * @notice Receives the response
   *
   * @param _requestId - id of the request
   * @param _underlying - response; underlying address
   * @param _strike - response; strike address
   * @param _delta - response; portfolio delta
   * @param _gamma - response; portfolio gamma
   * @param _vega - response; portfolio vega
   * @param _theta - response; portfolio theta
   * @param _callPutsValue - response; combined value of calls and puts written
   * @param _spotPrice - response; spot price at the time of update
   */
function fulfill(
    bytes32 _requestId,
    address _underlying,
    address _strike,
    int256 _delta,
    int256 _gamma,
    int256 _vega,
    int256 _theta,
    uint256 _callPutsValue,
    uint256 _spotPrice
)
    external
  {
    Types.PortfolioValues memory portfolioValue = Types.PortfolioValues({
        delta: _delta,
        gamma: _gamma,
        vega: _vega,
        theta: _theta,
        callPutsValue: _callPutsValue,
        spotPrice: _spotPrice,
        timestamp: block.timestamp
    });
    portfolioValues[_underlying][_strike] = portfolioValue;
    liquidityPool.resetEphemeralValues();
    emit DataFullfilled(_underlying, _strike, _delta, _gamma, _vega, _theta, _callPutsValue);
  }

/**
 * @notice Witdraws LINK from the contract
 * @dev Implement a withdraw function to avoid locking your LINK in the contract
 */
function withdrawLink(uint256 _amount) external onlyOwner {
  LinkTokenInterface(link).transfer(msg.sender, _amount);
}

  /////////////////////////////////////////////
  /// external state changing functionality ///
  /////////////////////////////////////////////

  /**
   * @notice Creates a Chainlink request to update portfolio values
   * data, then multiply by 1000000000000000000 (to remove decimal places from data).
   *
   * @return requestId - id of the request
   */
  function requestPortfolioData(address _underlying, address _strike) external returns (bytes32 requestId) {
    return 0;
    // Chainlink.Request memory request = buildChainlinkRequest(
    //   jobId,
    //   address(this),
    //   this.fulfill.selector
    // );
    // string memory underlyingString = stringedAddresses[_underlying];
    // string memory strikeString = stringedAddresses[_strike];
    // request.add("endpoint", "portfolio-values");
    // request.add("underlying", underlyingString);
    // request.add("strike", strikeString);

    // // Multiply the result by 1000000000000000000 to remove decimals
    // int256 timesAmount = 10**18;
    // request.addInt("times", timesAmount);

    // // Sends the request
    // return sendChainlinkRequestTo(oracle, request, fee);
  }

  ///////////////////////////
  /// non-complex getters ///
  ///////////////////////////

  function getPortfolioValues(
    address underlying,
    address strike
  ) external 
    view
    returns (Types.PortfolioValues memory) {
        return portfolioValues[underlying][strike];
    }

  /**
   * @notice get the latest oracle fed portfolio values and check when they were last updated and make sure this is within a reasonable window
   */
  function validatePortfolioValues(address underlying, address strike, uint256 spotPrice) external view {
      uint256 timeDelta = block.timestamp - portfolioValues[underlying][strike].timestamp;
      // If too much time has passed we want to prevent a possible oracle attack
      if (timeDelta > maxTimeDeviationThreshold[underlying][strike]) { revert TimeDeltaExceedsThreshold(timeDelta); }
      uint256 priceDelta = OptionsCompute.calculatePercentageDifference(spotPrice, portfolioValues[underlying][strike].spotPrice);
      // If price has deviated too much we want to prevent a possible oracle attack
      if (priceDelta > maxPriceDeviationThreshold[underlying][strike]) { revert PriceDeltaExceedsThreshold(priceDelta); }
  }
}
