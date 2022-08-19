// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./libraries/AccessControl.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/SABR.sol";

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

/**
 *  @title Contract used as the Dynamic Hedging Vault for storing funds, issuing shares and processing options transactions
 *  @dev Interacts with liquidity pool to feed in volatility data.
 */
contract VolatilityFeed is AccessControl {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;

	//////////////////////////
	/// settable variables ///
	//////////////////////////

	// Parameters for the sabr volatility model
	SABRParams public callSabrParams;
	SABRParams public putSabrParams;
	// keeper mapping
	mapping(address => bool) public keeper;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// number of seconds in a year used for calculations
	int256 private constant ONE_YEAR_SECONDS = 31557600;

	struct SABRParams{
		int256 alpha;
		int256 beta;
		int256 rho;
		int256 volvol;
	}

	constructor(address _authority) AccessControl(IAuthority(_authority)) {}

	///////////////
	/// setters ///
	///////////////

	/**
	 * @notice set the sabr volatility params
	 * @param sabrParams set the SABR parameters
	 * @param isPut the option type, put or call?
	 * @dev   only keepers can call this function
	 */
	function setSabrParameters(SABRParams memory sabrParams, bool isPut) external {
		_isKeeper();
		if (!isPut) {
			callSabrParams = sabrParams;
		} else {
			putSabrParams = sabrParams;
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
		int256 time = (int256(expiration) - int256(block.timestamp)).div(ONE_YEAR_SECONDS);
		int256 vol;
		if (!isPut) {
			vol = SABR.lognormalVol(
				int256(strikePrice), 
				int256(underlyingPrice),
				time, 
				callSabrParams.alpha, 
				callSabrParams.beta, 
				callSabrParams.rho, 
				callSabrParams.volvol
			);
		} else {
			vol = SABR.lognormalVol(
				int256(strikePrice), 
				int256(underlyingPrice),
				time, 
				putSabrParams.alpha, 
				putSabrParams.beta, 
				putSabrParams.rho, 
				putSabrParams.volvol
			);
		}
		if (vol <= 0){
			revert CustomErrors.IVNotFound();
		}
		return uint256(vol);	
	}

	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (
			!keeper[msg.sender] && msg.sender != authority.governor() && msg.sender != authority.manager()
		) {
			revert CustomErrors.NotKeeper();
		}
	}
}
