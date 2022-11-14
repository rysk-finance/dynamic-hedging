// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";

import "../PriceFeed.sol";

import "../libraries/AccessControl.sol";
import "../libraries/OptionsCompute.sol";
import "../libraries/SafeTransferLib.sol";

import "../interfaces/ILiquidityPool.sol";
import "../interfaces/IHedgingReactor.sol";
import "../interfaces/IRouter.sol";
import "../interfaces/IPositionRouter.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

import "hardhat/console.sol";

/**
 *  @title A hedging reactor that will manage delta by opening or closing short or long perp positions using rage trade
 *  @dev interacts with LiquidityPool via hedgeDelta, getDelta, getPoolDenominatedValue and withdraw,
 *       interacts with Rage Trade and chainlink via the change position, update and sync
 */

contract GmxHedgingReactor is IHedgingReactor, AccessControl {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;
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

	mapping(bytes32 => int256) public orderDeltaChange;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	/// @notice address of the keeper of this pool
	mapping(address => bool) public keeper;
	/// @notice desired healthFactor of the pool
	uint256 public healthFactor = 5_000;
	/// @notice should change position also sync state
	bool public syncOnChange;
	/// @notice the GMX position router contract
	IPositionRouter public gmxPositionRouter;
	/// @notice the GMX Router contract
	IRouter public router;

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

	//////////////
	/// events ///
	//////////////

	event CreateIncreasePosition(bytes32 positionKey);

	///////////////
	/// structs ///
	///////////////

	constructor(
		address _gmxPositionRouter,
		address _gmxRouter,
		address _collateralAsset,
		address _wethAddress,
		address _parentLiquidityPool,
		address _priceFeed,
		address _authority
	) AccessControl(IAuthority(_authority)) {
		router = IRouter(_gmxRouter);
		gmxPositionRouter = IPositionRouter(_gmxPositionRouter);
		console.log(_gmxPositionRouter);
		console.log(gmxPositionRouter.isLeverageEnabled());

		router.approvePlugin(_gmxPositionRouter);
		SafeTransferLib.safeApprove(ERC20(_collateralAsset), _gmxPositionRouter, MAX_UINT);
		parentLiquidityPool = _parentLiquidityPool;
		wETH = _wethAddress;
		collateralAsset = _collateralAsset;
		priceFeed = _priceFeed;
	}

	receive() external payable {}

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

	function setPositionRouter(address _gmxPositionRouter) external {
		_onlyGovernor();
		gmxPositionRouter = IPositionRouter(_gmxPositionRouter);
		router.approvePlugin(_gmxPositionRouter);
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
		if (_amount > 0) {
			// enter long position
			// if (internalDelta < 0) {
			// 	// close short position before opening long
			// }

			uint256 amountIn = OptionsCompute.convertToDecimals(
				(uint256(_amount).mul(getUnderlyingPrice(wETH, collateralAsset)) * healthFactor) / MAX_BIPS,
				ERC20(collateralAsset).decimals()
			);

			SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), amountIn);
			SafeTransferLib.safeApprove(ERC20(collateralAsset), address(router), amountIn);

			address[] memory path = new address[](2);
			path[0] = collateralAsset;
			path[1] = wETH;
			uint256 executionFee = gmxPositionRouter.minExecutionFee();
			bytes32 positionKey = gmxPositionRouter.createIncreasePosition{ value: executionFee }(
				path,
				wETH,
				amountIn,
				amountIn.div(getUnderlyingPrice(wETH, collateralAsset)).mul(995e15),
				uint256(_amount).mul(getUnderlyingPrice(wETH, collateralAsset)) * 1e12,
				true,
				getUnderlyingPrice(wETH, collateralAsset) * 1005e9, // mul by 1.005 e12 for slippage
				executionFee,
				"leverageisfun",
				address(this)
			);

			emit CreateIncreasePosition(positionKey);
			orderDeltaChange[positionKey] = _amount;
		}
		return 0;
	}

	function executeIncreasePosition(bytes32 positionKey) external {
		gmxPositionRouter.executeIncreasePosition(positionKey, payable(address(this)));
	}

	function gmxPositionCallback(
		bytes32 positionKey,
		bool isExecuted,
		bool isIncrease
	) external {
		if (isExecuted) {
			internalDelta += orderDeltaChange[positionKey];
		}
	}

	/**
	 * @notice get the underlying price with just the underlying asset and strike asset
	 * @param underlying   the asset that is used as the reference asset
	 * @param _strikeAsset the asset that the underlying value is denominated in
	 * @return the underlying price
	 */
	function getUnderlyingPrice(address underlying, address _strikeAsset)
		internal
		view
		returns (uint256)
	{
		return PriceFeed(priceFeed).getNormalizedRate(underlying, _strikeAsset);
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
