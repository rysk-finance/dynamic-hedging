// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./BlackScholes.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "./Types.sol";
import "./CustomErrors.sol";
import "hardhat/console.sol";

library OptionsCompute {
	using PRBMathUD60x18 for uint256;
	using PRBMathSD59x18 for int256;

	uint8 private constant SCALE_DECIMALS = 18;

	/// @dev assumes decimals are coming in as e18
	function convertToDecimals(uint256 value, uint256 decimals) internal pure returns (uint256) {
		if (decimals > SCALE_DECIMALS) {
			revert();
		}
		uint256 difference = SCALE_DECIMALS - decimals;
		return value / (10**difference);
	}

	function convertFromDecimals(uint256 value, uint256 decimals) internal pure returns (uint256) {
		if (decimals > SCALE_DECIMALS) {
			revert();
		}
		uint256 difference = SCALE_DECIMALS - decimals;
		return value * (10**difference);
	}

	// doesnt allow for interest bearing collateral
	function convertToCollateralDenominated(
		uint256 quote,
		uint256 underlyingPrice,
		Types.OptionSeries memory optionSeries
	) internal pure returns (uint256 convertedQuote) {
		if (optionSeries.strikeAsset != optionSeries.collateral) {
			// convert value from strike asset to collateral asset
			return (quote * 1e18) / underlyingPrice;
		} else {
			return quote;
		}
	}

	/** 
     @dev computes the percentage difference between two integers
     @param a the smaller integer
     @param b the larger integer
     @return uint256 the percentage differnce
    */
	function calculatePercentageDifference(uint256 a, uint256 b) internal pure returns (uint256) {
		if (a > b) {
			return b.div(a);
		}
		return a.div(b);
	}

	/**
	 * @notice get the latest oracle fed portfolio values and check when they were last updated and make sure this is within a reasonable window
	 */
	function validatePortfolioValues(
		uint256 spotPrice,
		Types.PortfolioValues memory portfolioValues,
		uint256 maxTimeDeviationThreshold,
		uint256 maxPriceDeviationThreshold
	) public view {
		uint256 timeDelta = block.timestamp - portfolioValues.timestamp;
		// If too much time has passed we want to prevent a possible oracle attack
		if (timeDelta > maxTimeDeviationThreshold) {
			revert CustomErrors.TimeDeltaExceedsThreshold(timeDelta);
		}
		uint256 priceDelta = calculatePercentageDifference(spotPrice, portfolioValues.spotPrice);
		// If price has deviated too much we want to prevent a possible oracle attack
		if (priceDelta > maxPriceDeviationThreshold) {
			revert CustomErrors.PriceDeltaExceedsThreshold(priceDelta);
		}
	}

	function getUtilizationPrice(
		uint256 _utilizationBefore,
		uint256 _utilizationAfter,
		uint256 _totalOptionPrice,
		uint256 _utilizationFunctionThreshold,
		uint256 _belowThresholdGradient,
		uint256 _aboveThresholdGradient,
		uint256 _aboveThresholdYIntercept
	) internal pure returns (uint256 utilizationPrice) {
		if (
			_utilizationBefore <= _utilizationFunctionThreshold &&
			_utilizationAfter <= _utilizationFunctionThreshold
		) {
			// linear function up to 50% utilization
			// adds 10% of utilization percentage on to price
			// eg at 50% utilization, options will be priced 5% more expensive
			return
				_totalOptionPrice +
				_totalOptionPrice.mul(_utilizationBefore + _utilizationAfter).mul(_belowThresholdGradient).div(
					2e18
				);
		} else if (
			_utilizationBefore >= _utilizationFunctionThreshold &&
			_utilizationAfter >= _utilizationFunctionThreshold
		) {
			// over 50% utilization the skew factor will follow a steeper line

			uint256 multiplicationFactor = _aboveThresholdGradient
				.mul(_utilizationBefore + _utilizationAfter)
				.div(2e18) - _aboveThresholdYIntercept;

			return _totalOptionPrice + _totalOptionPrice.mul(uint256(multiplicationFactor));
		} else {
			// _utilizationAfter will always be greater than _utilizationBefore
			// finds the ratio of the distance below the threshold to the distance above the threshold
			uint256 weightingRatio = (_utilizationFunctionThreshold - _utilizationBefore).div(
				_utilizationAfter - _utilizationFunctionThreshold
			);
			// finds the average y value on the part of the function below threshold
			uint256 averageFactorBelow = (_utilizationFunctionThreshold + _utilizationBefore).div(2e18).mul(
				_belowThresholdGradient
			);
			// finds average y value on part of the function above threshold
			uint256 averageFactorAbove = (_utilizationAfter + _utilizationFunctionThreshold).div(2e18).mul(
				_aboveThresholdGradient
			) - _aboveThresholdYIntercept;
			// finds the weighted average of the two above averaged to find the average utilization skew over the range of utilization
			uint256 multiplicationFactor = (weightingRatio.mul(averageFactorBelow) + averageFactorAbove).div(
				1e18 + weightingRatio
			);
			return _totalOptionPrice + _totalOptionPrice.mul(multiplicationFactor);
		}
	}

	/**
	 * @notice get the greeks of a quotePrice for a given optionSeries
	 * @param  optionSeries Types.OptionSeries struct for describing the option to price greeks - strike in e18
	 * @return quote           Quote price of the option - in e18
	 * @return delta           delta of the option being priced - in e18
	 */
	function quotePriceGreeks(
		Types.OptionSeries memory optionSeries,
		bool isBuying,
		uint256 bidAskIVSpread,
		uint256 riskFreeRate,
		uint256 iv,
		uint256 underlyingPrice
	) internal view returns (uint256 quote, int256 delta) {
		if (iv == 0) {
			revert CustomErrors.IVNotFound();
		}
		if (isBuying) {
			iv = (iv * (1e18 - (bidAskIVSpread))) / 1e18;
		}
		// revert CustomErrors.if the expiry is in the past
		if (optionSeries.expiration <= block.timestamp) {
			revert CustomErrors.OptionExpiryInvalid();
		}
		(quote, delta) = BlackScholes.blackScholesCalcGreeks(
			underlyingPrice,
			optionSeries.strike,
			optionSeries.expiration,
			iv,
			riskFreeRate,
			optionSeries.isPut
		);
	}
}
