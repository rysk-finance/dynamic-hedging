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
	mapping(uint256 => SABRParams) public sabrParams;
	// keeper mapping
	mapping(address => bool) public keeper;
	// expiry array
	uint256[] public expiries;
	// interest rate in e18 decimals
	int256 public interestRate;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// number of seconds in a year used for calculations
	int256 private constant ONE_YEAR_SECONDS = 31557600;
	int256 private constant BIPS_SCALE = 1e12;
	int256 private constant BIPS = 1e6;

	struct SABRParams {
		int32 callAlpha; // not bigger or less than an int32 and above 0
		int32 callBeta; // greater than 0 and less than or equal to 1
		int32 callRho; // between 1 and -1
		int32 callVolvol; // not bigger or less than an int32 and above 0
		int32 putAlpha;
		int32 putBeta;
		int32 putRho;
		int32 putVolvol;
	}

	constructor(address _authority) AccessControl(IAuthority(_authority)) {}

	///////////////
	/// setters ///
	///////////////

	error AlphaError();
	error BetaError();
	error RhoError();
	error VolvolError();

	event SabrParamsSet(
		uint256 indexed _expiry,
		int32 callAlpha,
		int32 callBeta,
		int32 callRho,
		int32 callVolvol,
		int32 putAlpha,
		int32 putBeta,
		int32 putRho,
		int32 putVolvol
	);

	/**
	 * @notice set the sabr volatility params
	 * @param _sabrParams set the SABR parameters
	 * @param _expiry the expiry that the SABR parameters represent
	 * @dev   only keepers can call this function
	 */
	function setSabrParameters(SABRParams memory _sabrParams, uint256 _expiry) external {
		_isKeeper();
		if (_sabrParams.callAlpha <= 0 || _sabrParams.putAlpha <= 0) {
			revert AlphaError();
		}
		if (_sabrParams.callVolvol <= 0 || _sabrParams.putVolvol <= 0) {
			revert VolvolError();
		}
		if (
			_sabrParams.callBeta <= 0 ||
			_sabrParams.callBeta > BIPS ||
			_sabrParams.putBeta <= 0 ||
			_sabrParams.putBeta > BIPS
		) {
			revert BetaError();
		}
		if (
			_sabrParams.callRho <= -BIPS ||
			_sabrParams.callRho >= BIPS ||
			_sabrParams.putRho <= -BIPS ||
			_sabrParams.putRho >= BIPS
		) {
			revert RhoError();
		}
		// if the expiry is not already a registered expiry then add it to the expiry list
		if(sabrParams[_expiry].callAlpha == 0) {
			expiries.push(_expiry);
		}
		sabrParams[_expiry] = _sabrParams;
		emit SabrParamsSet(
			_expiry,
			_sabrParams.callAlpha,
			_sabrParams.callBeta,
			_sabrParams.callRho,
			_sabrParams.callVolvol,
			_sabrParams.putAlpha,
			_sabrParams.putBeta,
			_sabrParams.putRho,
			_sabrParams.putVolvol
		);
	}

	/// @notice set the interest rate that is used to compute forward price
	function setInterestRate(
		int256 _interestRate
	) public {
		_onlyGovernor();
		interestRate = _interestRate;
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
		SABRParams memory sabrParams_ = sabrParams[expiration];
		if (sabrParams_.callAlpha == 0) {
			revert CustomErrors.IVNotFound();
		}
		int256 forwardPrice = int256(underlyingPrice).mul((PRBMathSD59x18.exp(interestRate.mul(time))));
		if (!isPut) {
			vol = SABR.lognormalVol(
				int256(strikePrice),
				forwardPrice,
				time,
				sabrParams_.callAlpha * BIPS_SCALE,
				sabrParams_.callBeta * BIPS_SCALE,
				sabrParams_.callRho * BIPS_SCALE,
				sabrParams_.callVolvol * BIPS_SCALE
			);
		} else {
			vol = SABR.lognormalVol(
				int256(strikePrice),
				forwardPrice,
				time,
				sabrParams_.putAlpha * BIPS_SCALE,
				sabrParams_.putBeta * BIPS_SCALE,
				sabrParams_.putRho * BIPS_SCALE,
				sabrParams_.putVolvol * BIPS_SCALE
			);
		}
		if (vol <= 0) {
			revert CustomErrors.IVNotFound();
		}
		return uint256(vol);
	}

	/**
	 @notice get the expiry array
	 @return the expiry array
	 */
	function getExpiries() external view returns (uint256[] memory) {
		return expiries;
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
