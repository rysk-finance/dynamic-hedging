// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./Protocol.sol";
import "./PriceFeed.sol";
import "./tokens/ERC20.sol";
import "./VolatilityFeed.sol";
import "./utils/ReentrancyGuard.sol";
import "./libraries/BlackScholes.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/SafeTransferLib.sol";
import "./interfaces/IOptionRegistry.sol";
import "./interfaces/IHedgingReactor.sol";
import "./interfaces/IPortfolioValuesFeed.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

contract LiquidityPool is ERC20, Ownable, AccessControl, ReentrancyGuard, Pausable {
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
	// epoch of the price per share round
	uint256 public epoch;
	// epoch PPS
	mapping(uint256 => uint256) public epochPricePerShare;
	// deposit receipts for users
	mapping(address => DepositReceipt) public depositReceipts;
	// withdrawal receipts for users
	mapping(address => WithdrawalReceipt) public withdrawalReceipts;
	// pending deposits for a round
	uint256 public pendingDeposits;

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
	uint256 belowThresholdGradient = 1e17; // 0.1
	// the gradient of the line above the utilization threshold. e18
	uint256 aboveThresholdGradient = 15e17; // 1.5
	// the y-intercept of the line above the threshold. Needed to make the two lines meet at the threshold.  Will always be negative but enter the absolute value
	uint256 aboveThresholdYIntercept = 84e16; //-0.84
	// the percentage utilization above which the function moves from its shallow line to its steep line. e18
	uint256 utilizationFunctionThreshold = 6e17; // 60%

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// Access control role identifier
	bytes32 private constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
	// BIPS
	uint256 private constant MAX_BPS = 10_000;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	struct UtilizationState {
		uint256 totalOptionPrice; //e18
		int256 totalDelta; // e18
		uint256 collateralToAllocate; //collateral decimals
		uint256 utilizationBefore; // e18
		uint256 utilizationAfter; //e18
		uint256 utilizationPrice; //e18
		bool isDecreased;
		uint256 deltaTiltAmount; //e18
		uint256 underlyingPrice; // strike asset decimals
		uint256 iv; // e18
	}

	struct DepositReceipt {
		uint128 epoch;
		uint128 amount;
		uint256 unredeemedShares;
	}

	struct WithdrawalReceipt {
		uint128 epoch;
		uint128 shares;
	}

	event EpochExecuted(uint256 epoch);
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
		address adminAddress
	) ERC20(name, symbol, 18) {
		// Grant admin role to deployer
		_setupRole(ADMIN_ROLE, adminAddress);
		strikeAsset = _strikeAsset;
		riskFreeRate = rfr;
		underlyingAsset = _underlyingAsset;
		collateralAsset = _collateralAsset;
		protocol = Protocol(_protocol);
		optionParams = _optionParams;
		epochPricePerShare[0] = 1e18;
		epoch++;
	}

	///////////////
	/// setters ///
	///////////////

	function pauseContract() external onlyOwner {
		_pause();
	}

	function pauseUnpauseTrading(bool _pause) external onlyOwner {
		isTradingPaused = _pause;
	}

	function unpause() external onlyOwner {
		_unpause();
	}

	/**
	 * @notice set a new hedging reactor
	 * @param _reactorAddress append a new hedging reactor
	 * @dev   only governance can call this function
	 */
	function setHedgingReactorAddress(address _reactorAddress) external onlyOwner {
		hedgingReactors.push(_reactorAddress);
		SafeTransferLib.safeApprove(ERC20(collateralAsset), _reactorAddress, type(uint256).max);
	}

	/**
	 * @notice remove a new hedging reactor by index
	 * @param _index remove a hedging reactor
	 * @dev   only governance can call this function
	 */
	function removeHedgingReactorAddress(uint256 _index) external onlyOwner {
		SafeTransferLib.safeApprove(ERC20(collateralAsset), hedgingReactors[_index], 0);
		for (uint256 i = _index; i < hedgingReactors.length - 1; i++) {
			hedgingReactors[i] = hedgingReactors[i + 1];
		}
		hedgingReactors.pop();
	}

	/**
	 * @notice update all optionParam variables
	 */
	function setNewOptionParams(
		uint128 _newMinCallStrike,
		uint128 _newMaxCallStrike,
		uint128 _newMinPutStrike,
		uint128 _newMaxPutStrike,
		uint128 _newMinExpiry,
		uint128 _newMaxExpiry
	) external onlyOwner {
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
	 */
	function setBidAskSpread(uint256 _bidAskSpread) external onlyOwner {
		bidAskIVSpread = _bidAskSpread;
	}

	/**
	 * @notice set the maximum percentage discount for an option
	 * @param _maxDiscount of the option as a percentage in 1e18 format. ie: 1*e18 == 1%
	 * @dev   only governance can call this function
	 */
	function setMaxDiscount(uint256 _maxDiscount) external onlyOwner {
		maxDiscount = _maxDiscount;
	}

	/**
	 * @notice set the maximum collateral amount allowed in the pool
	 * @param _collateralCap of the collateral held
	 * @dev   only governance can call this function
	 */
	function setCollateralCap(uint256 _collateralCap) external onlyOwner {
		collateralCap = _collateralCap;
	}

	/**
	 * @notice update the liquidity pool buffer limit
	 * @param _bufferPercentage the minimum balance the liquidity pool must have as a percentage of total NAV. (for 20% enter 2000)
	 */
	function setBufferPercentage(uint256 _bufferPercentage) external onlyOwner {
		bufferPercentage = _bufferPercentage;
	}

	/**
	 * @notice update the liquidity pool risk free rate
	 * @param _riskFreeRate the risk free rate of the market
	 */
	function setRiskFreeRate(uint256 _riskFreeRate) external onlyOwner {
		riskFreeRate = _riskFreeRate;
	}

	function setMaxTimeDeviationThreshold(uint256 _maxTimeDeviationThreshold) external onlyOwner {
		maxTimeDeviationThreshold = _maxTimeDeviationThreshold;
	}

	function setMaxPriceDeviationThreshold(uint256 _maxPriceDeviationThreshold) external onlyOwner {
		maxPriceDeviationThreshold = _maxPriceDeviationThreshold;
	}

	/**
	 * @notice change the status of a handler
	 */
	function changeHandler(address _handler, bool auth) external onlyOwner {
		handler[_handler] = auth;
	}

	/**
		@notice sets the parameters for the function that determines the utilization price factor
				The function is made up of two parts, both linear. The line to the left of the utilisation threshold has a low gradient
				while the gradient to the right of the threshold is much steeper. TThe aim of this function is to make options much more
				expensive near full utilization while not having much effect at low utilizations.
		@param _belowThresholdGradient the gradient of the function where utiization is below function threshold. e18
		@param _aboveThresholdGradient the gradient of the line above the utilization threshold. e18
		@param _aboveThresholdYIntercept the y-intercept of the line above the threshold. Needed to make the two lines meet at the threshold. Will always be negative but enter the absolute value
		@param _utilizationFunctionThreshold the percentage utilization above which the function moves from its shallow line to its steep line
    */
	function setUtilizationSkewParams(
		uint256 _belowThresholdGradient,
		uint256 _aboveThresholdGradient,
		uint256 _aboveThresholdYIntercept,
		uint256 _utilizationFunctionThreshold
	) external onlyOwner {
		belowThresholdGradient = _belowThresholdGradient;
		aboveThresholdGradient = _aboveThresholdGradient;
		aboveThresholdYIntercept = _aboveThresholdYIntercept;
		utilizationFunctionThreshold = _utilizationFunctionThreshold;
	}

	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/**
	 * @notice function for hedging portfolio delta through external means
	 * @param delta the current portfolio delta
	 */
	function rebalancePortfolioDelta(int256 delta, uint256 reactorIndex)
		external
		onlyRole(ADMIN_ROLE)
		whenNotPaused
	{
		IHedgingReactor(hedgingReactors[reactorIndex]).hedgeDelta(delta);
	}

	/**
    @notice adjust the collateral held in a specific vault because of health
    @param lpCollateralDifference amount of collateral taken from or given to the liquidity pool in collateral decimals
    @param addToLpBalance true if collateral is returned to liquidity pool, false if collateral is withdrawn from liquidity pool
  */
	function adjustCollateral(uint256 lpCollateralDifference, bool addToLpBalance) external {
		IOptionRegistry optionRegistry = getOptionRegistry();
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
    @notice closes an oToken vault, returning collateral (minus ITM option expiry value) back to the pool
    @param seriesAddress the address of the oToken vault to close
    @return collatReturned the amount of collateral returned to the liquidity pool.
  */
	function settleVault(address seriesAddress) public onlyRole(ADMIN_ROLE) returns (uint256) {
		// get number of options in vault and collateral returned to recalculate our position without these options
		// returns in collat decimals, collat decimals and e8
		(, uint256 collatReturned, uint256 collatLost, ) = getOptionRegistry().settle(seriesAddress);
		emit SettleVault(seriesAddress, collatReturned, collatLost, msg.sender);
		_adjustVariables(collatReturned, 0, 0, false);
		collateralAllocated -= collatLost;
		// assumes in collateral decimals
		return collatReturned;
	}

	/**
	 * @notice issue an option
	 * @param optionSeries the series detail of the option - strike decimals in e18
	 * @dev only callable by a handler contract
	 */
	function handlerIssue(Types.OptionSeries memory optionSeries) external returns (address) {
		require(handler[msg.sender]);
		// series strike in e18
		return _issue(optionSeries, getOptionRegistry());
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
		if (isTradingPaused) {
			revert CustomErrors.TradingPaused();
		}
		require(handler[msg.sender]);
		return
			_writeOption(
				optionSeries, // series strike in e8
				seriesAddress,
				amount, // in e18
				optionRegistry,
				premium, // in collat decimals
				delta,
				_checkBuffer(), // in e18
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
		if (isTradingPaused) {
			revert CustomErrors.TradingPaused();
		}
		require(handler[msg.sender]);
		IOptionRegistry optionRegistry = getOptionRegistry();
		// series strike passed in as e18
		address seriesAddress = _issue(optionSeries, optionRegistry);
		// series strike received in e8
		optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
		return (
			_writeOption(
				optionSeries, // strike in e8
				seriesAddress,
				amount, // in e18
				optionRegistry,
				premium, // in collat decimals
				delta,
				_checkBuffer(), // in e18
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
		if (isTradingPaused) {
			revert CustomErrors.TradingPaused();
		}
		require(handler[msg.sender]);
		// strike passed in as e8
		return
			_buybackOption(optionSeries, amount, optionRegistry, seriesAddress, premium, delta, seller);
	}

	/**
    @notice reset the temporary portfolio and delta values that have been changed since the last oracle update
    @dev    only callable by the portfolio values feed oracle contract
  */
	function resetEphemeralValues() external {
		require(msg.sender == address(getPortfolioValuesFeed()));
		delete ephemeralLiabilities;
		delete ephemeralDelta;
	}

	/**
	 * @notice reset the temporary portfolio and delta values that have been changed since the last oracle update
	 * @dev    this function must be called in order to execute an epoch calculation
	 */
	function pauseTradingAndRequest() external onlyOwner returns (bytes32) {
		// pause trading
		isTradingPaused = true;
		// make an oracle request
		return getPortfolioValuesFeed().requestPortfolioData(underlyingAsset, strikeAsset);
	}

	/**
	 * @notice execute the epoch and set all the price per shares
	 * @dev    this function must be called in order to execute an epoch calculation and batch a mutual fund epoch
	 */
	function executeEpochCalculation() external whenNotPaused onlyOwner {
		if (!isTradingPaused) {
			revert CustomErrors.TradingNotPaused();
		}
		uint256 newPricePerShare = totalSupply > 0
			? (1e18 *
				(_getNAV() -
					OptionsCompute.convertFromDecimals(pendingDeposits, ERC20(collateralAsset).decimals()))) /
				totalSupply
			: 1e18;
		uint256 sharesToMint = _sharesForAmount(pendingDeposits, newPricePerShare);
		epochPricePerShare[epoch] = newPricePerShare;
		delete pendingDeposits;
		isTradingPaused = false;
		emit EpochExecuted(epoch);
		epoch++;
		_mint(address(this), sharesToMint);
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
		_deposit(_amount);
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

		if (depositReceipts[msg.sender].amount > 0 || depositReceipts[msg.sender].unredeemedShares > 0) {
			// redeem so a user can use a completed deposit as shares for an initiation
			_redeem(type(uint256).max);
		}
		if (balanceOf[msg.sender] < _shares) {
			revert CustomErrors.InsufficientShareBalance();
		}
		uint256 currentEpoch = epoch;
		WithdrawalReceipt memory withdrawalReceipt = withdrawalReceipts[msg.sender];

		emit InitiateWithdraw(msg.sender, _shares, currentEpoch);
		uint256 existingShares = withdrawalReceipt.shares;
		uint256 withdrawalShares;
		if (withdrawalReceipt.epoch == currentEpoch) {
			withdrawalShares = existingShares + _shares;
		} else {
			// do 100 wei just in case of any rounding issues
			if (existingShares > 100) {
				revert CustomErrors.ExistingWithdrawal();
			}
			withdrawalShares = _shares;
			withdrawalReceipts[msg.sender].epoch = uint128(currentEpoch);
		}

		withdrawalReceipts[msg.sender].shares = uint128(withdrawalShares);
		transfer(address(this), _shares);
	}

	/**
	 * @notice function for completing the withdraw from a pool
	 * @param _shares    amount of shares to return
	 * @dev    entry point to remove liquidity to dynamic hedging vault
	 */
	function completeWithdraw(uint256 _shares) external whenNotPaused nonReentrant returns (uint256) {
		if (_shares == 0) {
			revert CustomErrors.InvalidShareAmount();
		}
		WithdrawalReceipt memory withdrawalReceipt = withdrawalReceipts[msg.sender];
		// cache the storage variables
		uint256 withdrawalShares = _shares > withdrawalReceipt.shares
			? withdrawalReceipt.shares
			: _shares;
		uint256 withdrawalEpoch = withdrawalReceipt.epoch;
		// make sure there is something to withdraw and make sure the round isnt the current one
		if (withdrawalShares == 0) {
			revert CustomErrors.NoExistingWithdrawal();
		}
		if (withdrawalEpoch == epoch) {
			revert CustomErrors.EpochNotClosed();
		}
		// reduced the stored share receipt by the shares requested
		withdrawalReceipts[msg.sender].shares -= uint128(withdrawalShares);
		// get the withdrawal amount based on the shares and pps at the epoch
		uint256 withdrawalAmount = _amountForShares(
			withdrawalShares,
			epochPricePerShare[withdrawalEpoch]
		);
		if (withdrawalAmount == 0) {
			revert CustomErrors.InvalidAmount();
		}
		// get the liquidity that can be withdrawn from the pool without hitting the collateral requirement buffer
		int256 buffer = int256((collateralAllocated * bufferPercentage) / MAX_BPS);
		int256 collatBalance = int256(ERC20(collateralAsset).balanceOf(address(this)));
		int256 bufferRemaining = collatBalance - buffer;
		// get the extra liquidity that is needed
		int256 amountNeeded = int256(withdrawalAmount) - bufferRemaining;
		// loop through the reactors and move funds
		if (amountNeeded > 0) {
			address[] memory hedgingReactors_ = hedgingReactors;
			for (uint8 i = 0; i < hedgingReactors_.length; i++) {
				amountNeeded -= int256(IHedgingReactor(hedgingReactors_[i]).withdraw(uint256(amountNeeded)));
				if (amountNeeded <= 0) {
					break;
				}
			}
			if (amountNeeded > 0) {
				revert CustomErrors.WithdrawExceedsLiquidity();
			}
		}
		emit Withdraw(msg.sender, withdrawalAmount, withdrawalShares);
		_burn(address(this), withdrawalShares);
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
	 * @return collateralBalance balance in original decimal format
	 * @return _decimals decimals of asset
	 */
	function getNormalizedBalance(address asset)
		internal
		view
		returns (
			uint256 normalizedBalance,
			uint256 collateralBalance,
			uint256 _decimals
		)
	{
		collateralBalance = IERC20(asset).balanceOf(address(this));
		_decimals = IERC20(asset).decimals();
		normalizedBalance = OptionsCompute.convertFromDecimals(collateralBalance, _decimals);
	}

	/**
	 * @notice get the delta of the portfolio
	 * @return portfolio delta
	 */
	function getPortfolioDelta() public view returns (int256) {
		// assumes in e18
		address underlyingAsset_ = underlyingAsset;
		address strikeAsset_ = strikeAsset;
		Types.PortfolioValues memory portfolioValues = getPortfolioValuesFeed().getPortfolioValues(
			underlyingAsset_,
			strikeAsset_
		);
		// check that the portfolio values are acceptable
		OptionsCompute.validatePortfolioValues(
			getUnderlyingPrice(underlyingAsset_, strikeAsset_),
			portfolioValues,
			maxTimeDeviationThreshold,
			maxPriceDeviationThreshold
		);
		// assumes in e18
		int256 externalDelta;
		address[] memory hedgingReactors_ = hedgingReactors;
		for (uint8 i = 0; i < hedgingReactors_.length; i++) {
			externalDelta += IHedgingReactor(hedgingReactors_[i]).getDelta();
		}
		return portfolioValues.delta + externalDelta + ephemeralDelta;
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
	) public view returns (uint256 quote, int256 delta) {
		// using a struct to get around stack too deep issues
		UtilizationState memory quoteState;
		quoteState.underlyingPrice = getUnderlyingPrice(
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
		int256 portfolioDelta = getPortfolioDelta();
		// portfolio delta upon writing option
		// subtract totalDelta because the pool is taking on the negative of the option's delta
		int256 newDelta = toBuy ? portfolioDelta + quoteState.totalDelta : portfolioDelta - quoteState.totalDelta;
		// Is delta moved closer to zero?
		quoteState.isDecreased = (PRBMathSD59x18.abs(newDelta) - PRBMathSD59x18.abs(portfolioDelta)) < 0;
		// delta exposure of the portolio per ETH equivalent value the portfolio holds.
		// This value is only used for tilting so we are only interested in its distance from 0 - its magnitude
		uint256 normalizedDelta = uint256(PRBMathSD59x18.abs((portfolioDelta + newDelta).div(2e18))).div(
			_getNAV().div(quoteState.underlyingPrice)
		);
		// this is the percentage of the option price which is added to or subtracted from option price
		// according to whether portfolio delta is increased or decreased respectively
		quoteState.deltaTiltAmount = normalizedDelta > maxDiscount ? maxDiscount : normalizedDelta;

		if (!toBuy) {
			// if selling options, we want to add the utilization premium
			// Work out the utilization of the pool as a percentage
			quoteState.utilizationBefore = collateralAllocated.div(
				collateralAllocated + ERC20(collateralAsset).balanceOf(address(this))
			);
			optionSeries.strike = optionSeries.strike / 1e10;
			// returns collateral decimals
			quoteState.collateralToAllocate = getOptionRegistry().getCollateral(optionSeries, amount);

			quoteState.utilizationAfter = (quoteState.collateralToAllocate + collateralAllocated).div(
				collateralAllocated + ERC20(collateralAsset).balanceOf(address(this))
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
			console.log("bsPrice:", quoteState.utilizationPrice);
		}
		if (quoteState.isDecreased) {
			quote = toBuy ?
				quoteState.deltaTiltAmount.mul(quoteState.utilizationPrice) +
				quoteState.utilizationPrice
				:
				quoteState.utilizationPrice -
				quoteState.deltaTiltAmount.mul(quoteState.utilizationPrice);
				
		} else {
			// increase utilization by delta tilt factor for moving delta away from zero
			quote = toBuy ?
				quoteState.utilizationPrice -
				quoteState.deltaTiltAmount.mul(quoteState.utilizationPrice)
				:
				quoteState.deltaTiltAmount.mul(quoteState.utilizationPrice) +
				quoteState.utilizationPrice;
			console.log("quote: ", quote);
		}
		quote = OptionsCompute.convertToCollateralDenominated(
			quote,
			quoteState.underlyingPrice,
			optionSeries
		);
		delta = quoteState.totalDelta;
		//@TODO think about more robust considitions for this check
		if (quote == 0 || delta == int256(0)) {
			revert CustomErrors.DeltaQuoteError(quote, delta);
		}
	}

	// /**
	//  * @notice get the quote price and delta for a given option
	//  * @param  optionSeries option type to quote - strike assumed in e18
	//  * @param  amount the number of options to buy - assumed in e18
	//  * @return quote the price of the options - assumed in collateral decimals
	//  * @return delta the delta of the options - assumed in e18
	//  */
	// function quotePriceBuying(Types.OptionSeries memory optionSeries, uint256 amount)
	// 	public
	// 	view
	// 	returns (uint256 quote, int256 delta)
	// {
	// 	uint256 underlyingPrice = getUnderlyingPrice(optionSeries.underlying, optionSeries.strikeAsset);
	// 	(uint256 optionQuote, int256 deltaQuote) = OptionsCompute.quotePriceGreeks(
	// 		optionSeries,
	// 		true,
	// 		bidAskIVSpread,
	// 		riskFreeRate,
	// 		getImpliedVolatility(
	// 			optionSeries.isPut,
	// 			underlyingPrice,
	// 			optionSeries.strike,
	// 			optionSeries.expiration
	// 		),
	// 		underlyingPrice
	// 	);
	// 	uint256 totalOptionPrice = optionQuote.mul(amount);
	// 	uint256 totalDelta = deltaQuote.mul(int256(amount));
	// 	// portfolio delta upon buying option
	// 	// portfolio takes on the delta of the options so add them
	// 	int256 newDelta = portfolioDelta + quoteState.totalDelta;

	// 	// Is delta moved closer to zero?
	// 	quoteState.isDecreased = (PRBMathSD59x18.abs(newDelta) - PRBMathSD59x18.abs(portfolioDelta)) < 0;

	// 	// delta exposure of the portolio per ETH equivalent value the portfolio holds.
	// 	// This value is only used for tilting so we are only interested in its distance from 0 - its magnitude
	// 	uint256 normalizedDelta = uint256(PRBMathSD59x18.abs((portfolioDelta + newDelta).div(2e18))).div(
	// 		_getNAV().div(underlyingPrice)
	// 	);
	// 	// this is the percentage of the option price which is added to or subtracted from option price
	// 	// according to whether portfolio delta is increased or decreased respectively
	// 	quoteState.deltaTiltAmount = normalizedDelta > maxDiscount ? maxDiscount : normalizedDelta;
	// 	if (quoteState.isDecreased) {
	// 		quote =
	// 			quoteState.totalOptionPrice -
	// 			quoteState.deltaTiltAmount.mul(quoteState.totalOptionPrice);
	// 	} else {
	// 		// increase utilization by delta tilt factor for moving delta away from zero
	// 		quote =
	// 			quoteState.deltaTiltAmount.mul(quoteState.totalOptionPrice) +
	// 			quoteState.totalOptionPrice;
	// 	}
	// 	quote = OptionsCompute.convertToCollateralDenominated(quote, underlyingPrice, optionSeries);
	// 	delta = totalDelta
	// 	//@TODO think about more robust considitions for this check
	// 	if (quote == 0 || delta == int256(0)) {
	// 		revert CustomErrors.DeltaQuoteError(quote, delta);
	// 	}
	// }

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
		return getVolatilityFeed().getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
	}

	function getNAV() external view returns (uint256) {
		return _getNAV();
	}

	//////////////////////////
	/// internal utilities ///
	//////////////////////////

	/**
	 * @notice function for queueing to add liquidity to the options liquidity pool and receiving storing interest
	 *         to receive shares when the next epoch is initiated.
	 * @param _amount    amount of the strike asset to deposit
	 * @dev    internal function for entry point to provide liquidity to dynamic hedging vault
	 */
	function _deposit(uint256 _amount) internal {
		uint256 currentEpoch = epoch;
		// check the total allowed collateral amount isnt surpassed by incrementing the total assets with the amount denominated in e18
		uint256 totalAmountWithDeposit = _getAssets() +
			OptionsCompute.convertFromDecimals(_amount, ERC20(collateralAsset).decimals());
		if (totalAmountWithDeposit > collateralCap) {
			revert CustomErrors.TotalSupplyReached();
		}
		emit Deposit(msg.sender, _amount, currentEpoch);
		DepositReceipt memory depositReceipt = depositReceipts[msg.sender];
		// check for any unredeemed shares
		uint256 unredeemedShares = uint256(depositReceipt.unredeemedShares);
		// if there is already a receipt from a previous round then acknowledge and record it
		if (depositReceipt.epoch != 0 && depositReceipt.epoch < currentEpoch) {
			unredeemedShares += _sharesForAmount(
				depositReceipt.amount,
				epochPricePerShare[depositReceipt.epoch]
			);
		}
		uint256 depositAmount = _amount;
		// if there is a second deposit in the same round then increment this amount
		if (currentEpoch == depositReceipt.epoch) {
			depositAmount += uint256(depositReceipt.amount);
		}
		require(depositAmount <= type(uint128).max, "overflow");
		// create the deposit receipt
		depositReceipts[msg.sender] = DepositReceipt({
			epoch: uint128(currentEpoch),
			amount: uint128(depositAmount),
			unredeemedShares: unredeemedShares
		});
		pendingDeposits += _amount;
	}

	/**
	 * @notice functionality for allowing a user to redeem their shares from a previous epoch
	 * @param _shares the number of shares to redeem
	 * @return the number of shares actually returned
	 */
	function _redeem(uint256 _shares) internal returns (uint256) {
		DepositReceipt memory depositReceipt = depositReceipts[msg.sender];
		uint256 currentEpoch = epoch;
		// check for any unredeemed shares
		uint256 unredeemedShares = uint256(depositReceipt.unredeemedShares);
		// if there is already a receipt from a previous round then acknowledge and record it
		if (depositReceipt.epoch != 0 && depositReceipt.epoch < currentEpoch) {
			unredeemedShares += _sharesForAmount(
				depositReceipt.amount,
				epochPricePerShare[depositReceipt.epoch]
			);
		}
		// if the shares requested are greater than their unredeemedShares then floor to unredeemedShares, otherwise
		// use their requested share number
		uint256 toRedeem = _shares > unredeemedShares ? unredeemedShares : _shares;
		if (toRedeem == 0) {
			return 0;
		}
		// if the deposit receipt is on this epoch and there are unredeemed shares then we leave amount as is,
		// if the epoch has past then we set the amount to 0 and take from the unredeemedShares
		if (depositReceipt.epoch < currentEpoch) {
			depositReceipts[msg.sender].amount = 0;
		}
		depositReceipts[msg.sender].unredeemedShares = uint128(unredeemedShares - toRedeem);
		emit Redeem(msg.sender, toRedeem, depositReceipt.epoch);
		allowance[address(this)][msg.sender] = toRedeem;
		// transfer as the shares will have been minted in the epoch execution
		transferFrom(address(this), msg.sender, toRedeem);
		return toRedeem;
	}

	/**
	 * @notice get the number of shares for a given amount
	 * @param _amount  the amount to convert to shares - assumed in collateral decimals
	 * @return shares the number of shares based on the amount - assumed in e18
	 */
	function _sharesForAmount(uint256 _amount, uint256 assetPerShare)
		internal
		view
		returns (uint256 shares)
	{
		uint256 convertedAmount = OptionsCompute.convertFromDecimals(
			_amount,
			IERC20(collateralAsset).decimals()
		);
		shares = (convertedAmount * PRBMath.SCALE) / assetPerShare;
	}

	/**
	 * @notice get the amount for a given number of shares
	 * @param _shares  the shares to convert to amount in e18
	 * @return amount the number of amount based on shares in collateral decimals
	 */
	function _amountForShares(uint256 _shares, uint256 _assetPerShare)
		internal
		view
		returns (uint256 amount)
	{
		amount = OptionsCompute.convertToDecimals(
			(_shares * _assetPerShare) / PRBMath.SCALE,
			ERC20(collateralAsset).decimals()
		);
	}

	/**
	 * @notice get the Net Asset Value
	 * @return Net Asset Value in e18 decimal format
	 */
	function _getNAV() internal view returns (uint256) {
		// cache
		address underlyingAsset_ = underlyingAsset;
		address strikeAsset_ = strikeAsset;
		// equities = assets - liabilities
		// assets: Any token such as eth usd, collateral sent to OptionRegistry, hedging reactor stuff in e18
		// liabilities: Options that we wrote in e18
		uint256 assets = _getAssets();
		Types.PortfolioValues memory portfolioValues = getPortfolioValuesFeed().getPortfolioValues(
			underlyingAsset_,
			strikeAsset_
		);
		// check that the portfolio values are acceptable
		OptionsCompute.validatePortfolioValues(
			getUnderlyingPrice(underlyingAsset_, strikeAsset_),
			portfolioValues,
			maxTimeDeviationThreshold,
			maxPriceDeviationThreshold
		);
		int256 ephemeralLiabilities_ = ephemeralLiabilities;
		// ephemeralLiabilities can be -ve but portfolioValues will not
		// when converting liabilities it should never be -ve, if it is then the NAV calc will fail
		uint256 liabilities = portfolioValues.callPutsValue +
			(ephemeralLiabilities_ > 0 ? uint256(ephemeralLiabilities_) : uint256(-ephemeralLiabilities_));
		return assets - liabilities;
	}

	/**
	 * @notice get the Asset Value
	 * @return Asset Value in e18 decimal format
	 */
	function _getAssets() internal view returns (uint256) {
		address collateralAsset_ = collateralAsset;
		// assets: Any token such as eth usd, collateral sent to OptionRegistry, hedging reactor stuff in e18
		// liabilities: Options that we wrote in e18
		uint256 assets = OptionsCompute.convertFromDecimals(
			IERC20(collateralAsset_).balanceOf(address(this)),
			IERC20(collateralAsset_).decimals()
		) + OptionsCompute.convertFromDecimals(collateralAllocated, IERC20(collateralAsset_).decimals());
		address[] memory hedgingReactors_ = hedgingReactors;
		for (uint8 i = 0; i < hedgingReactors_.length; i++) {
			// should always return value in e18 decimals
			assets += IHedgingReactor(hedgingReactors_[i]).getPoolDenominatedValue();
		}
		return assets;
	}

	/**
	 * @notice calculates amount of liquidity that can be used before hitting buffer
	 * @return bufferRemaining the amount of liquidity available before reaching buffer in e18
	 */
	function _checkBuffer() internal view returns (int256 bufferRemaining) {
		// calculate max amount of liquidity pool funds that can be used before reaching max buffer allowance
		(uint256 normalizedCollateralBalance, , ) = getNormalizedBalance(collateralAsset);
		bufferRemaining = int256(normalizedCollateralBalance - (_getNAV() * bufferPercentage) / MAX_BPS);
		// revert CustomErrors.if buffer allowance already hit
		if (bufferRemaining <= 0) {
			revert CustomErrors.MaxLiquidityBufferReached();
		}
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
	 * @param  bufferRemaining the amount of buffer that can be used - in e18
	 * @return the amount that was written
	 */
	function _writeOption(
		Types.OptionSeries memory optionSeries,
		address seriesAddress,
		uint256 amount,
		IOptionRegistry optionRegistry,
		uint256 premium,
		int256 delta,
		int256 bufferRemaining,
		address recipient
	) internal returns (uint256) {
		// strike decimals come into this function as e8
		uint256 collateralAmount = optionRegistry.getCollateral(optionSeries, amount);
		if (
			uint256(bufferRemaining) <
			OptionsCompute.convertFromDecimals(collateralAmount, IERC20(collateralAsset).decimals())
		) {
			revert CustomErrors.MaxLiquidityBufferReached();
		}
		IERC20(collateralAsset).approve(address(optionRegistry), collateralAmount);
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
			OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals())
		);
		// returns in e18
		return amount;
	}

	/**
    @notice buys a number of options back and burns the tokens
    @param optionSeries the option token series to buyback - strike passed in as e8
    @param amount the number of options to buyback expressed in 1e18
    @param optionRegistry the registry
    @param seriesAddress the series being sold
    @param premium the premium to be sent back to the owner (in collat decimals)
    @param delta the delta of the option
    @param seller the address 
    @return the number of options burned in e18
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
			OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals())
		);
		(, uint256 collateralReturned) = optionRegistry.close(seriesAddress, amount);
		emit BuybackOption(seriesAddress, amount, premium, collateralReturned, seller);
		// convert e8 strike to e18 strike
		optionSeries.strike = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals())
		);
		_adjustVariables(collateralReturned, premium, delta, false);
		SafeTransferLib.safeTransfer(ERC20(collateralAsset), seller, premium);
		return amount;
	}

	/**
	 * @notice adjust the variables of the pool
	 * @param  collateralAmount the amount of collateral transferred to change on collateral allocated in collateral decimals
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
	function getVolatilityFeed() internal view returns (VolatilityFeed) {
		return VolatilityFeed(protocol.volatilityFeed());
	}

	/**
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function getPortfolioValuesFeed() internal view returns (IPortfolioValuesFeed) {
		return IPortfolioValuesFeed(protocol.portfolioValuesFeed());
	}

	/**
	 * @notice get the option registry used for storing and managing the options
	 * @return the option registry contract
	 */
	function getOptionRegistry() internal view returns (IOptionRegistry) {
		return IOptionRegistry(protocol.optionRegistry());
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
		return PriceFeed(protocol.priceFeed()).getNormalizedRate(underlying, _strikeAsset);
	}
}
