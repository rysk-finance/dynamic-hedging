// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./Protocol.sol";
import "./PriceFeed.sol";
import "./VolatilityFeed.sol";

import "./tokens/ERC20.sol";
import "./utils/ReentrancyGuard.sol";

import "./libraries/BlackScholes.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/AccessControl.sol";
import "./libraries/OptionsCompute.sol";
import "./libraries/SafeTransferLib.sol";

import "./interfaces/IAccounting.sol";
import "./interfaces/IOptionRegistry.sol";
import "./interfaces/IHedgingReactor.sol";
import "./interfaces/IPortfolioValuesFeed.sol";

import "@openzeppelin/contracts/security/Pausable.sol";

/**
 *  @title Contract used as the Dynamic Hedging Vault for storing funds, issuing shares and processing options transactions
 *  @dev Interacts with the OptionRegistry for options behaviour, Interacts with hedging reactors for alternative derivatives
 *       Interacts with Handlers for periphary user options interactions. Interacts with Chainlink price feeds throughout.
 *       Interacts with Volatility Feed via getImpliedVolatility(), interacts with a chainlink PortfolioValues external adaptor
 *       oracle via PortfolioValuesFeed.
 */
contract LiquidityPool is ERC20, AccessControl, ReentrancyGuard, Pausable {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;

	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	// Protocol management contract
	Protocol public immutable protocol;
	// asset that denominates the strike price
	address public immutable strikeAsset;
	// asset that is used as the reference asset
	address public immutable underlyingAsset;
	// asset that is used for collateral asset
	address public immutable collateralAsset;

	/////////////////////////
	/// dynamic variables ///
	/////////////////////////

	// amount of collateralAsset allocated as collateral
	uint256 public collateralAllocated;
	// ephemeral liabilities of the pool
	int256 public ephemeralLiabilities;
	// ephemeral delta of the pool
	int256 public ephemeralDelta;
	// epoch of the price per share round for deposits
	uint256 public depositEpoch;
	// epoch of the price per share round for withdrawals
	uint256 public withdrawalEpoch;
	// epoch PPS for deposits
	mapping(uint256 => uint256) public depositEpochPricePerShare;
	// epoch PPS for withdrawals
	mapping(uint256 => uint256) public withdrawalEpochPricePerShare;
	// deposit receipts for users
	mapping(address => IAccounting.DepositReceipt) public depositReceipts;
	// withdrawal receipts for users
	mapping(address => IAccounting.WithdrawalReceipt) public withdrawalReceipts;
	// pending deposits for a round - collateral denominated (collateral decimals)
	uint256 public pendingDeposits;
	// pending withdrawals for a round - DHV token e18 denominated
	uint256 public pendingWithdrawals;
	// withdrawal amount that has been executed and is pending completion. These funds are to be excluded from all book balances.
	uint256 public partitionedFunds;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	// buffer of funds to not be used to write new options in case of margin requirements (as percentage - for 20% enter 2000)
	uint256 public bufferPercentage = 2000;
	// list of addresses for hedging reactors
	address[] public hedgingReactors;
	// max total supply of collateral, denominated in e18
	uint256 public collateralCap = type(uint256).max;
	// Maximum discount that an option tilting factor can discount an option price
	uint256 public maxDiscount = (PRBMathUD60x18.SCALE * 10) / 100; // As a percentage. Init at 10%
	// The spread between the bid and ask on the IV skew;
	// Consider making this it's own volatility skew if more flexibility is needed
	uint256 public bidAskIVSpread;
	// option issuance parameters
	Types.OptionParams public optionParams;
	// riskFreeRate as a percentage PRBMath Float. IE: 3% -> 0.03 * 10**18
	uint256 public riskFreeRate;
	// handlers who are approved to interact with options functionality
	mapping(address => bool) public handler;
	// is the purchase and sale of options paused
	bool public isTradingPaused;
	// max time to allow between oracle updates for an underlying and strike
	uint256 public maxTimeDeviationThreshold;
	// max price difference to allow between oracle updates for an underlying and strike
	uint256 public maxPriceDeviationThreshold;
	// variables relating to the utilization skew function:
	// the gradient of the function where utiization is below function threshold. e18
	uint256 public belowThresholdGradient = 0; // 0.1
	// the gradient of the line above the utilization threshold. e18
	uint256 public aboveThresholdGradient = 1e18; // 1
	// the y-intercept of the line above the threshold. Needed to make the two lines meet at the threshold.  Will always be negative but enter the absolute value
	uint256 public aboveThresholdYIntercept = 6e17; //-0.6
	// the percentage utilization above which the function moves from its shallow line to its steep line. e18
	uint256 public utilizationFunctionThreshold = 6e17; // 60%
	// keeper mapping
	mapping(address => bool) public keeper;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	event DepositEpochExecuted(uint256 epoch);
	event WithdrawalEpochExecuted(uint256 epoch);
	event Withdraw(address recipient, uint256 amount, uint256 shares);
	event Deposit(address recipient, uint256 amount, uint256 epoch);
	event Redeem(address recipient, uint256 amount, uint256 epoch);
	event InitiateWithdraw(address recipient, uint256 amount, uint256 epoch);
	event WriteOption(address series, uint256 amount, uint256 premium, uint256 escrow, address buyer);
	event SettleVault(
		address series,
		uint256 collateralReturned,
		uint256 collateralLost,
		address closer
	);
	event BuybackOption(
		address series,
		uint256 amount,
		uint256 premium,
		uint256 escrowReturned,
		address seller
	);

	constructor(
		address _protocol,
		address _strikeAsset,
		address _underlyingAsset,
		address _collateralAsset,
		uint256 rfr,
		string memory name,
		string memory symbol,
		Types.OptionParams memory _optionParams,
		address _authority
	) ERC20(name, symbol, 18) AccessControl(IAuthority(_authority)) {
		if (ERC20(_collateralAsset).decimals() > 18) {
			revert CustomErrors.InvalidDecimals();
		}
		strikeAsset = _strikeAsset;
		riskFreeRate = rfr;
		underlyingAsset = _underlyingAsset;
		collateralAsset = _collateralAsset;
		protocol = Protocol(_protocol);
		optionParams = _optionParams;
		depositEpochPricePerShare[0] = 1e18;
		withdrawalEpochPricePerShare[0] = 1e18;
		depositEpoch++;
		withdrawalEpoch++;
	}

	///////////////
	/// setters ///
	///////////////

	function pause() external {
		_onlyGuardian();
		_pause();
	}

	function pauseUnpauseTrading(bool _pause) external {
		_onlyGuardian();
		isTradingPaused = _pause;
	}

	function unpause() external {
		_onlyGuardian();
		_unpause();
	}

	/**
	 * @notice set a new hedging reactor
	 * @param _reactorAddress append a new hedging reactor
	 * @dev   only governance can call this function
	 */
	function setHedgingReactorAddress(address _reactorAddress) external {
		_onlyGovernor();
		if (_reactorAddress == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		address[] memory hedgingReactors_ = hedgingReactors;
		uint256 maxIndex = hedgingReactors_.length;
		for (uint256 i = 0; i < maxIndex; i++) {
			if (hedgingReactors_[i] == _reactorAddress) {
				revert CustomErrors.ReactorAlreadyExists();
			}
		}
		hedgingReactors.push(_reactorAddress);
		SafeTransferLib.safeApprove(ERC20(collateralAsset), _reactorAddress, type(uint256).max);
	}

	/**
	 * @notice remove a new hedging reactor by index
	 * @param _index remove a hedging reactor
	 * @param _override whether to override whether the reactor is wound down 
	 		 			(THE REACTOR SHOULD BE WOUND DOWN SEPERATELY)
	 * @dev   only governance can call this function
	 */
	function removeHedgingReactorAddress(uint256 _index, bool _override) external {
		_onlyGovernor();
		address[] memory hedgingReactors_ = hedgingReactors;
		if (!_override) {
			IHedgingReactor reactor = IHedgingReactor(hedgingReactors_[_index]);
			int256 delta = reactor.getDelta();
			if (delta != 0) {
				reactor.hedgeDelta(delta);
			}
			reactor.withdraw(type(uint256).max);
		}
		SafeTransferLib.safeApprove(ERC20(collateralAsset), hedgingReactors_[_index], 0);
		uint256 maxIndex = hedgingReactors_.length - 1;
		for (uint256 i = _index; i < maxIndex; i++) {
			hedgingReactors[i] = hedgingReactors[i + 1];
		}
		hedgingReactors.pop();
	}

	/**
	 * @notice update all optionParam variables for max and min strikes and max and
	 *         min expiries for options that the DHV can issue
	 * @dev   only management or above can call this function
	 */
	function setNewOptionParams(
		uint128 _newMinCallStrike,
		uint128 _newMaxCallStrike,
		uint128 _newMinPutStrike,
		uint128 _newMaxPutStrike,
		uint128 _newMinExpiry,
		uint128 _newMaxExpiry
	) external {
		_onlyManager();
		optionParams.minCallStrikePrice = _newMinCallStrike;
		optionParams.maxCallStrikePrice = _newMaxCallStrike;
		optionParams.minPutStrikePrice = _newMinPutStrike;
		optionParams.maxPutStrikePrice = _newMaxPutStrike;
		optionParams.minExpiry = _newMinExpiry;
		optionParams.maxExpiry = _newMaxExpiry;
	}

	/**
	 * @notice set the bid ask spread used to price option buying
	 * @param _bidAskSpread the bid ask spread to update to
	 * @dev   only management or above can call this function
	 */
	function setBidAskSpread(uint256 _bidAskSpread) external {
		_onlyManager();
		bidAskIVSpread = _bidAskSpread;
	}

	/**
	 * @notice set the maximum percentage discount for an option
	 * @param _maxDiscount of the option as a percentage in 1e18 format. ie: 1*e18 == 1%
	 * @dev   only management or above can call this function
	 */
	function setMaxDiscount(uint256 _maxDiscount) external {
		_onlyManager();
		maxDiscount = _maxDiscount;
	}

	/**
	 * @notice set the maximum collateral amount allowed in the pool
	 * @param _collateralCap of the collateral held
	 * @dev   only governance can call this function
	 */
	function setCollateralCap(uint256 _collateralCap) external {
		_onlyGovernor();
		collateralCap = _collateralCap;
	}

	/**
	 * @notice update the liquidity pool buffer limit
	 * @param _bufferPercentage the minimum balance the liquidity pool must have as a percentage of collateral allocated to options. (for 20% enter 2000)
	 * @dev   only governance can call this function
	 */
	function setBufferPercentage(uint256 _bufferPercentage) external {
		_onlyGovernor();
		if (_bufferPercentage == 0) {
			revert CustomErrors.InvalidInput();
		}
		bufferPercentage = _bufferPercentage;
	}

	/**
	 * @notice update the liquidity pool risk free rate
	 * @param _riskFreeRate the risk free rate of the market
	 */
	function setRiskFreeRate(uint256 _riskFreeRate) external {
		_onlyGovernor();
		riskFreeRate = _riskFreeRate;
	}

	/**
	 * @notice update the max oracle time deviation threshold
	 */
	function setMaxTimeDeviationThreshold(uint256 _maxTimeDeviationThreshold) external {
		_onlyGovernor();
		if (_maxTimeDeviationThreshold == 0) {
			revert CustomErrors.InvalidInput();
		}
		maxTimeDeviationThreshold = _maxTimeDeviationThreshold;
	}

	/**
	 * @notice update the max oracle price deviation threshold
	 */
	function setMaxPriceDeviationThreshold(uint256 _maxPriceDeviationThreshold) external {
		_onlyGovernor();
		if (_maxPriceDeviationThreshold == 0) {
			revert CustomErrors.InvalidInput();
		}
		maxPriceDeviationThreshold = _maxPriceDeviationThreshold;
	}

	/**
	 * @notice change the status of a handler
	 */
	function changeHandler(address _handler, bool auth) external {
		_onlyGovernor();
		if (_handler == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		handler[_handler] = auth;
	}

	/**
	 * @notice change the status of a keeper
	 */
	function setKeeper(address _keeper, bool _auth) external {
		_onlyGovernor();
		if (_keeper == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		keeper[_keeper] = _auth;
	}

	/**
	 *  @notice sets the parameters for the function that determines the utilization price factor
	 *  The function is made up of two parts, both linear. The line to the left of the utilisation threshold has a low gradient
	 *  while the gradient to the right of the threshold is much steeper. The aim of this function is to make options much more
	 *  expensive near full utilization while not having much effect at low utilizations.
	 *  @param _belowThresholdGradient the gradient of the function where utiization is below function threshold. e18
	 *  @param _aboveThresholdGradient the gradient of the line above the utilization threshold. e18
	 *  @param _utilizationFunctionThreshold the percentage utilization above which the function moves from its shallow line to its steep line
	 */
	function setUtilizationSkewParams(
		uint256 _belowThresholdGradient,
		uint256 _aboveThresholdGradient,
		uint256 _utilizationFunctionThreshold
	) external {
		_onlyManager();
		belowThresholdGradient = _belowThresholdGradient;
		aboveThresholdGradient = _aboveThresholdGradient;
		aboveThresholdYIntercept = _utilizationFunctionThreshold.mul(
			_aboveThresholdGradient - _belowThresholdGradient // inverted the order of the subtraction to result in a positive uint
		);

		utilizationFunctionThreshold = _utilizationFunctionThreshold;
	}

	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/**
	 * @notice function for hedging portfolio delta through external means
	 * @param delta the current portfolio delta
	 * @param reactorIndex the index of the reactor in the hedgingReactors array to use
	 */
	function rebalancePortfolioDelta(int256 delta, uint256 reactorIndex) external {
		_onlyManager();
		IHedgingReactor(hedgingReactors[reactorIndex]).hedgeDelta(delta);
	}

	/**
	 * @notice adjust the collateral held in a specific vault because of health
	 * @param lpCollateralDifference amount of collateral taken from or given to the liquidity pool in collateral decimals
	 * @param addToLpBalance true if collateral is returned to liquidity pool, false if collateral is withdrawn from liquidity pool
	 * @dev   called by the option registry only
	 */
	function adjustCollateral(uint256 lpCollateralDifference, bool addToLpBalance) external {
		IOptionRegistry optionRegistry = _getOptionRegistry();
		require(msg.sender == address(optionRegistry));
		// assumes in collateral decimals
		if (addToLpBalance) {
			collateralAllocated -= lpCollateralDifference;
		} else {
			SafeTransferLib.safeApprove(
				ERC20(collateralAsset),
				address(optionRegistry),
				lpCollateralDifference
			);
			collateralAllocated += lpCollateralDifference;
		}
	}

	/**
	 * @notice closes an oToken vault, returning collateral (minus ITM option expiry value) back to the pool
	 * @param seriesAddress the address of the oToken vault to close
	 * @return collatReturned the amount of collateral returned to the liquidity pool, assumes in collateral decimals
	 */
	function settleVault(address seriesAddress) external returns (uint256) {
		_isKeeper();
		// get number of options in vault and collateral returned to recalculate our position without these options
		// returns in collat decimals, collat decimals and e8
		(, uint256 collatReturned, uint256 collatLost, ) = _getOptionRegistry().settle(seriesAddress);
		emit SettleVault(seriesAddress, collatReturned, collatLost, msg.sender);
		// if the vault expired ITM then when settled the oracle will still have accounted for it as a liability. When
		// the settle happens the liability is wiped off as it is now accounted for in collateralAllocated but because the
		// oracle doesn't know this yet we need to temporarily reduce the liability value.
		_adjustVariables(collatReturned, collatLost, 0, false);
		collateralAllocated -= collatLost;
		return collatReturned;
	}

	/**
	 * @notice issue an option
	 * @param optionSeries the series detail of the option - strike decimals in e18
	 * @dev only callable by a handler contract
	 */
	function handlerIssue(Types.OptionSeries memory optionSeries) external returns (address) {
		_isHandler();
		// series strike in e18
		return _issue(optionSeries, _getOptionRegistry());
	}

	/**
	 * @notice write an option that already exists
	 * @param optionSeries the series detail of the option - strike decimals in e8
	 * @param seriesAddress the series address of the oToken
	 * @param amount the number of options to write - in e18
	 * @param optionRegistry the registry used for options writing
	 * @param premium the premium of the option - in collateral decimals
	 * @param delta the delta of the option - in e18
	 * @param recipient the receiver of the option
	 * @dev only callable by a handler contract
	 */
	function handlerWriteOption(
		Types.OptionSeries memory optionSeries,
		address seriesAddress,
		uint256 amount,
		IOptionRegistry optionRegistry,
		uint256 premium,
		int256 delta,
		address recipient
	) external returns (uint256) {
		_isTradingNotPaused();
		_isHandler();
		return
			_writeOption(
				optionSeries, // series strike in e8
				seriesAddress,
				amount, // in e18
				optionRegistry,
				premium, // in collat decimals
				delta,
				checkBuffer(), // in e6
				recipient
			);
	}

	/**
	 * @notice write an option that doesnt exist
	 * @param optionSeries the series detail of the option - strike decimals in e18
	 * @param amount the number of options to write - in e18
	 * @param premium the premium of the option - in collateral decimals
	 * @param delta the delta of the option - in e18
	 * @param recipient the receiver of the option
	 * @dev only callable by a handler contract
	 */
	function handlerIssueAndWriteOption(
		Types.OptionSeries memory optionSeries,
		uint256 amount,
		uint256 premium,
		int256 delta,
		address recipient
	) external returns (uint256, address) {
		_isTradingNotPaused();
		_isHandler();
		IOptionRegistry optionRegistry = _getOptionRegistry();
		// series strike passed in as e18
		address seriesAddress = _issue(optionSeries, optionRegistry);
		// series strike received in e8, retrieved from the option registry instead of
		// using one in memory because formatStrikePrice might have slightly changed the
		// strike
		optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
		return (
			_writeOption(
				optionSeries, // strike in e8
				seriesAddress,
				amount, // in e18
				optionRegistry,
				premium, // in collat decimals
				delta,
				checkBuffer(), // in e6
				recipient
			),
			seriesAddress
		);
	}

	/**
	 * @notice buy back an option that already exists
	 * @param optionSeries the series detail of the option - strike decimals in e8
	 * @param amount the number of options to buyback - in e18
	 * @param optionRegistry the registry used for options writing
	 * @param seriesAddress the series address of the oToken
	 * @param premium the premium of the option - in collateral decimals
	 * @param delta the delta of the option - in e18
	 * @param seller the receiver of the option
	 * @dev only callable by a handler contract
	 */
	function handlerBuybackOption(
		Types.OptionSeries memory optionSeries,
		uint256 amount,
		IOptionRegistry optionRegistry,
		address seriesAddress,
		uint256 premium,
		int256 delta,
		address seller
	) external returns (uint256) {
		_isTradingNotPaused();
		_isHandler();
		// strike passed in as e8
		return
			_buybackOption(optionSeries, amount, optionRegistry, seriesAddress, premium, delta, seller);
	}

	/**
	 * @notice reset the temporary portfolio and delta values that have been changed since the last oracle update
	 * @dev    only callable by the portfolio values feed oracle contract
	 */
	function resetEphemeralValues() external {
		require(msg.sender == address(_getPortfolioValuesFeed()));
		delete ephemeralLiabilities;
		delete ephemeralDelta;
	}

	/**
	 * @notice reset the temporary portfolio and delta values that have been changed since the last oracle update
	 * @dev    this function must be called in order to execute an epoch calculation
	 */
	function pauseTradingAndRequest() external returns (bytes32) {
		_isKeeper();
		// pause trading
		isTradingPaused = true;
		// make an oracle request
		return _getPortfolioValuesFeed().requestPortfolioData(underlyingAsset, strikeAsset);
	}

	/**
	 * @notice execute the epoch and set all the price per shares
	 * @dev    this function must be called in order to execute an epoch calculation and batch a mutual fund epoch
	 */
	function executeEpochCalculation() external whenNotPaused {
		_isKeeper();
		if (!isTradingPaused) {
			revert CustomErrors.TradingNotPaused();
		}
		(
			uint256 newPricePerShareDeposit,
			uint256 newPricePerShareWithdrawal,
			uint256 sharesToMint,
			uint256 totalWithdrawAmount,
			uint256 amountNeeded
		) = _getAccounting().executeEpochCalculation(totalSupply, _getAssets(), _getLiabilities());
		// deposits always get executed
		depositEpochPricePerShare[depositEpoch] = newPricePerShareDeposit;
		delete pendingDeposits;
		emit DepositEpochExecuted(depositEpoch);
		depositEpoch++;
		isTradingPaused = false;
		_mint(address(this), sharesToMint);
		// loop through the reactors and move funds if found
		if (amountNeeded > 0) {
			address[] memory hedgingReactors_ = hedgingReactors;
			for (uint8 i = 0; i < hedgingReactors_.length; i++) {
				amountNeeded -= IHedgingReactor(hedgingReactors_[i]).withdraw(amountNeeded);
				if (amountNeeded <= 0) {
					break;
				}
			}
			// if not enough funds in liquidity pool and reactors, dont process withdrawals this epoch
			if (amountNeeded > 0) {
				return;
			}
		}
		withdrawalEpochPricePerShare[withdrawalEpoch] = newPricePerShareWithdrawal;
		partitionedFunds += totalWithdrawAmount;
		emit WithdrawalEpochExecuted(withdrawalEpoch);
		_burn(address(this), pendingWithdrawals);
		delete pendingWithdrawals;
		withdrawalEpoch++;
	}

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/**
	 * @notice function for adding liquidity to the options liquidity pool
	 * @param _amount    amount of the strike asset to deposit
	 * @return success
	 * @dev    entry point to provide liquidity to dynamic hedging vault
	 */
	function deposit(uint256 _amount) external whenNotPaused nonReentrant returns (bool) {
		if (_amount == 0) {
			revert CustomErrors.InvalidAmount();
		}
		(uint256 depositAmount, uint256 unredeemedShares) = _getAccounting().deposit(msg.sender, _amount);

		emit Deposit(msg.sender, _amount, depositEpoch);
		// create the deposit receipt
		depositReceipts[msg.sender] = IAccounting.DepositReceipt({
			epoch: uint128(depositEpoch),
			amount: uint128(depositAmount),
			unredeemedShares: unredeemedShares
		});
		pendingDeposits += _amount;
		// Pull in tokens from sender
		SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), _amount);
		return true;
	}

	/**
	 * @notice function for allowing a user to redeem their shares from a previous epoch
	 * @param _shares the number of shares to redeem
	 * @return the number of shares actually returned
	 */
	function redeem(uint256 _shares) external nonReentrant returns (uint256) {
		if (_shares == 0) {
			revert CustomErrors.InvalidShareAmount();
		}
		return _redeem(_shares);
	}

	/**
	 * @notice function for initiating a withdraw request from the pool
	 * @param _shares    amount of shares to return
	 * @dev    entry point to remove liquidity to dynamic hedging vault
	 */
	function initiateWithdraw(uint256 _shares) external whenNotPaused nonReentrant {
		if (_shares == 0) {
			revert CustomErrors.InvalidShareAmount();
		}
		IAccounting.DepositReceipt memory depositReceipt = depositReceipts[msg.sender];

		if (depositReceipt.amount > 0 || depositReceipt.unredeemedShares > 0) {
			// redeem so a user can use a completed deposit as shares for an initiation
			_redeem(type(uint256).max);
		}
		IAccounting.WithdrawalReceipt memory withdrawalReceipt = _getAccounting().initiateWithdraw(
			msg.sender,
			_shares
		);
		withdrawalReceipts[msg.sender] = withdrawalReceipt;
		pendingWithdrawals += _shares;
		emit InitiateWithdraw(msg.sender, _shares, withdrawalEpoch);
		transfer(address(this), _shares);
	}

	/**
	 * @notice function for completing the withdraw from a pool
	 * @dev    entry point to remove liquidity to dynamic hedging vault
	 */
	function completeWithdraw() external whenNotPaused nonReentrant returns (uint256) {
		(
			uint256 withdrawalAmount,
			uint256 withdrawalShares,
			IAccounting.WithdrawalReceipt memory withdrawalReceipt
		) = _getAccounting().completeWithdraw(msg.sender);
		withdrawalReceipts[msg.sender] = withdrawalReceipt;
		emit Withdraw(msg.sender, withdrawalAmount, withdrawalShares);
		// these funds are taken from the partitioned funds
		partitionedFunds -= withdrawalAmount;
		SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, withdrawalAmount);
		return withdrawalAmount;
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	/**
	 * @notice Returning balance in 1e18 format
	 * @param asset address of the asset to get balance and normalize
	 * @return normalizedBalance balance in 1e18 format
	 */
	function _getNormalizedBalance(address asset) internal view returns (uint256 normalizedBalance) {
		normalizedBalance = OptionsCompute.convertFromDecimals(
			ERC20(asset).balanceOf(address(this)) - partitionedFunds,
			ERC20(asset).decimals()
		);
	}

	/**
	 * @notice Returning balance in 1e6 format
	 * @param asset address of the asset to get balance
	 * @return balance of the address accounting for partitionedFunds
	 */
	function getBalance(address asset) public view returns (uint256) {
		return ERC20(asset).balanceOf(address(this)) - partitionedFunds;
	}

	/**
	 * @notice get the delta of the hedging reactors
	 * @return externalDelta hedging reactor delta in e18 format
	 */
	function getExternalDelta() public view returns (int256 externalDelta) {
		address[] memory hedgingReactors_ = hedgingReactors;
		for (uint8 i = 0; i < hedgingReactors_.length; i++) {
			externalDelta += IHedgingReactor(hedgingReactors_[i]).getDelta();
		}
	}

	/**
	 * @notice get the delta of the portfolio
	 * @return portfolio delta
	 */
	function getPortfolioDelta() public view returns (int256) {
		// assumes in e18
		Types.PortfolioValues memory portfolioValues = _getPortfolioValuesFeed().getPortfolioValues(
			underlyingAsset,
			strikeAsset
		);
		// check that the portfolio values are acceptable
		OptionsCompute.validatePortfolioValues(
			_getUnderlyingPrice(underlyingAsset, strikeAsset),
			portfolioValues,
			maxTimeDeviationThreshold,
			maxPriceDeviationThreshold
		);
		return portfolioValues.delta + getExternalDelta() + ephemeralDelta;
	}

	/**
	 * @notice get the quote price and delta for a given option
	 * @param  optionSeries option type to quote - strike assumed in e18
	 * @param  amount the number of options to mint  - assumed in e18
	 * @param toBuy whether the protocol is buying the option
	 * @return quote the price of the options - returns in e18
	 * @return delta the delta of the options - returns in e18
	 */
	function quotePriceWithUtilizationGreeks(
		Types.OptionSeries memory optionSeries,
		uint256 amount,
		bool toBuy
	) external view returns (uint256 quote, int256 delta) {
		// using a struct to get around stack too deep issues
		Types.UtilizationState memory quoteState;
		quoteState.underlyingPrice = _getUnderlyingPrice(
			optionSeries.underlying,
			optionSeries.strikeAsset
		);
		quoteState.iv = getImpliedVolatility(
			optionSeries.isPut,
			quoteState.underlyingPrice,
			optionSeries.strike,
			optionSeries.expiration
		);
		(uint256 optionQuote, int256 deltaQuote) = OptionsCompute.quotePriceGreeks(
			optionSeries,
			toBuy,
			bidAskIVSpread,
			riskFreeRate,
			quoteState.iv,
			quoteState.underlyingPrice
		);
		// price of acquiring total amount of options (remains e18 due to PRBMath)
		quoteState.totalOptionPrice = optionQuote.mul(amount);
		quoteState.totalDelta = deltaQuote.mul(int256(amount));

		// will update quoteState.utilizationPrice
		addUtilizationPremium(quoteState, optionSeries, amount, toBuy);
		quote = applyDeltaPremium(quoteState, toBuy);

		quote = OptionsCompute.convertToCollateralDenominated(
			quote,
			quoteState.underlyingPrice,
			optionSeries
		);
		delta = quoteState.totalDelta;
		if (quote == 0 || delta == int256(0)) {
			revert CustomErrors.DeltaQuoteError(quote, delta);
		}
	}

	/**
	 *	@notice applies a utilization premium when the protocol is selling options.
	 *	Stores the utilization price in quoteState.utilizationPrice for use in quotePriceWithUtilizationGreeks
	 *	@param quoteState the struct created in quoteStateWithUtilizationGreeks to store memory variables
	 *	@param optionSeries the option type for which we are quoting a price
	 *	@param amount the amount of options. e18
	 *	@param toBuy whether we are buying an option. False if selling
	 */
	function addUtilizationPremium(
		Types.UtilizationState memory quoteState,
		Types.OptionSeries memory optionSeries,
		uint256 amount,
		bool toBuy
	) internal view {
		if (!toBuy) {
			uint256 collateralAllocated_ = collateralAllocated;
			// if selling options, we want to add the utilization premium
			// Work out the utilization of the pool as a percentage
			quoteState.utilizationBefore = collateralAllocated_.div(
				collateralAllocated_ + getBalance(collateralAsset)
			);
			// assumes strike is e18
			// strike is not being used again so we dont care if format changes
			optionSeries.strike = optionSeries.strike / 1e10;
			// returns collateral decimals
			quoteState.collateralToAllocate = _getOptionRegistry().getCollateral(optionSeries, amount);

			quoteState.utilizationAfter = (quoteState.collateralToAllocate + collateralAllocated_).div(
				collateralAllocated_ + getBalance(collateralAsset)
			);
			// get the price of the option with the utilization premium added
			quoteState.utilizationPrice = OptionsCompute.getUtilizationPrice(
				quoteState.utilizationBefore,
				quoteState.utilizationAfter,
				quoteState.totalOptionPrice,
				utilizationFunctionThreshold,
				belowThresholdGradient,
				aboveThresholdGradient,
				aboveThresholdYIntercept
			);
		} else {
			// do not use utlilization premium for buybacks
			quoteState.utilizationPrice = quoteState.totalOptionPrice;
		}
	}

	/**
	 *	@notice Applies a discount or premium based on the liquidity pool's delta exposure
	 *	Gives discount if the transaction results in a lower delta exposure for the liquidity pool.
	 *	Prices option more richly if the transaction results in higher delta exposure for liquidity pool.
	 *	@param quoteState the struct created in quoteStateWithUtilizationGreeks to store memory variables
	 *	@param toBuy whether we are buying an option. False if selling
	 *	@return quote the quote for the option with the delta skew applied
	 */
	function applyDeltaPremium(Types.UtilizationState memory quoteState, bool toBuy)
		internal
		view
		returns (uint256 quote)
	{
		// portfolio delta before writing option
		int256 portfolioDelta = getPortfolioDelta();
		// subtract totalDelta if buying as pool is taking on the negative of the option's delta
		int256 newDelta = toBuy
			? portfolioDelta + quoteState.totalDelta
			: portfolioDelta - quoteState.totalDelta;
		// Is delta moved closer to zero?
		quoteState.isDecreased = (PRBMathSD59x18.abs(newDelta) - PRBMathSD59x18.abs(portfolioDelta)) < 0;
		// delta exposure of the portolio per ETH equivalent value the portfolio holds.
		// This value is only used for tilting so we are only interested in its distance from 0 (its magnitude)
		uint256 normalizedDelta = uint256(PRBMathSD59x18.abs((portfolioDelta + newDelta).div(2e18))).div(
			_getNAV().div(quoteState.underlyingPrice)
		);
		// this is the percentage of the option price which is added to or subtracted from option price
		// according to whether portfolio delta is increased or decreased respectively
		quoteState.deltaTiltAmount = normalizedDelta > maxDiscount ? maxDiscount : normalizedDelta;

		if (quoteState.isDecreased) {
			quote = toBuy
				? quoteState.deltaTiltAmount.mul(quoteState.utilizationPrice) + quoteState.utilizationPrice
				: quoteState.utilizationPrice - quoteState.deltaTiltAmount.mul(quoteState.utilizationPrice);
		} else {
			// increase utilization by delta tilt factor for moving delta away from zero
			quote = toBuy
				? quoteState.utilizationPrice - quoteState.deltaTiltAmount.mul(quoteState.utilizationPrice)
				: quoteState.deltaTiltAmount.mul(quoteState.utilizationPrice) + quoteState.utilizationPrice;
		}
	}

	///////////////////////////
	/// non-complex getters ///
	///////////////////////////

	/**
	 * @notice get the current implied volatility from the feed
	 * @param isPut Is the option a call or put?
	 * @param underlyingPrice The underlying price - assumed in e18
	 * @param strikePrice The strike price of the option - assumed in e18
	 * @param expiration expiration timestamp of option as a PRBMath Float
	 * @return Implied volatility adjusted for volatility surface - assumed in e18
	 */
	function getImpliedVolatility(
		bool isPut,
		uint256 underlyingPrice,
		uint256 strikePrice,
		uint256 expiration
	) public view returns (uint256) {
		return _getVolatilityFeed().getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
	}

	function getAssets() external view returns (uint256) {
		return _getAssets();
	}

	function getNAV() external view returns (uint256) {
		return _getNAV();
	}

	//////////////////////////
	/// internal utilities ///
	//////////////////////////

	/**
	 * @notice functionality for allowing a user to redeem their shares from a previous epoch
	 * @param _shares the number of shares to redeem
	 * @return toRedeem the number of shares actually returned
	 */
	function _redeem(uint256 _shares) internal returns (uint256) {
		(uint256 toRedeem, IAccounting.DepositReceipt memory depositReceipt) = _getAccounting().redeem(
			msg.sender,
			_shares
		);
		if (toRedeem == 0) {
			return 0;
		}
		depositReceipts[msg.sender] = depositReceipt;
		allowance[address(this)][msg.sender] = toRedeem;
		emit Redeem(msg.sender, toRedeem, depositReceipt.epoch);
		// transfer as the shares will have been minted in the epoch execution
		transferFrom(address(this), msg.sender, toRedeem);
		return toRedeem;
	}

	/**
	 * @notice get the Net Asset Value
	 * @return Net Asset Value in e18 decimal format
	 */
	function _getNAV() internal view returns (uint256) {
		// equities = assets - liabilities
		// assets: Any token such as eth usd, collateral sent to OptionRegistry, hedging reactor stuff in e18
		// liabilities: Options that we wrote in e18
		uint256 assets = _getAssets();
		int256 liabilities = _getLiabilities();
		// if this ever happens then something has gone very wrong so throw here
		if (int256(assets) < liabilities) {
			revert CustomErrors.LiabilitiesGreaterThanAssets();
		}
		return uint256(int256(assets) - liabilities);
	}

	/**
	 * @notice get the Asset Value
	 * @return assets Asset Value in e18 decimal format
	 */
	function _getAssets() internal view returns (uint256 assets) {
		// assets: Any token such as eth usd, collateral sent to OptionRegistry, hedging reactor stuff in e18
		// liabilities: Options that we wrote in e18
		assets =
			_getNormalizedBalance(collateralAsset) +
			OptionsCompute.convertFromDecimals(collateralAllocated, ERC20(collateralAsset).decimals());
		address[] memory hedgingReactors_ = hedgingReactors;
		for (uint8 i = 0; i < hedgingReactors_.length; i++) {
			// should always return value in e18 decimals
			assets += IHedgingReactor(hedgingReactors_[i]).getPoolDenominatedValue();
		}
	}

	function _getLiabilities() internal view returns (int256 liabilities) {
		Types.PortfolioValues memory portfolioValues = _getPortfolioValuesFeed().getPortfolioValues(
			underlyingAsset,
			strikeAsset
		);
		// check that the portfolio values are acceptable
		OptionsCompute.validatePortfolioValues(
			_getUnderlyingPrice(underlyingAsset, strikeAsset),
			portfolioValues,
			maxTimeDeviationThreshold,
			maxPriceDeviationThreshold
		);
		// ephemeralLiabilities can be +/-, portfolioValues.callPutsValue could be +/-
		liabilities = portfolioValues.callPutsValue + ephemeralLiabilities;
	}

	/**
	 * @notice calculates amount of liquidity that can be used before hitting buffer
	 * @return bufferRemaining the amount of liquidity available before reaching buffer in e6
	 */
	function checkBuffer() public view returns (uint256 bufferRemaining) {
		// calculate max amount of liquidity pool funds that can be used before reaching max buffer allowance
		uint256 collateralBalance = getBalance(collateralAsset);
		uint256 collateralBuffer = (collateralAllocated * bufferPercentage) / MAX_BPS;
		// revert if buffer allowance already hit
		if (collateralBuffer > collateralBalance) {
			return 0;
		}
		bufferRemaining = collateralBalance - collateralBuffer;
	}

	/**
	 * @notice create the option contract in the options registry
	 * @param  optionSeries option type to mint - option series strike in e18
	 * @param  optionRegistry interface for the options issuer
	 * @return series the address of the option series minted
	 */
	function _issue(Types.OptionSeries memory optionSeries, IOptionRegistry optionRegistry)
		internal
		returns (address series)
	{
		// make sure option is being issued with correct assets
		if (optionSeries.collateral != collateralAsset) {
			revert CustomErrors.CollateralAssetInvalid();
		}
		if (optionSeries.underlying != underlyingAsset) {
			revert CustomErrors.UnderlyingAssetInvalid();
		}
		if (optionSeries.strikeAsset != strikeAsset) {
			revert CustomErrors.StrikeAssetInvalid();
		}
		// cache
		Types.OptionParams memory optionParams_ = optionParams;
		// check the expiry is within the allowed bounds
		if (
			block.timestamp + optionParams_.minExpiry > optionSeries.expiration ||
			optionSeries.expiration > block.timestamp + optionParams_.maxExpiry
		) {
			revert CustomErrors.OptionExpiryInvalid();
		}
		// check that the option strike is within the range of the min and max acceptable strikes of calls and puts
		if (optionSeries.isPut) {
			if (
				optionParams_.minPutStrikePrice > optionSeries.strike ||
				optionSeries.strike > optionParams_.maxPutStrikePrice
			) {
				revert CustomErrors.OptionStrikeInvalid();
			}
		} else {
			if (
				optionParams_.minCallStrikePrice > optionSeries.strike ||
				optionSeries.strike > optionParams_.maxCallStrikePrice
			) {
				revert CustomErrors.OptionStrikeInvalid();
			}
		}
		// issue the option from the option registry (its characteristics will be stored in the optionsRegistry)
		series = optionRegistry.issue(optionSeries);
		if (series == address(0)) {
			revert CustomErrors.IssuanceFailed();
		}
	}

	/**
	 * @notice write a number of options for a given OptionSeries
	 * @param  optionSeries option type to mint - strike in e8
	 * @param  seriesAddress the address of the options series
	 * @param  amount the amount to be written - in e18
	 * @param  optionRegistry the option registry of the pool
	 * @param  premium the premium to charge the user - in collateral decimals
	 * @param  delta the delta of the option position - in e18
	 * @param  bufferRemaining the amount of buffer that can be used - in e6
	 * @return the amount that was written
	 */
	function _writeOption(
		Types.OptionSeries memory optionSeries,
		address seriesAddress,
		uint256 amount,
		IOptionRegistry optionRegistry,
		uint256 premium,
		int256 delta,
		uint256 bufferRemaining,
		address recipient
	) internal returns (uint256) {
		// strike decimals come into this function as e8
		uint256 collateralAmount = optionRegistry.getCollateral(optionSeries, amount);
		if (bufferRemaining < collateralAmount) {
			revert CustomErrors.MaxLiquidityBufferReached();
		}
		ERC20(collateralAsset).approve(address(optionRegistry), collateralAmount);
		(, collateralAmount) = optionRegistry.open(seriesAddress, amount, collateralAmount);
		emit WriteOption(seriesAddress, amount, premium, collateralAmount, recipient);
		// convert e8 strike to e18 strike
		optionSeries.strike = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals())
		);
		_adjustVariables(collateralAmount, premium, delta, true);
		SafeTransferLib.safeTransfer(
			ERC20(seriesAddress),
			recipient,
			OptionsCompute.convertToDecimals(amount, ERC20(seriesAddress).decimals())
		);
		// returns in e18
		return amount;
	}

	/**
	 * @notice buys a number of options back and burns the tokens
	 * @param optionSeries the option token series to buyback - strike passed in as e8
	 * @param amount the number of options to buyback expressed in 1e18
	 * @param optionRegistry the registry
	 * @param seriesAddress the series being sold
	 * @param premium the premium to be sent back to the owner (in collat decimals)
	 * @param delta the delta of the option
	 * @param seller the address
	 * @return the number of options burned in e18
	 */
	function _buybackOption(
		Types.OptionSeries memory optionSeries,
		uint256 amount,
		IOptionRegistry optionRegistry,
		address seriesAddress,
		uint256 premium,
		int256 delta,
		address seller
	) internal returns (uint256) {
		SafeTransferLib.safeApprove(
			ERC20(seriesAddress),
			address(optionRegistry),
			OptionsCompute.convertToDecimals(amount, ERC20(seriesAddress).decimals())
		);
		(, uint256 collateralReturned) = optionRegistry.close(seriesAddress, amount);
		emit BuybackOption(seriesAddress, amount, premium, collateralReturned, seller);
		// convert e8 strike to e18 strike
		optionSeries.strike = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals())
		);
		_adjustVariables(collateralReturned, premium, delta, false);
		if (getBalance(collateralAsset) < premium) {
			revert CustomErrors.WithdrawExceedsLiquidity();
		}
		SafeTransferLib.safeTransfer(ERC20(collateralAsset), seller, premium);
		return amount;
	}

	/**
	 * @notice adjust the variables of the pool
	 * @param  collateralAmount the amount of collateral transferred to change on collateral allocated in collateral decimals
	 * @param  optionsValue the value of the options in e18 decimals
	 * @param  delta the delta of the options in e18 decimals
	 * @param  isSale whether the action was an option sale or not
	 */
	function _adjustVariables(
		uint256 collateralAmount,
		uint256 optionsValue,
		int256 delta,
		bool isSale
	) internal {
		if (isSale) {
			collateralAllocated += collateralAmount;
			ephemeralLiabilities += int256(
				OptionsCompute.convertFromDecimals(optionsValue, ERC20(collateralAsset).decimals())
			);
			ephemeralDelta -= delta;
		} else {
			collateralAllocated -= collateralAmount;
			ephemeralLiabilities -= int256(
				OptionsCompute.convertFromDecimals(optionsValue, ERC20(collateralAsset).decimals())
			);
			ephemeralDelta += delta;
		}
	}

	/**
	 * @notice get the volatility feed used by the liquidity pool
	 * @return the volatility feed contract interface
	 */
	function _getVolatilityFeed() internal view returns (VolatilityFeed) {
		return VolatilityFeed(protocol.volatilityFeed());
	}

	/**
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function _getPortfolioValuesFeed() internal view returns (IPortfolioValuesFeed) {
		return IPortfolioValuesFeed(protocol.portfolioValuesFeed());
	}

	/**
	 * @notice get the DHV accounting calculations contract used by the liquidity pool
	 * @return the Accounting contract
	 */
	function _getAccounting() internal view returns (IAccounting) {
		return IAccounting(protocol.accounting());
	}

	/**
	 * @notice get the option registry used for storing and managing the options
	 * @return the option registry contract
	 */
	function _getOptionRegistry() internal view returns (IOptionRegistry) {
		return IOptionRegistry(protocol.optionRegistry());
	}

	/**
	 * @notice get the underlying price with just the underlying asset and strike asset
	 * @param underlying   the asset that is used as the reference asset
	 * @param _strikeAsset the asset that the underlying value is denominated in
	 * @return the underlying price
	 */
	function _getUnderlyingPrice(address underlying, address _strikeAsset)
		internal
		view
		returns (uint256)
	{
		return PriceFeed(protocol.priceFeed()).getNormalizedRate(underlying, _strikeAsset);
	}

	function _isTradingNotPaused() internal view {
		if (isTradingPaused) {
			revert CustomErrors.TradingPaused();
		}
	}

	function _isHandler() internal view {
		if (!handler[msg.sender]) {
			revert CustomErrors.NotHandler();
		}
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
