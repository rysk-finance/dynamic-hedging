// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./libraries/AccessControl.sol";

/**
 *  @title Contract used for storage of important contracts for the liquidity pool
 */
contract Protocol is AccessControl {
	////////////////////////
	/// static variables ///
	////////////////////////

	address public immutable optionRegistry;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	address public volatilityFeed;
	address public portfolioValuesFeed;
	address public priceFeed;

	constructor(
		address _optionRegistry,
		address _priceFeed,
		address _volatilityFeed,
		address _portfolioValuesFeed,
		address _authority
	) AccessControl(IAuthority(_authority)) {
		optionRegistry = _optionRegistry;
		priceFeed = _priceFeed;
		volatilityFeed = _volatilityFeed;
		portfolioValuesFeed = _portfolioValuesFeed;
	}

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

	function changePriceFeed(address _priceFeed) external {
		_onlyGovernor();
		priceFeed = _priceFeed;
	}
}
