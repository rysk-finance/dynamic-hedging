// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./libraries/AccessControl.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";

contract VolatilityFeed is AccessControl {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	// skew parameters for calls
	int256[7] public callsVolatilitySkew;
	// skew parameters for puts
	int256[7] public putsVolatilitySkew;
	// keeper mapping
	mapping(address => bool) public keeper;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// number of seconds in a year used for calculations
	uint256 private constant ONE_YEAR_SECONDS = 31557600;

	constructor(address _authority) AccessControl(IAuthority(_authority)) {}

	///////////////
	/// setters ///
	///////////////

	/**
	 * @notice set the volatility skew of the pool
	 * @param values the parameters of the skew
	 * @param isPut the option type, put or call?
	 * @dev   only governance can call this function
	 */
	function setVolatilitySkew(int256[7] calldata values, bool isPut) external {
		_isKeeper();
		if (!isPut) {
			callsVolatilitySkew = values;
		} else {
			putsVolatilitySkew = values;
		}
	}

	/// @notice update the keepers
	function setKeeper(address _keeper, bool _auth) external {
		_onlyGovernor();
		keeper[_keeper] = _auth;
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	/**
	 * @notice get the current implied volatility from the feed
	 * @param isPut Is the option a call or put?
	 * @param underlyingPrice The underlying price
	 * @param strikePrice The strike price of the option
	 * @param expiration expiration timestamp of option as a PRBMath Float
	 * @return Implied volatility adjusted for volatility surface
	 */
	function getImpliedVolatility(
		bool isPut,
		uint256 underlyingPrice,
		uint256 strikePrice,
		uint256 expiration
	) external view returns (uint256) {
		uint256 time = (expiration - block.timestamp).div(ONE_YEAR_SECONDS);
		int256 underlying = int256(underlyingPrice);
		int256 spot_distance = (int256(strikePrice) - int256(underlying)).div(underlying);
		int256[2] memory points = [spot_distance, int256(time)];
		int256[7] memory coef = isPut ? putsVolatilitySkew : callsVolatilitySkew;
		return uint256(computeIVFromSkew(coef, points));
	}

	/**
	 * @notice get the volatility skew of the pool
	 * @param isPut the option type, put or call?
	 * @return the skew parameters
	 */
	function getVolatilitySkew(bool isPut) external view returns (int256[7] memory) {
		if (!isPut) {
			return callsVolatilitySkew;
		} else {
			return putsVolatilitySkew;
		}
	}

	//////////////////////////
	/// internal utilities ///
	//////////////////////////

	// @param points[0] spot distance
	// @param points[1] expiration time
	// @param coef degree-2 polynomial features are [intercept, 1, a, b, a^2, ab, b^2]
	// a == spot_distance, b == expiration time
	// spot_distance: (strike - spot_price) / spot_price
	// expiration: years to expiration
	function computeIVFromSkew(int256[7] memory coef, int256[2] memory points)
		internal
		pure
		returns (int256)
	{
		int256 iPlusC1 = coef[0] + coef[1];
		int256 c2PlusC3 = coef[2].mul(points[0]) + (coef[3].mul(points[1]));
		int256 c4PlusC5 = coef[4].mul(points[0].mul(points[0])) + (coef[5].mul(points[0]).mul(points[1]));
		return iPlusC1 + c2PlusC3 + c4PlusC5 + (coef[6].mul(points[1].mul(points[1])));
	}

	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (
			!keeper[msg.sender] && msg.sender != authority.governor() && msg.sender != authority.manager()
		) {
			revert();
		}
	}
}
