// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./interfaces/AggregatorV3Interface.sol";

import "./libraries/AccessControl.sol";

/**
 *  @title Contract used for accessing exchange rates using chainlink price feeds
 *  @dev Interacts with chainlink price feeds and services all contracts in the system for price data.
 */
contract PriceFeed is AccessControl {
	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	mapping(address => mapping(address => address)) public priceFeeds;
	address public sequencerUptimeFeedAddress;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	uint8 private constant SCALE_DECIMALS = 18;
	// seconds since the last price feed update until we deem the data to be stale
	uint32 private constant STALE_PRICE_DELAY = 3600;
	// seconds after arbitrum sequencer comes back online that we start accepting price feed data
	uint32 private constant GRACE_PERIOD_TIME = 1800; // 30 minutes

	//////////////
	/// errors ///
	//////////////

	error SequencerDown();
	error GracePeriodNotOver();

	constructor(address _authority, address _sequencerUptimeFeedAddress)
		AccessControl(IAuthority(_authority))
	{
		sequencerUptimeFeedAddress = _sequencerUptimeFeedAddress;
	}

	///////////////
	/// setters ///
	///////////////

	function addPriceFeed(
		address underlying,
		address strike,
		address feed
	) public {
		_onlyGovernor();
		priceFeeds[underlying][strike] = feed;
	}

	function setSequencerUptimeFeedAddress(address _sequencerUptimeFeedAddress) external {
		_onlyGovernor();
		sequencerUptimeFeedAddress = _sequencerUptimeFeedAddress;
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	function getRate(address underlying, address strike) external view returns (uint256) {
		address feedAddress = priceFeeds[underlying][strike];
		require(feedAddress != address(0), "Price feed does not exist");
		AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
		// check arbitrum sequencer status
		_checkSequencerUp();
		(uint80 roundId, int256 rate, , uint256 timestamp, uint80 answeredInRound) = feed
			.latestRoundData();
		require(rate > 0, "ChainLinkPricer: price is lower than 0");
		require(timestamp != 0, "ROUND_NOT_COMPLETE");
		require(block.timestamp <= timestamp + STALE_PRICE_DELAY, "STALE_PRICE");
		require(answeredInRound >= roundId, "STALE_PRICE");
		return uint256(rate);
	}

	/// @dev get the rate from chainlink and convert it to e18 decimals
	function getNormalizedRate(address underlying, address strike) external view returns (uint256) {
		address feedAddress = priceFeeds[underlying][strike];
		require(feedAddress != address(0), "Price feed does not exist");
		AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
		uint8 feedDecimals = feed.decimals();
		// check arbitrum sequencer status
		_checkSequencerUp();
		(uint80 roundId, int256 rate, , uint256 timestamp, uint80 answeredInRound) = feed
			.latestRoundData();

		require(rate > 0, "ChainLinkPricer: price is lower than 0");
		require(timestamp != 0, "ROUND_NOT_COMPLETE");
		require(block.timestamp <= timestamp + STALE_PRICE_DELAY, "STALE_PRICE");
		require(answeredInRound >= roundId, "STALE_PRICE_ROUND");
		uint8 difference;
		if (SCALE_DECIMALS > feedDecimals) {
			difference = SCALE_DECIMALS - feedDecimals;
			return uint256(rate) * (10**difference);
		}
		difference = feedDecimals - SCALE_DECIMALS;
		return uint256(rate) / (10**difference);
	}

	function _checkSequencerUp() internal view {
		AggregatorV3Interface sequencerUptimeFeed = AggregatorV3Interface(sequencerUptimeFeedAddress);
		(, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();
		bool isSequencerUp = answer == 0;
		if (!isSequencerUp) {
			revert SequencerDown();
		}

		uint256 timeSinceUp = block.timestamp - startedAt;
		if (timeSinceUp <= GRACE_PERIOD_TIME) {
			revert GracePeriodNotOver();
		}
	}
}
