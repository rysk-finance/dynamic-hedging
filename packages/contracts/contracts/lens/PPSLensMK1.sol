// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../Protocol.sol";
import "../PriceFeed.sol";
import "../BeyondPricer.sol";
import "../VolatilityFeed.sol";
import "../OptionCatalogue.sol";
import "../libraries/Types.sol";
import "../AlphaPortfolioValuesFeed.sol";
import "../interfaces/IOptionRegistry.sol";

import "prb-math/contracts/PRBMathUD60x18.sol";

/**
 *  @title Lens contract to get the live price per share
 */
contract PPSLensMK1 {
	using PRBMathUD60x18 for uint256;
	// Protocol contracts
	Protocol public protocol;
	ILiquidityPool public liquidityPool;
	// asset that is used for collateral asset
	address public collateralAsset;
	address public underlyingAsset;
	address public strikeAsset;

	int256 private constant SCALE = 1e18;

	constructor(
		address _protocol,
		address _collateralAsset,
		address _underlyingAsset,
		address _strikeAsset,
		address _liquidityPool
	) {
		protocol = Protocol(_protocol);
		collateralAsset = _collateralAsset;
		underlyingAsset = _underlyingAsset;
		strikeAsset = _strikeAsset;
		liquidityPool = ILiquidityPool(_liquidityPool);
	}

	function getCurrentPricePerShare() external view returns (uint256, uint256) {
		// get the total supply of shares
		uint256 totalSupply = liquidityPool.totalSupply();
		// get the assets
		int256 assets = int256(liquidityPool.getAssets());
		// get the liabilities
		Types.PortfolioValues memory portfolioValues = computeOptionsValues();
		int256 liabilities = portfolioValues.callPutsValue;
		// compute the price per share
		uint256 nav = uint256(assets - liabilities);
		uint256 pricePerShare = (1e18 *
			(nav -
			OptionsCompute.convertFromDecimals(liquidityPool.pendingDeposits(), 6))) /
			totalSupply;
		return (pricePerShare, block.timestamp);
	}

	function computeOptionsValues() public view returns (Types.PortfolioValues memory) {
		AlphaPortfolioValuesFeed pv = getPortfolioValuesFeed();
		int256 delta;
		int256 callPutsValue;
		// get the length of the address set here to save gas on the for loop
		address[] memory seriesAddresses = pv.getAddressSet();
		uint256 lengthAddy = seriesAddresses.length;
		// get the spot price
		uint256 spotPrice = _getUnderlyingPrice(underlyingAsset, strikeAsset);
		VolatilityFeed volFeed = _getVolatilityFeed();
		for (uint256 i = 0; i < lengthAddy; i++) {
			// get series
			(Types.OptionSeries memory optionSeries, int256 shortExposure, int256 longExposure) = pv
				.storesForAddress(seriesAddresses[i]);
			// check if the series has expired, if it has then flag this,
			// before retrying, settle all expired options and then clean the looper
			if (optionSeries.expiration < block.timestamp) {
				continue;
			}
			// get the vol
			(uint256 vol, uint256 forward) = volFeed.getImpliedVolatilityWithForward(
				optionSeries.isPut,
				spotPrice,
				optionSeries.strike,
				optionSeries.expiration
			);
			// compute the delta and the price
			(uint256 _callPutsValue, int256 _delta) = BlackScholes.blackScholesCalcGreeks(
				forward,
				optionSeries.strike,
				optionSeries.expiration,
				vol,
				0,
				optionSeries.isPut
			);
			_callPutsValue = _callPutsValue.mul(spotPrice).div(forward);
			// calculate the net exposure
			int256 netExposure = shortExposure - longExposure;
			// increment the deltas by adding if the option is long and subtracting if the option is short
			delta -= (_delta * netExposure) / SCALE;
			// increment the values by subtracting if the option is long (as this represents liabilities in the liquidity pool) and adding if the option is short as this value
			// represents liabilities
			callPutsValue += (int256(_callPutsValue) * netExposure) / SCALE;
		}
		// update the portfolio values
		Types.PortfolioValues memory portfolioValue = Types.PortfolioValues({
			delta: delta,
			gamma: 0,
			vega: 0,
			theta: 0,
			callPutsValue: callPutsValue,
			spotPrice: spotPrice,
			timestamp: block.timestamp
		});
		return portfolioValue;
	}

	///////////////////////////
	/// non-complex getters ///
	///////////////////////////

	/**
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function getPortfolioValuesFeed() internal view returns (AlphaPortfolioValuesFeed) {
		return AlphaPortfolioValuesFeed(protocol.portfolioValuesFeed());
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
