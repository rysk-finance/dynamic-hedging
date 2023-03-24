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
		bool premiumTooSmall;
	}

	struct OptionStrikeDrill {
		uint128 strike;
		TradingSpec bid; // sell
		TradingSpec ask; // buy
		int256 delta;
		int256 exposure;
	}

	struct OptionExpirationDrill {
		uint64 expiration;
		uint128[] callStrikes;
		OptionStrikeDrill[] callOptionDrill;
		uint128[] putStrikes;
		OptionStrikeDrill[] putOptionDrill;
		uint256 underlyingPrice;
	}

	struct OptionChain {
		uint64[] expirations;
		OptionExpirationDrill[] optionExpirationDrills;
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

	function getOptionChain() external view returns (OptionChain memory) {
		return _getOptionChain();
	}

	function getExpirations() external view returns (uint64[] memory) {
		return catalogue.getExpirations();
	}

	function getOptionExpirationDrill(
		uint64 expiration
	) external view returns (OptionExpirationDrill memory) {
		return _constructExpirationDrill(expiration);
	}

	function _constructExpirationDrill(
		uint64 expiration
	) internal view returns (OptionExpirationDrill memory) {
		uint128[] memory callStrikes = catalogue.getOptionDetails(expiration, false);
		uint128[] memory putStrikes = catalogue.getOptionDetails(expiration, true);
		uint256 underlyingPrice = _getUnderlyingPrice(underlyingAsset, strikeAsset);
		OptionStrikeDrill[] memory callStrikeDrill = _constructStrikesDrill(
			expiration,
			callStrikes,
			false,
			underlyingPrice
		);
		OptionStrikeDrill[] memory putStrikeDrill = _constructStrikesDrill(
			expiration,
			putStrikes,
			true,
			underlyingPrice
		);
		OptionExpirationDrill memory optionExpirationDrill = OptionExpirationDrill(
			expiration,
			callStrikes,
			callStrikeDrill,
			putStrikes,
			putStrikeDrill,
			underlyingPrice
		);
		return optionExpirationDrill;
	}

	function _getOptionChain() internal view returns (OptionChain memory) {
		uint64[] memory allExpirations = catalogue.getExpirations();
		bool[] memory expirationMask = new bool[](allExpirations.length);
		uint8 validCount;
		OptionChain memory optionChain;
		for (uint i; i < allExpirations.length; i++) {
			if (allExpirations[i] < block.timestamp) {
				continue;
			}
			if ((allExpirations[i] - 28800) % 86400 != 0) {
				continue;
			}
			expirationMask[i] = true;
			validCount++;
		}
		uint64[] memory expirations = new uint64[](validCount);
		uint8 c;
		for (uint i; i < expirationMask.length; i++) {
			if (expirationMask[i]) {
				expirations[c] = allExpirations[i];
				c++;
			}
		}
		OptionExpirationDrill[] memory optionExpirationDrills = new OptionExpirationDrill[](validCount);
		for (uint i; i < expirations.length; i++) {
			optionExpirationDrills[i] = _constructExpirationDrill(expirations[i]);
		}
		optionChain.expirations = expirations;
		optionChain.optionExpirationDrills = optionExpirationDrills;
		return optionChain;
	}

	function _constructStrikesDrill(
		uint64 expiration,
		uint128[] memory strikes,
		bool isPut,
		uint256 underlyingPrice
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
				true,
				underlyingPrice
			);
			(TradingSpec memory askTradingSpec, ) = _constructTradingSpec(
				expiration,
				strikes[j],
				isPut,
				netDhvExposure,
				false,
				underlyingPrice
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
		uint64 expiration,
		uint128 strike,
		bool isPut,
		int256 netDhvExposure,
		bool isSell,
		uint256 underlyingPrice
	) internal view returns (TradingSpec memory, int256 delta) {
		OptionCatalogue.OptionStores memory stores = catalogue.getOptionStores(
			keccak256(abi.encodePacked(expiration, strike, isPut))
		);
		uint256 premium;
		uint256 fee;

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

		return (
			TradingSpec(
				_getIv(isPut, strike, expiration, underlyingPrice),
				premium,
				fee,
				isSell ? !stores.isSellable : !stores.isBuyable,
				((premium >> 3) > fee) ? false : true
			),
			delta
		);
	}

	function _getIv(
		bool isPut,
		uint128 strike,
		uint256 expiration,
		uint256 underlyingPrice
	) internal view returns (uint256 iv) {
		try
			_getVolatilityFeed().getImpliedVolatility(isPut, underlyingPrice, strike, expiration)
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
