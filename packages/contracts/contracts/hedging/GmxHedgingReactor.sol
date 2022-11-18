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
import "../interfaces/IReader.sol";
import "../interfaces/IGmxVault.sol";

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
	/// @notice the GMX Reader contract
	IReader public reader;
	/// @notice the gmx vault contract address
	IGmxVault public vault;
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
	event CreateDecreasePosition(bytes32 positionKey);

	///////////////
	/// structs ///
	///////////////

	struct PositionData {
		uint256 positionSize;
		uint256 collateralAmount;
		address collateralType;
		uint256 averagePrice;
		uint256 realisedPnl;
		bool hasRealisedProfit;
		uint256 collateralSizeDeltaUsd;
		uint256 positionSizeDeltaUsd;
		uint256 ethDelta;
		uint256 currentPrice;
	}

	constructor(
		address _gmxPositionRouter,
		address _gmxRouter,
		address _gmxReader,
		address _gmxVault,
		address _collateralAsset,
		address _wethAddress,
		address _parentLiquidityPool,
		address _priceFeed,
		address _authority
	) AccessControl(IAuthority(_authority)) {
		router = IRouter(_gmxRouter);
		reader = IReader(_gmxReader);
		vault = IGmxVault(_gmxVault);
		gmxPositionRouter = IPositionRouter(_gmxPositionRouter);
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
		require(_delta != 0, "delta change is zero");

		// delta is passed in as the delta that the pool has so this function must hedge the opposite
		// if delta comes in negative then the pool must go long
		// if delta comes in positive then the pool must go short
		// the signs must be flipped when going into _changePosition
		// make sure the caller is the vault
		require(msg.sender == parentLiquidityPool, "!vault");
		deltaChange = _changePosition(-_delta);
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
		// _isKeeper();
		if (internalDelta == 0) {
			revert CustomErrors.NoPositionsOpen();
		}

		(bool isBelowMin, bool isAboveMax, uint256 health, uint256 collatToTransfer, uint256 positionSize) = checkVaultHealth();
		if (isBelowMin) {
			// collateral needs adding to position
			_addCollateral(collatToTransfer, internalDelta > 0);
		} else if (isAboveMax) {
			// collateral needs removing
			_removeCollateral(collatToTransfer, internalDelta > 0);
		}
	}

	function _addCollateral(uint256 _collateralAmount, bool _isLong) internal returns (bytes32 positionKey, uint256 deltaChange) {
		console.log("add collateral amount:", _collateralAmount);
		return _increasePosition(0, _collateralAmount, _isLong);
	}

	function _removeCollateral(uint256 _collateralAmount, bool _isLong) internal returns (bytes32 positionKey, uint256 deltaChange) {
		return _decreasePosition(0, _collateralAmount, _isLong);
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
		public
		view
		returns (
			bool isBelowMin,
			bool isAboveMax,
			uint256 health,
			uint256 collatToTransfer,
			uint256 positionSize
		)
	{
		if (internalDelta == 0) {
			return (false, false, 5000, 0, 0);
		}
		address[] memory indexToken = new address[](1);

		indexToken[0] = wETH;
		address[] memory collateralToken = new address[](1);
		bool[] memory isLong = new bool[](1);
		uint256[] memory position;
		if (internalDelta < 0) {
			// short position is open
			collateralToken[0] = collateralAsset;
			isLong[0] = false;
		} else {
			// long position is open
			collateralToken[0] = wETH;
			isLong[0] = true;
		}
		position = reader.getPositions(address(vault), address(this), collateralToken, indexToken, isLong);
		// position[0] = position size in USD
		// position[1] = collateral amount in USD
		// position[2] = average entry price of position
		// position[3] = entry funding rate
		// position[4] = does position have *realised* profit
		// position[5] = realised PnL
		// position[6] = timestamp of last position increase
		// position[7] = is position in profit
		// position[8] = current unrealised Pnl
		// HF = (collatSize + unrealised pnl) / positionSize
		uint256 health;
		if (position[7] == 1) {
			// position is in profit
			health = (uint256((int256(position[1]) + int256(position[8])).div(int256(position[0]))) * MAX_BIPS) / 1e18;
			assert(health >= healthFactor);
			isAboveMax = true;
			isBelowMin = false;
			console.log("bleh:", healthFactor, health, position[0]);
			collatToTransfer = ((health - healthFactor) * position[0]) / MAX_BIPS / 1e24;
			console.log("collat to transfer", collatToTransfer);
		} else {
			// position not in profit
			// more collateral needs adding
			health = (uint256((int256(position[1]) - int256(position[8])).div(int256(position[0]))) * MAX_BIPS) / 1e18;
			assert(health <= healthFactor);
			isBelowMin = true;
			isAboveMax = false;
			console.log("bleh:", healthFactor, health, position[0]);
			collatToTransfer = ((healthFactor - health) * position[0]) / MAX_BIPS / 1e24;
			console.log("collat to transfer", collatToTransfer);
		}
		return (isBelowMin, isAboveMax, health, collatToTransfer, position[0]);
	}

	//////////////////////////
	/// internal utilities ///
	//////////////////////////

	/** @notice function to handle logic of when to open and close positions
			GMX handles shorts and longs separately, so we only want to have either a short OR a long open 
			at any one time to aavoid paying borrow fees both ways.
			This function will close off any shorts before opening longs and vice versa.
      @param _amount the amount of delta to change exposure by
      @return deltaChange The resulting difference in delta exposure
  */
	function _changePosition(int256 _amount) internal returns (int256) {
		// collateralSize will be used to calculate how much collateral needs to be added or removed from position
		// calculated as the difference in collateral needed to adjust position size and move health factor back to target
		uint256 collateralSize;
		if (_amount > 0) {
			// enter long position
			// if (internalDelta < 0) {
			// 	// close short position before opening long
			// }

			// calculate amount of collateral to post in USDC
			// equal to collateral needed for extra margin plus rebalancing collateral to bring health factor back to 5000
			// rebalancing collateral is positive if current health factor is under target and negative if over target
			(bool isBelowMin, bool isAboveMax, uint256 health, uint256 collatToTransfer, uint256 positionSize) = checkVaultHealth();
			uint256 extraPositionCollateral = OptionsCompute.convertToDecimals(
				(uint256(_amount).mul(getUnderlyingPrice(wETH, collateralAsset)) * healthFactor) / MAX_BIPS,
				ERC20(collateralAsset).decimals()
			);
			int256 rebalancingCollateral = (int256(health) - int256(healthFactor)) / int256(MAX_BIPS);
			uint256 totalCollateralToAdd;
			if (-rebalancingCollateral > int256(extraPositionCollateral)) {
				// in this case there is a net collateral withdrawal needed which cannot be done with increasePosition
				// so just dont add any more collateral and have it rebalance later
				totalCollateralToAdd = 0;
			} else {
				// otherwise add the two collateral requirement parts to obtain total collateral input
				totalCollateralToAdd = uint256(int256(extraPositionCollateral) + rebalancingCollateral);
			}
			console.log("collateral parts:", extraPositionCollateral, uint256(rebalancingCollateral));
			console.log("pre position size:", uint256(_amount));
			// -------- BELOW LINE ONLY FOR DECREASE!
			uint256 adjustedPositionSize = _adjustedReducePositionSize(uint256(_amount));
			console.log("post position size", adjustedPositionSize);
			(bytes32 positionKey, uint256 deltaChange) = _increasePosition(uint256(_amount), totalCollateralToAdd, true);
			orderDeltaChange[positionKey] = _amount;
		} else {
			// _amount is negative
			// enter a short position
			if (internalDelta > 0) {
				// close longs first
				(bytes32 positionKey, uint256 deltaChange) = _decreasePosition(uint256(-_amount), 0, true);
				orderDeltaChange[positionKey] = -int256(deltaChange);
			}
		}
		return 0;
	}

	/*
		@notice internal function to handle increasing position size on GMX
		@param _size ETH denominated size to increase position by. e18
		
	*/
	function _increasePosition(
		uint256 _size,
		uint256 _collateralSize,
		bool _isLong
	) internal returns (bytes32 positionKey, uint256 deltaChange) {
		console.log("positionSize", _size);
		// take that amount of collateral from the Liquidity Pool and approve to GMX
		SafeTransferLib.safeTransferFrom(collateralAsset, parentLiquidityPool, address(this), _collateralSize);
		SafeTransferLib.safeApprove(ERC20(collateralAsset), address(router), _collateralSize);

		address[] memory path = new address[](2);
		path[0] = collateralAsset;
		path[1] = wETH;
		bytes32 positionKey = gmxPositionRouter.createIncreasePosition{ value: gmxPositionRouter.minExecutionFee() }(
			path,
			wETH,
			_collateralSize,
			(_collateralSize * 1e12).div(getUnderlyingPrice(wETH, collateralAsset)).mul(995e15),
			_size.mul(getUnderlyingPrice(wETH, collateralAsset)) * 1e12,
			_isLong,
			getUnderlyingPrice(wETH, collateralAsset) * 1005e9, // mul by 1.005 e12 for slippage
			gmxPositionRouter.minExecutionFee(),
			"leverageisfun",
			address(this)
		);
		console.log("min amount out", (_collateralSize * 1e12).div(getUnderlyingPrice(wETH, collateralAsset)).mul(995e15));
		emit CreateIncreasePosition(positionKey);
		return (positionKey, _size);
	}

	function _decreasePosition(
		uint256 _size,
		uint256 _collateralSize,
		bool _isLong
	) internal returns (bytes32 positionKey, uint256 deltaChange) {
		address _collateralAsset = collateralAsset;
		address _wETH = wETH;
		PositionData memory positionData = _getPosition(_isLong);
		positionData.currentPrice = getUnderlyingPrice(_wETH, _collateralAsset);

		// address[] memory path = new address[](2);
		// path[0] = _wETH;
		// path[1] = collateralAsset;
		// address[] memory path = _createPath();
		// calculate amount of collateral to withdraw in USDC
		// without rebalancing collateral this would be equal to (_size / abs(internalDelta)) * collateral

		positionData.collateralSizeDeltaUsd = OptionsCompute.convertToDecimals(
			_size.div(uint256(internalDelta.abs())).mul(positionData.collateralAmount / 1e12),
			ERC20(_collateralAsset).decimals()
		);

		// calculate change in dollar value of position
		// equal to (_size / abs(internalDelta)) * positionSize
		// expressed in e30 decimals
		_getPositionSizeDeltaUsd(positionData);

		// console.log("price:", price);
		console.log("minOut:", _size.mul(positionData.currentPrice).mul(900e15));
		console.log("collat delta usd", positionData.collateralSizeDeltaUsd);
		bytes32 positionKey = gmxPositionRouter.createDecreasePosition{ value: gmxPositionRouter.minExecutionFee() }(
			_createPath(),
			_wETH,
			positionData.collateralSizeDeltaUsd,
			positionData.positionSizeDeltaUsd,
			_isLong,
			address(this),
			positionData.currentPrice * 995e9, // mul by 0.995 e12 for slippage
			// _size.mul(positionData.currentPrice).mul(900e15),
			0,
			gmxPositionRouter.minExecutionFee(),
			false,
			address(this)
		);
		emit CreateDecreasePosition(positionKey);
		return (positionKey, _size);
	}

	// ------ Internal functions for creating increase/decrease position parameters

	function _adjustedReducePositionSize(uint256 _size) private view returns (uint256 _adjustedSize) {
		return uint256(internalDelta.abs()) > _size ? _size : uint256(internalDelta.abs());
	}

	function _getPosition(bool _isLong) private view returns (PositionData memory positionData) {
		positionData.collateralType = _isLong ? wETH : collateralAsset;
		(
			positionData.positionSize,
			positionData.collateralAmount,
			positionData.averagePrice,
			,
			,
			positionData.realisedPnl,
			positionData.hasRealisedProfit,

		) = vault.getPosition(address(this), positionData.collateralType, wETH, true);
	}

	function _createPath() internal view returns (address[] memory) {
		address[] memory path = new address[](2);
		path[0] = wETH;
		path[1] = collateralAsset;
		return path;
	}

	function _getCollateralSizeDeltaUsd(PositionData memory positionData) private view returns (uint256) {
		return
			OptionsCompute.convertToDecimals(
				positionData.ethDelta.div(uint256(internalDelta.abs())).mul(positionData.collateralAmount / 1e12),
				ERC20(collateralAsset).decimals()
			);
	}

	function _getPositionSizeDeltaUsd(PositionData memory positionData) private view returns (uint256) {
		positionData.positionSizeDeltaUsd = positionData.ethDelta.div(uint256(internalDelta.abs())).mul(positionData.positionSize);
	}

	// ----- temporary functions to allow me to execute the position requests

	function executeIncreasePosition(bytes32 positionKey) external {
		gmxPositionRouter.executeIncreasePosition(positionKey, payable(address(this)));
	}

	function executeDecreasePosition(bytes32 positionKey) external {
		gmxPositionRouter.executeDecreasePosition(positionKey, payable(address(this)));
	}

	// call back function which confirms execution or cancellation of position
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
	function getUnderlyingPrice(address underlying, address _strikeAsset) internal view returns (uint256) {
		return PriceFeed(priceFeed).getNormalizedRate(underlying, _strikeAsset);
	}

	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (!keeper[msg.sender] && msg.sender != authority.governor() && msg.sender != authority.manager() && msg.sender != parentLiquidityPool) {
			revert CustomErrors.NotKeeper();
		}
	}
}
