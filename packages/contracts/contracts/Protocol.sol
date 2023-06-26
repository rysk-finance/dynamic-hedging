// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./libraries/AccessControl.sol";

/**
 *  @title Contract used for storage of important contracts for the liquidity pool
 */
contract Protocol is AccessControl {
	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	address public optionRegistry;
	address public volatilityFeed;
	address public portfolioValuesFeed;
	address public accounting;
	address public priceFeed;
	address public optionExchange;

	constructor(address _authority) AccessControl(IAuthority(_authority)) {}

	///////////////
	/// setters ///
	///////////////

	function changeVolatilityFeed(address _volFeed) external {
		_onlyGovernor();
		volatilityFeed = _volFeed;
	}

	function changePortfolioValuesFeed(address _portfolioValuesFeed) external {
		_onlyGovernor();
		portfolioValuesFeed = _portfolioValuesFeed;
	}

	function changeAccounting(address _accounting) external {
		_onlyGovernor();
		accounting = _accounting;
	}

	function changePriceFeed(address _priceFeed) external {
		_onlyGovernor();
		priceFeed = _priceFeed;
	}

	function changeOptionRegistry(address _optionRegistry) external {
		_onlyGovernor();
		optionRegistry = _optionRegistry;
	}

	function changeOptionExchange(address _optionExchange) external {
		_onlyGovernor();
		optionExchange = _optionExchange;
	}
}
