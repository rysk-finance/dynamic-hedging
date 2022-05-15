// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./libraries/AccessControl.sol";

contract Protocol is AccessControl {
	////////////////////////
	/// static variables ///
	////////////////////////

	address public optionRegistry;
	address public priceFeed;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	address public volatilityFeed;
	address public portfolioValuesFeed;

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
}
