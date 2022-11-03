// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../PriceFeed.sol";

import "../libraries/AccessControl.sol";
import "../libraries/OptionsCompute.sol";
import "../libraries/SafeTransferLib.sol";

import "../interfaces/ILiquidityPool.sol";
import "../interfaces/IHedgingReactor.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 *  @title A hedging reactor that will manage delta by opening or closing short or long perp positions using rage trade
 *  @dev interacts with LiquidityPool via hedgeDelta, getDelta, getPoolDenominatedValue and withdraw,
 *       interacts with Rage Trade and chainlink via the change position, update and sync
 */

contract GmxHedgingReactor is IHedgingReactor, AccessControl {
	/////////////////////////////////
	/// immutable state variables ///
	/////////////////////////////////

	/// @notice address of the parent liquidity pool contract
	address public immutable parentLiquidityPool;
	/// @notice address of the price feed used for getting asset prices
	address public immutable priceFeed;
	/// @notice collateralAsset used for collateralising the pool
	address public immutable collateralAsset;
	/// @notice address of the wETH contract
	address public immutable wETH;

	/////////////////////////
	/// dynamic variables ///
	/////////////////////////

	/// @notice delta of the pool
	int256 public internalDelta;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	/// @notice address of the keeper of this pool
	mapping(address => bool) public keeper;
	/// @notice desired healthFactor of the pool
	uint256 public healthFactor = 5_000;
	/// @notice should change position also sync state
	bool public syncOnChange;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	/// @notice used for unlimited token approval
	uint256 private constant MAX_UINT = 2**256 - 1;
	/// @notice max bips
	uint256 private constant MAX_BIPS = 10_000;

	//////////////
	/// errors ///
	//////////////

	error ValueFailure();
	error IncorrectCollateral();
	error IncorrectDeltaChange();
	error InvalidTransactionNotEnoughMargin(int256 accountMarketValue, int256 totalRequiredMargin);

	constructor(
		address _collateralAsset,
		address _wethAddress,
		address _parentLiquidityPool,
		address _priceFeed,
		address _authority
	) AccessControl(IAuthority(_authority)) {
		parentLiquidityPool = _parentLiquidityPool;
		wETH = _wethAddress;
		collateralAsset = _collateralAsset;
		priceFeed = _priceFeed;
	}

	///////////////
	/// setters ///
	///////////////

	/// @notice update the health factor parameter
	function setHealthFactor(uint256 _healthFactor) external {
		_onlyGovernor();
		healthFactor = _healthFactor;
	}

	/// @notice update the keepers
	function setKeeper(address _keeper, bool _auth) external {
		_onlyGovernor();
		keeper[_keeper] = _auth;
	}

	/// @notice set whether changing a position should trigger a sync before updating
	function setSyncOnChange(bool _syncOnChange) external {
		_onlyGovernor();
		syncOnChange = _syncOnChange;
	}

	////////////////////////////////////////////
	/// access-controlled external functions ///
	////////////////////////////////////////////

	/// @inheritdoc IHedgingReactor
	function hedgeDelta(int256 _delta) external returns (int256 deltaChange) {
		// delta is passed in as the delta that the pool has so this function must hedge the opposite
		// if delta comes in negative then the pool must go long
		// if delta comes in positive then the pool must go short
		// the signs must be flipped when going into _changePosition
		// make sure the caller is the vault
		require(msg.sender == parentLiquidityPool, "!vault");
		deltaChange = _changePosition(-_delta);
		// record the delta change internally
		internalDelta += deltaChange;
	}

	/// @inheritdoc IHedgingReactor
	function withdraw(uint256 _amount) external returns (uint256) {
		require(msg.sender == parentLiquidityPool, "!vault");
		// check the holdings if enough just lying around then transfer it
		// assume amount is passed in as collateral decimals
		uint256 balance = ERC20(collateralAsset).balanceOf(address(this));
		if (balance == 0) {
			return 0;
		}
		if (_amount <= balance) {
			SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, _amount);
			// return in collateral format
			return _amount;
		} else {
			SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, balance);
			// return in collateral format
			return balance;
		}
	}

	/// @inheritdoc IHedgingReactor
	function update() public returns (uint256) {
		_isKeeper();
		return 0;
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	/// @inheritdoc IHedgingReactor
	function getDelta() external view returns (int256 delta) {
		return internalDelta;
	}

	/// @inheritdoc IHedgingReactor
	function getPoolDenominatedValue() external view returns (uint256 value) {
		return 0;
	}

	/** @notice function to check the health of the margin account
	 *  @return isBelowMin is the margin below the health factor
	 *  @return isAboveMax is the margin above the health factor
	 *  @return health     the health factor of the account currently
	 *  @return collatToTransfer the amount of collateral required to return the margin account back to the health factor
	 */
	function checkVaultHealth()
		external
		view
		returns (
			bool isBelowMin,
			bool isAboveMax,
			uint256 health,
			uint256 collatToTransfer
		)
	{
		return (true, true, 0, 0);
	}

	//////////////////////////
	/// internal utilities ///
	//////////////////////////

	/** @notice function to change the perp position
        @param _amount the amount of position to open or close
        @return deltaChange The resulting difference in delta exposure
    */
	function _changePosition(int256 _amount) internal returns (int256) {
		return 0;
	}

	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (
			!keeper[msg.sender] &&
			msg.sender != authority.governor() &&
			msg.sender != authority.manager() &&
			msg.sender != parentLiquidityPool
		) {
			revert CustomErrors.NotKeeper();
		}
	}
}
