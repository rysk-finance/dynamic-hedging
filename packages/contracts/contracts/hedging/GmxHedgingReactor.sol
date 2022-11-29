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

		(
			bool isBelowMin,
			bool isAboveMax,
			uint256 health,
			uint256 collatToTransfer,
			uint256[] memory position
		) = checkVaultHealth();
		if (isBelowMin) {
			// collateral needs adding to position
			_addCollateral(collatToTransfer, internalDelta > 0);
		} else if (isAboveMax) {
			// collateral needs removing
			_removeCollateral(collatToTransfer, internalDelta > 0);
		}
	}

	function _addCollateral(uint256 _collateralAmount, bool _isLong)
		internal
		returns (bytes32 positionKey, int256 deltaChange)
	{
		return _increasePosition(0, _collateralAmount, _isLong);
	}

	function _removeCollateral(uint256 _collateralAmount, bool _isLong)
		internal
		returns (bytes32 positionKey, int256 deltaChange)
	{
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
		(, , , , uint256[] memory position) = checkVaultHealth();
		if (position[7] == 1) {
			value = (position[1] + position[8]) / 1e12;
		} else {
			value = (position[1] - position[8]) / 1e12;
		}
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
			uint256[] memory position
		)
	{
		address[] memory indexToken = new address[](1);

		indexToken[0] = wETH;
		address[] memory collateralToken = new address[](1);
		bool[] memory isLong = new bool[](1);
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

		if (position[0] == 0) {
			//no positions open
			return (false, false, 5000, 0, position);
		}
		uint256 health;
		if (position[7] == 1) {
			//position in profit
			health = (uint256((int256(position[1]) + int256(position[8])).div(int256(position[0]))) * MAX_BIPS) / 1e18;
		} else {
			health = (uint256((int256(position[1]) - int256(position[8])).div(int256(position[0]))) * MAX_BIPS) / 1e18;
		}
		if (health > healthFactor) {
			// position is over-collateralised
			isAboveMax = true;
			isBelowMin = false;
			collatToTransfer = ((health - healthFactor) * position[0]) / MAX_BIPS / 1e24;
		} else if (health < healthFactor) {
			// position undercollateralised
			// more collateral needs adding
			isBelowMin = true;
			isAboveMax = false;
			collatToTransfer = ((healthFactor - health) * position[0]) / MAX_BIPS / 1e24;
		} else {
			// health factor is perfect
			return (false, false, health, 0, position);
		}
		return (isBelowMin, isAboveMax, health, collatToTransfer, position);
	}

	//////////////////////////
	/// internal utilities ///
	//////////////////////////

	/** @notice function to handle logic of when to open and close positions
			GMX handles shorts and longs separately, so we only want to have either a short OR a long open 
			at any one time to aavoid paying borrow fees both ways.
			This function will close off any shorts before opening longs and vice versa.
      @param _amount the amount of delta to change exposure by. e18
      @return deltaChange The resulting difference in delta exposure
  */
	function _changePosition(int256 _amount) internal returns (int256) {
		(
			bool isBelowMin,
			bool isAboveMax,
			uint256 health,
			uint256 collatToTransfer,
			uint256[] memory position
		) = checkVaultHealth();
		bool closedOppositeSideFirst = false;
		int256 closedPositionDeltaChange;
		if (_amount > 0) {
			// enter long position
			if (internalDelta < 0) {
				// close short position before opening long
				uint256 adjustedPositionSize = _adjustedReducePositionSize(uint256(_amount));
				int256 rebalancingCollateral = isAboveMax ? -int256(collatToTransfer) : int256(collatToTransfer);
				uint256 collateralToRemove = _getCollateralSizeDeltaUsd(
					adjustedPositionSize,
					rebalancingCollateral,
					position,
					false
				);
				(bytes32 positionKey, int256 deltaChange) = _decreasePosition(adjustedPositionSize, collateralToRemove, false);
				// update deltaChange for callback function
				orderDeltaChange[positionKey] += deltaChange;

				// remove the adjustedPositionSize from _amount to get remaining amount of delta to hedge to open shorts with
				_amount = _amount - int256(adjustedPositionSize);
				if (_amount == 0) return int256(adjustedPositionSize);
				closedPositionDeltaChange = deltaChange;
				closedOppositeSideFirst = true;
			}
			uint256 extraPositionCollateral = OptionsCompute.convertToDecimals(
				(uint256(_amount).mul(getUnderlyingPrice(wETH, collateralAsset)) * healthFactor) / MAX_BIPS,
				ERC20(collateralAsset).decimals()
			);
			// if closed shorts first then there is no long position open so nothing to rebalance
			int256 rebalancingCollateral = closedOppositeSideFirst ? int256(0) : isAboveMax
				? -int256(collatToTransfer)
				: int256(collatToTransfer);

			uint256 collateralToAdd = _getCollateralSizeDeltaUsd(uint256(_amount), rebalancingCollateral, position, true);
			(bytes32 positionKey, int256 deltaChange) = _increasePosition(uint256(_amount), collateralToAdd, true);
			// update deltaChange for callback function
			orderDeltaChange[positionKey] += deltaChange;
		} else {
			// _amount is negative
			// enter a short position
			console.log("reduce delta");
			if (internalDelta > 0) {
				console.log("closing long first");
				console.log("amount of delta to reduce:", _amount > 0 ? uint256(_amount) : uint256(-_amount));
				// close longs first
				uint256 adjustedPositionSize = _adjustedReducePositionSize(uint256(-_amount));
				console.log("adjusted position size:", adjustedPositionSize);
				int256 rebalancingCollateral = isAboveMax ? -int256(collatToTransfer) : int256(collatToTransfer);
				uint256 collateralToRemove = _getCollateralSizeDeltaUsd(
					adjustedPositionSize,
					rebalancingCollateral,
					position,
					false
				);
				(bytes32 positionKey, int256 deltaChange) = _decreasePosition(adjustedPositionSize, collateralToRemove, true);
				// update deltaChange for callback function
				orderDeltaChange[positionKey] += deltaChange;

				// remove the adjustedPositionSize from _amount to get remaining amount of delta to hedge to open shorts with
				_amount = _amount + int256(adjustedPositionSize);
				console.log("updated amount after removing closed long", uint256(-_amount));
				if (_amount == 0) return -int256(adjustedPositionSize);
				closedPositionDeltaChange = deltaChange;
				closedOppositeSideFirst = true;
			}
			// increase short position
			// if closed longs first then there is no short position open so nothing to rebalance
			console.log("amount remaining for long", uint256(-_amount));
			int256 rebalancingCollateral = closedOppositeSideFirst ? int256(0) : isAboveMax
				? -int256(collatToTransfer)
				: int256(collatToTransfer);
			uint256 collateralToAdd = _getCollateralSizeDeltaUsd(uint256(-_amount), rebalancingCollateral, position, true);
			(bytes32 positionKey, int256 deltaChange) = _increasePosition(uint256(-_amount), collateralToAdd, false);
			// update deltaChange for callback function
			orderDeltaChange[positionKey] += deltaChange;
			return deltaChange + closedPositionDeltaChange;
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
	) internal returns (bytes32 positionKey, int256 deltaChange) {
		// take that amount of collateral from the Liquidity Pool and approve to GMX
		SafeTransferLib.safeTransferFrom(collateralAsset, parentLiquidityPool, address(this), _collateralSize);
		SafeTransferLib.safeApprove(ERC20(collateralAsset), address(router), _collateralSize);

		bytes32 positionKey = gmxPositionRouter.createIncreasePosition{ value: gmxPositionRouter.minExecutionFee() }(
			_createPathIncreasePosition(_isLong),
			wETH,
			_collateralSize,
			(_collateralSize * 1e12).div(getUnderlyingPrice(wETH, collateralAsset)).mul(995e15),
			_size.mul(getUnderlyingPrice(wETH, collateralAsset)) * 1e12,
			_isLong,
			_isLong ? getUnderlyingPrice(wETH, collateralAsset) * 1005e9 : getUnderlyingPrice(wETH, collateralAsset) * 995e9, // 0.5% price tolerance
			gmxPositionRouter.minExecutionFee(),
			"leverageisfun",
			address(this)
		);
		emit CreateIncreasePosition(positionKey);

		return (positionKey, _isLong ? int256(_size) : -int256(_size));
	}

	/*
		@notice internal function to handle decreasing position size on GMX
		@param _size ETH denominated size to decrease position by. e18
		@param _collateralSize amount of collateral to remove. denominated in collateralAsset decimals.
		@param _isLong whether the position is a long or short
	*/
	function _decreasePosition(
		uint256 _size,
		uint256 _collateralSize,
		bool _isLong
	) internal returns (bytes32 positionKey, int256 deltaChange) {
		console.log("decrease pos params:", _size, _collateralSize, _isLong);
		address _collateralAsset = collateralAsset;
		address _wETH = wETH;
		PositionData memory positionData = _getPosition(_isLong);
		positionData.currentPrice = getUnderlyingPrice(_wETH, _collateralAsset);

		// calculate change in dollar value of position
		// equal to (_size / abs(internalDelta)) * positionSize
		// expressed in e30 decimals
		positionData.positionSizeDeltaUsd = _getPositionSizeDeltaUsd(_size, positionData);
		bytes32 positionKey = gmxPositionRouter.createDecreasePosition{ value: gmxPositionRouter.minExecutionFee() }(
			_createPathDecreasePosition(_isLong),
			_wETH,
			_collateralSize * 1e24,
			// positionData.positionSizeDeltaUsd / 2,
			positionData.positionSizeDeltaUsd,
			_isLong,
			address(this),
			_isLong ? positionData.currentPrice * 995e9 : positionData.currentPrice * 1005e9, // mul by 0.995 e12 for slippage
			0,
			gmxPositionRouter.minExecutionFee(),
			false,
			address(this)
		);

		emit CreateDecreasePosition(positionKey);
		return (positionKey, _isLong ? -int256(_size) : int256(_size));
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

		) = vault.getPosition(address(this), positionData.collateralType, wETH, _isLong);
	}

	function _createPathIncreasePosition(bool _isLong) internal view returns (address[] memory) {
		if (_isLong) {
			address[] memory path = new address[](2);
			path[0] = collateralAsset;
			path[1] = wETH;
			return path;
		} else {
			address[] memory path = new address[](1);
			path[0] = collateralAsset;
			return path;
		}
	}

	function _createPathDecreasePosition(bool _isLong) internal view returns (address[] memory) {
		if (_isLong) {
			address[] memory path = new address[](2);
			path[0] = wETH;
			path[1] = collateralAsset;
			return path;
		} else {
			address[] memory path = new address[](1);
			path[0] = collateralAsset;
			return path;
		}
	}

	/* 
	@param _amount amount of deltas to reduce position by
*/
	function _getCollateralSizeDeltaUsd(
		uint256 _amount,
		int256 _undercollateralisationAmount,
		uint256[] memory _position,
		bool _isIncreasePosition
	) private view returns (uint256) {
		// position[0] = position size in USD
		// position[1] = collateral amount in USD
		// position[2] = average entry price of position
		// position[3] = entry funding rate
		// position[4] = does position have *realised* profit
		// position[5] = realised PnL
		// position[6] = timestamp of last position increase
		// position[7] = is position in profit
		// position[8] = current unrealised Pnl

		// calculate amount of collateral to add or remove denominated in USDC
		//  equal to collateral needed for extra margin plus rebalancing collateral to bring health factor back to 5000
		// _undercollateralisationAmount is positive if current health factor is under target and negative if over target

		if (_isIncreasePosition) {
			uint256 extraPositionCollateral = OptionsCompute.convertToDecimals(
				(_amount.mul(getUnderlyingPrice(wETH, collateralAsset)) * healthFactor) / MAX_BIPS,
				ERC20(collateralAsset).decimals()
			);
			uint256 totalCollateralToAdd;
			if (-_undercollateralisationAmount > int256(extraPositionCollateral)) {
				// in this case there is a net collateral withdrawal needed which cannot be done with increasePosition
				// so just dont add any more collateral and have it rebalance later
				totalCollateralToAdd = 0;
			} else {
				// otherwise add the two collateral requirement parts to obtain total collateral input
				totalCollateralToAdd = uint256(int256(extraPositionCollateral) + _undercollateralisationAmount);
			}
			return totalCollateralToAdd;
		} else {
			int256 collateralToRemove;
			if (_position[7] == 1) {
				// position in profit
				collateralToRemove = (1e18 -
					(
						(int256(_position[0] / 1e12) - int256((2 * _position[8]) / 1e12))
							.mul(1e18 - int256(_amount.mul(_position[2] / 1e12).div(_position[0] / 1e12)))
							.div(2 * int256(_position[1] / 1e12))
					)).mul(int256(_position[1] / 1e12));
				// +
				// int256(_amount.mul(_position[2] / 1e12).div(_position[0] / 1e12).mul(_position[8] / 1e12));
			} else {
				// position in loss
				collateralToRemove =
					(1e18 -
						(
							(int256(_position[0] / 1e12) + int256((2 * _position[8]) / 1e12))
								.mul(1e18 - int256(_amount.mul(_position[2] / 1e12).div(_position[0] / 1e12)))
								.div(2 * int256(_position[1] / 1e12))
						)).mul(int256(_position[1] / 1e12)) -
					int256(_amount.mul(_position[2] / 1e12).div(_position[0] / 1e12).mul(_position[8] / 1e12));
			}
			uint256 adjustedCollateralToRemove;
			// collateral to remove must be a uint
			if (collateralToRemove < 0) {
				adjustedCollateralToRemove = uint256(0);
			} else {
				adjustedCollateralToRemove = uint256(collateralToRemove);
				if (adjustedCollateralToRemove > ((_position[1] / 1e12) * 49) / 50) {
					adjustedCollateralToRemove = ((_position[1] / 1e12) * 49) / 50;
				}
			}
			return OptionsCompute.convertToDecimals(adjustedCollateralToRemove, ERC20(collateralAsset).decimals());
		}
	}

	function _getPositionSizeDeltaUsd(uint256 _size, PositionData memory positionData) private view returns (uint256) {
		return _size.div(uint256(internalDelta.abs())).mul(positionData.positionSize);
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
			delete orderDeltaChange[positionKey];
		}
		console.log("callack fired", isExecuted, isIncrease);
		uint256 usdcBalance = ERC20(collateralAsset).balanceOf(address(this));
		SafeTransferLib.safeTransfer(ERC20(collateralAsset), parentLiquidityPool, usdcBalance);
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
