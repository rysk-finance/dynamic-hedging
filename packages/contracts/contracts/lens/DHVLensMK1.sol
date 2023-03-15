// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../Protocol.sol";
import "../PriceFeed.sol";
import "../BeyondPricer.sol";
import "../VolatilityFeed.sol";
import "../OptionCatalogue.sol";
import "../libraries/Types.sol";
import "../interfaces/IAlphaPortfolioValuesFeed.sol";

/**
 *  @title Lens contract to view parameters of the protocol that require too much computation for a frontend
 */
contract DHVLensMK1 {
	// Protocol contracts
	Protocol public protocol;
	OptionCatalogue public catalogue;
	BeyondPricer public pricer;
	// asset that denominates the strike price
	address public strikeAsset;
	// asset that is used as the reference asset
	address public underlyingAsset;
	// asset that is used for collateral asset
	address public collateralAsset;

	// BIPS
	uint256 private constant MAX_BPS = 10_000;

	///////////////
	/// structs ///
	///////////////

	struct TradingSpec {
		uint256 iv;
		uint256 quote;
		uint256 fee;
		bool disabled;
	}

	struct OptionStrikeDrill {
		uint256 strike;
		TradingSpec bid; // buy
		TradingSpec ask; // sell
		int256 delta;
		int256 exposure;
	}

	struct OptionExpiryDrill {
		uint256 expiry;
		OptionStrikeDrill[] callOptionDrill;
		OptionStrikeDrill[] putOptionDrill;
	}
	struct OptionChainStruct {
		OptionExpiryDrill[] optionExpiryDrills;
	}

	constructor(
		address _protocol,
		address _catalogue,
		address _pricer,
		address _collateralAsset,
		address _underlyingAsset,
		address _strikeAsset
	) {
		protocol = Protocol(_protocol);
		collateralAsset = _collateralAsset;
		underlyingAsset = _underlyingAsset;
		strikeAsset = _strikeAsset;
		catalogue = OptionCatalogue(_catalogue);
		pricer = BeyondPricer(_pricer);
	}

	function getOptionChain() external view returns (OptionChainStruct memory) {
		return _getOptionChain();
	}

	function _getOptionChain() internal view returns (OptionChainStruct memory) {
		uint64[] memory expirations = catalogue.getExpirations();
		OptionChainStruct memory optionChain;
		OptionExpiryDrill[] memory optionExpiryDrills = new OptionExpiryDrill[](expirations.length);
		for (uint i; i < expirations.length; i++) {
			uint128[] memory callStrikes = catalogue.getOptionDetails(expirations[i], false);
			uint128[] memory putStrikes = catalogue.getOptionDetails(expirations[i], true);
			OptionStrikeDrill[] memory callStrikeDrill = _constructStrikesDrill(
				expirations[i],
				callStrikes,
				false
			);
			OptionStrikeDrill[] memory putStrikeDrill = _constructStrikesDrill(
				expirations[i],
				putStrikes,
				true
			);
			OptionExpiryDrill memory optionExpiryDrill = OptionExpiryDrill(
				expirations[i],
				callStrikeDrill,
				putStrikeDrill
			);
			optionExpiryDrills[i] = optionExpiryDrill;
		}
		optionChain.optionExpiryDrills = optionExpiryDrills;
		return optionChain;
	}

	function _constructStrikesDrill(
		uint256 expiration,
		uint128[] memory strikes,
		bool isPut
	) internal view returns (OptionStrikeDrill[] memory) {
		OptionStrikeDrill[] memory optionStrikeDrills = new OptionStrikeDrill[](strikes.length);
		for (uint j; j < strikes.length; j++) {
			// get the hash of the option (how the option is stored on the books)
			bytes32 optionHash = keccak256(abi.encodePacked(expiration, strikes[j], isPut));
			int256 netDhvExposure = getPortfolioValuesFeed().netDhvExposure(optionHash);
			(TradingSpec memory bidTradingSpec, int256 delta) = _constructTradingSpec(
				expiration,
				strikes[j],
				isPut,
				netDhvExposure,
				optionHash,
				false
			);
			(TradingSpec memory askTradingSpec, ) = _constructTradingSpec(
				expiration,
				strikes[j],
				isPut,
				netDhvExposure,
				optionHash,
				true
			);
			OptionStrikeDrill memory optionStrikeDrill = OptionStrikeDrill(
				strikes[j],
				bidTradingSpec,
				askTradingSpec,
				delta,
				netDhvExposure
			);
			optionStrikeDrills[j] = optionStrikeDrill;
		}
		return optionStrikeDrills;
	}

	function _constructTradingSpec(
		uint256 expiration,
		uint128 strike,
		bool isPut,
		int256 netDhvExposure,
		bytes32 optionHash,
		bool isSell
	) internal view returns (TradingSpec memory, int256 delta) {
		OptionCatalogue.OptionStores memory stores = catalogue.getOptionStores(optionHash);
		uint256 premium;
		int256 delta;
		uint256 fee;
		uint256 iv;

		try
			pricer.quoteOptionPrice(
				Types.OptionSeries(
					uint64(expiration),
					strike,
					isPut,
					underlyingAsset,
					strikeAsset,
					collateralAsset
				),
				1e18,
				isSell,
				netDhvExposure
			)
		returns (uint256 _premium, int256 _delta, uint256 _fee) {
			premium = _premium;
			delta = _delta;
			fee = _fee;
		} catch {
			premium = 418;
			delta = 418;
			fee = 418;
		}
		// retrieve iv
		iv = _getIv(isPut, strike, expiration);

		// check and switch disabled
		bool disabled = isSell ? stores.isSellable : stores.isBuyable;
		return (TradingSpec(iv, premium, fee, disabled), delta);
	}

	function _getIv(
		bool isPut,
		uint128 strike,
		uint256 expiration
	) internal view returns (uint256 iv) {
		try
			_getVolatilityFeed().getImpliedVolatility(
				isPut,
				_getUnderlyingPrice(underlyingAsset, strikeAsset),
				strike,
				expiration
			)
		returns (uint256 _iv) {
			iv = _iv;
		} catch {
			iv = 418;
		}
	}

	///////////////////////////
	/// non-complex getters ///
	///////////////////////////

	/**
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function getPortfolioValuesFeed() internal view returns (IAlphaPortfolioValuesFeed) {
		return IAlphaPortfolioValuesFeed(protocol.portfolioValuesFeed());
	}

	/**
	 * @notice get the underlying price with just the underlying asset and strike asset
	 * @param underlying   the asset that is used as the reference asset
	 * @param _strikeAsset the asset that the underlying value is denominated in
	 * @return the underlying price
	 */
	function _getUnderlyingPrice(
		address underlying,
		address _strikeAsset
	) internal view returns (uint256) {
		return PriceFeed(protocol.priceFeed()).getNormalizedRate(underlying, _strikeAsset);
	}

	/**
	 * @notice get the volatility feed used by the liquidity pool
	 * @return the volatility feed contract interface
	 */
	function _getVolatilityFeed() internal view returns (VolatilityFeed) {
		return VolatilityFeed(protocol.volatilityFeed());
	}
}
