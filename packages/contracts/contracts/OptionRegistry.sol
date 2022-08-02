// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import { LiquidityPool } from "./LiquidityPool.sol";

import "./tokens/ERC20.sol";
import "./libraries/AccessControl.sol";
import { Types } from "./libraries/Types.sol";
import { CustomErrors } from "./libraries/CustomErrors.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import { SafeTransferLib } from "./libraries/SafeTransferLib.sol";
import { OpynInteractions } from "./libraries/OpynInteractions.sol";

import "./interfaces/IOracle.sol";
import "./interfaces/IMarginCalculator.sol";
import "./interfaces/AddressBookInterface.sol";
import { IController, GammaTypes } from "./interfaces/GammaInterface.sol";

/**
 *  @title Contract used for conducting options issuance and settlement as well as collateral management
 *  @dev Interacts with the opyn-rysk gamma protocol via OpynInteractions for options activity. Interacts with
 *       the liquidity pool for collateral and instructions.
 */
contract OptionRegistry is AccessControl {
	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	// address of the opyn oTokenFactory for oToken minting
	address internal immutable oTokenFactory;
	// address of the gammaController for oToken operations
	address internal immutable gammaController;
	// address of the collateralAsset
	address public immutable collateralAsset;
	// address of the opyn addressBook for accessing important opyn modules
	AddressBookInterface public immutable addressBook;
	// address of the marginPool, contract for storing options collateral
	address internal immutable marginPool;

	/////////////////////////
	/// dynamic variables ///
	/////////////////////////

	// information of a series
	mapping(address => Types.OptionSeries) public seriesInfo;
	// vaultId that is responsible for a specific series address
	mapping(address => uint256) public vaultIds;
	// issuance hash mapped against the series address
	mapping(bytes32 => address) seriesAddress;
	// vault counter
	uint64 public vaultCount;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	// address of the rysk liquidity pools
	address public liquidityPool;
	// max health threshold for calls
	uint64 public callUpperHealthFactor = 13_000;
	// min health threshold for calls
	uint64 public callLowerHealthFactor = 11_000;
	// max health threshold for puts
	uint64 public putUpperHealthFactor = 12_000;
	// min health threshold for puts
	uint64 public putLowerHealthFactor = 11_000;
	// keeper addresses for this contract
	mapping(address => bool) public keeper;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;
	// used to convert e18 to e8
	uint256 private constant SCALE_FROM = 10**10;
	// oToken decimals
	uint8 private constant OPYN_DECIMALS = 8;

	/////////////////////////////////////
	/// events && errors && modifiers ///
	/////////////////////////////////////

	event OptionTokenCreated(address token);
	event SeriesRedeemed(address series, uint256 underlyingAmount, uint256 strikeAmount);
	event OptionsContractOpened(address indexed series, uint256 vaultId, uint256 optionsAmount);
	event OptionsContractClosed(address indexed series, uint256 vaultId, uint256 closedAmount);
	event OptionsContractSettled(
		address indexed series,
		uint256 collateralReturned,
		uint256 collateralLost,
		uint256 amountLost
	);
	event VaultLiquidationRegistered(
		address indexed series,
		uint256 vaultId,
		uint256 amountLiquidated,
		uint256 collateralLiquidated
	);

	error NoVault();
	error NotKeeper();
	error NotExpired();
	error HealthyVault();
	error AlreadyExpired();
	error NotLiquidityPool();
	error NonExistentSeries();
	error InvalidCollateral();
	error VaultNotLiquidated();
	error InsufficientBalance();

	constructor(
		address _collateralAsset,
		address _oTokenFactory,
		address _gammaController,
		address _marginPool,
		address _liquidityPool,
		address _addressBook,
		address _authority
	) AccessControl(IAuthority(_authority)) {
		collateralAsset = _collateralAsset;
		oTokenFactory = _oTokenFactory;
		gammaController = _gammaController;
		marginPool = _marginPool;
		liquidityPool = _liquidityPool;
		addressBook = AddressBookInterface(_addressBook);
	}

	///////////////
	/// setters ///
	///////////////

	/**
	 * @notice Set the liquidity pool address
	 * @param  _newLiquidityPool set the liquidityPool address
	 */
	function setLiquidityPool(address _newLiquidityPool) external {
		_onlyGovernor();
		liquidityPool = _newLiquidityPool;
	}

	/**
	 * @notice Set or revoke a keeper
	 * @param  _target address to become a keeper
	 * @param  _auth accept or revoke
	 */
	function setKeeper(address _target, bool _auth) external {
		_onlyGovernor();
		keeper[_target] = _auth;
	}

	/**
	 * @notice Set the health thresholds of the pool
	 * @param  _putLower the lower health threshold for puts
	 * @param  _putUpper the upper health threshold for puts
	 * @param  _callLower the lower health threshold for calls
	 * @param  _callUpper the upper health threshold for calls
	 */
	function setHealthThresholds(
		uint64 _putLower,
		uint64 _putUpper,
		uint64 _callLower,
		uint64 _callUpper
	) external {
		_onlyGovernor();
		putLowerHealthFactor = _putLower;
		putUpperHealthFactor = _putUpper;
		callLowerHealthFactor = _callLower;
		callUpperHealthFactor = _callUpper;
	}

	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/**
	 * @notice Either retrieves the option token if it already exists, or deploy it
	 * @param  optionSeries the series used for the mint - strike passed in as e18
	 * @return the address of the option
	 */
	function issue(Types.OptionSeries memory optionSeries) external returns (address) {
		_isLiquidityPool();
		// deploy an oToken contract address
		if (optionSeries.expiration <= block.timestamp) {
			revert AlreadyExpired();
		}
		// assumes strike is passed in e18, converts to e8
		uint128 formattedStrike = uint128(
			formatStrikePrice(optionSeries.strike, optionSeries.collateral)
		);
		// create option storage hash
		bytes32 issuanceHash = getIssuanceHash(
			optionSeries.underlying,
			optionSeries.strikeAsset,
			optionSeries.collateral,
			optionSeries.expiration,
			optionSeries.isPut,
			formattedStrike
		);
		// check for an opyn oToken if it doesn't exist deploy it
		address series = OpynInteractions.getOrDeployOtoken(
			oTokenFactory,
			optionSeries.collateral,
			optionSeries.underlying,
			optionSeries.strikeAsset,
			formattedStrike,
			optionSeries.expiration,
			optionSeries.isPut
		);
		// store the option data as a hash
		seriesInfo[series] = Types.OptionSeries(
			optionSeries.expiration,
			formattedStrike,
			optionSeries.isPut,
			optionSeries.underlying,
			optionSeries.strikeAsset,
			optionSeries.collateral
		);
		seriesAddress[issuanceHash] = series;
		emit OptionTokenCreated(series);
		return series;
	}

	/**
	 * @notice Open an options contract using collateral from the liquidity pool
	 * @param  _series the address of the option token to be created
	 * @param  amount the amount of options to deploy - assume in e18
	 * @param  collateralAmount the collateral required for the option - assumes in collateral decimals
	 * @dev only callable by the liquidityPool
	 * @return if the transaction succeeded
	 * @return the amount of collateral taken from the liquidityPool
	 */
	function open(
		address _series,
		uint256 amount,
		uint256 collateralAmount
	) external returns (bool, uint256) {
		_isLiquidityPool();
		// make sure the options are ok to open
		Types.OptionSeries memory series = seriesInfo[_series];
		// assumes strike in e8
		if (series.expiration <= block.timestamp) {
			revert AlreadyExpired();
		}
		// transfer collateral to this contract, collateral will depend on the option type
		SafeTransferLib.safeTransferFrom(series.collateral, msg.sender, address(this), collateralAmount);
		// mint the option token following the opyn interface
		IController controller = IController(gammaController);
		// check if a vault for this option already exists
		uint256 vaultId_ = vaultIds[_series];
		if (vaultId_ == 0) {
			vaultId_ = (controller.getAccountVaultCounter(address(this))) + 1;
			vaultCount++;
		}
		uint256 mintAmount = OpynInteractions.createShort(
			gammaController,
			marginPool,
			_series,
			collateralAmount,
			vaultId_,
			amount,
			1
		);
		emit OptionsContractOpened(_series, vaultId_, mintAmount);
		// transfer the option to the liquidity pool
		SafeTransferLib.safeTransfer(ERC20(_series), msg.sender, mintAmount);
		vaultIds[_series] = vaultId_;
		// returns in collateral decimals
		return (true, collateralAmount);
	}

	/**
	 * @notice Close an options contract (oToken) before it has expired
	 * @param  _series the address of the option token to be burnt
	 * @param  amount the amount of options to burn - assumes in e18
	 * @dev only callable by the liquidityPool
	 * @return if the transaction succeeded
	 */
	function close(address _series, uint256 amount) external returns (bool, uint256) {
		_isLiquidityPool();
		// withdraw and burn
		Types.OptionSeries memory series = seriesInfo[_series];
		// assumes strike in e8
		// make sure the option hasnt expired yet
		if (series.expiration == 0) {
			revert NonExistentSeries();
		}
		if (series.expiration <= block.timestamp) {
			revert AlreadyExpired();
		}
		// get the vault id
		uint256 vaultId = vaultIds[_series];
		if (vaultId == 0) {
			revert NoVault();
		}
		uint256 convertedAmount = OptionsCompute.convertToDecimals(amount, ERC20(_series).decimals());
		// transfer the oToken back to this account
		SafeTransferLib.safeTransferFrom(_series, msg.sender, address(this), convertedAmount);
		// burn the oToken tracking the amount of collateral returned
		uint256 collatReturned = OpynInteractions.burnShort(
			gammaController,
			_series,
			convertedAmount,
			vaultId
		);
		SafeTransferLib.safeTransfer(ERC20(series.collateral), msg.sender, collatReturned);
		emit OptionsContractClosed(_series, vaultId, convertedAmount);
		// returns in collateral decimals
		return (true, collatReturned);
	}

	/**
	 * @notice Settle an options vault
	 * @param  _series the address of the option token to be burnt
	 * @return  if the transaction succeeded
	 * @return  the amount of collateral returned from the vault
	 * @return  the amount of collateral used to pay ITM options on vault settle
	 * @return  number of oTokens that the vault was short
	 * @dev callable by the liquidityPool so that local variables can also be updated
	 */
	function settle(address _series)
		external
		returns (
			bool,
			uint256,
			uint256,
			uint256
		)
	{
		_isLiquidityPool();
		Types.OptionSeries memory series = seriesInfo[_series];
		// strike will be in e8
		if (series.expiration == 0) {
			revert NonExistentSeries();
		}
		// check that the option has expired
		if (series.expiration >= block.timestamp) {
			revert NotExpired();
		}
		// get the vault
		uint256 vaultId = vaultIds[_series];
		// settle the vault
		(uint256 collatReturned, uint256 collatLost, uint256 amountShort) = OpynInteractions.settle(
			gammaController,
			vaultId
		);
		// transfer the collateral back to the liquidity pool
		SafeTransferLib.safeTransfer(ERC20(series.collateral), liquidityPool, collatReturned);
		emit OptionsContractSettled(_series, collatReturned, collatLost, amountShort);
		// assumes in collateral decimals, collateral decimals, e8
		return (true, collatReturned, collatLost, amountShort);
	}

	/**
	 * @notice adjust the collateral held in a specific vault because of health
	 * @param  vaultId the id of the vault to check
	 */
	function adjustCollateral(uint256 vaultId) external {
		_isKeeper();
		(
			bool isBelowMin,
			bool isAboveMax,
			,
			,
			uint256 collateralAmount,
			address _collateralAsset
		) = checkVaultHealth(vaultId);
		if (collateralAsset != _collateralAsset) {
			revert InvalidCollateral();
		}
		if (!isBelowMin && !isAboveMax) {
			revert HealthyVault();
		}
		if (isBelowMin) {
			LiquidityPool(liquidityPool).adjustCollateral(collateralAmount, false);
			// transfer the needed collateral to this contract from the liquidityPool
			SafeTransferLib.safeTransferFrom(
				_collateralAsset,
				liquidityPool,
				address(this),
				collateralAmount
			);
			// increase the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
			OpynInteractions.depositCollat(
				gammaController,
				marginPool,
				_collateralAsset,
				collateralAmount,
				vaultId
			);
		} else if (isAboveMax) {
			LiquidityPool(liquidityPool).adjustCollateral(collateralAmount, true);
			// decrease the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
			OpynInteractions.withdrawCollat(gammaController, _collateralAsset, collateralAmount, vaultId);
			// transfer the excess collateral to the liquidityPool from this address
			SafeTransferLib.safeTransfer(ERC20(_collateralAsset), liquidityPool, collateralAmount);
		}
	}

	/**
	 * @notice adjust the collateral held in a specific vault because of health, using collateral from the caller. Only takes
	 *         from msg.sender, doesnt give them if vault is above the max.
	 * @param  vaultId the id of the vault to check
	 * @dev    this is a safety function, if worst comes to worse any caller can collateralise a vault to save it.
	 */
	function adjustCollateralCaller(uint256 vaultId) external {
		_onlyGuardian();
		(bool isBelowMin, , , , uint256 collateralAmount, address _collateralAsset) = checkVaultHealth(
			vaultId
		);
		if (collateralAsset != _collateralAsset) {
			revert InvalidCollateral();
		}
		if (!isBelowMin) {
			revert HealthyVault();
		}
		// transfer the needed collateral to this contract from the msg.sender
		SafeTransferLib.safeTransferFrom(_collateralAsset, msg.sender, address(this), collateralAmount);
		// increase the collateral in the vault
		OpynInteractions.depositCollat(
			gammaController,
			marginPool,
			_collateralAsset,
			collateralAmount,
			vaultId
		);
	}

	/**
	 * @notice withdraw collateral from a fully liquidated vault
	 * @param  vaultId the id of the vault to check
	 * @dev    this is a safety function, if a vault is liquidated.
	 */
	function wCollatLiquidatedVault(uint256 vaultId) external {
		_isKeeper();
		// get the vault details from the vaultId
		GammaTypes.Vault memory vault = IController(gammaController).getVault(address(this), vaultId);
		require(vault.shortAmounts[0] == 0, "Vault has short positions [amount]");
		require(vault.shortOtokens[0] == address(0), "Vault has short positions [token]");
		require(vault.collateralAmounts[0] > 0, "Vault has no collateral");
		// decrease the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
		OpynInteractions.withdrawCollat(
			gammaController,
			vault.collateralAssets[0],
			vault.collateralAmounts[0],
			vaultId
		);
		// adjust the collateral in the liquidityPool
		LiquidityPool(liquidityPool).adjustCollateral(vault.collateralAmounts[0], true);
		// transfer the excess collateral to the liquidityPool from this address
		SafeTransferLib.safeTransfer(
			ERC20(vault.collateralAssets[0]),
			liquidityPool,
			vault.collateralAmounts[0]
		);
	}

	/**
	 * @notice register a liquidated vault so the collateral allocated is managed
	 * @param  vaultId the id of the vault to register liquidation for
	 * @dev    this is a safety function, if a vault is liquidated to update the collateral assets in the pool
	 */
	function registerLiquidatedVault(uint256 vaultId) external {
		_isKeeper();
		// get the vault liquidation details from the vaultId
		(address series, uint256 amount, uint256 collateralLiquidated) = IController(gammaController)
			.getVaultLiquidationDetails(address(this), vaultId);
		if (series == address(0)) {
			revert VaultNotLiquidated();
		}
		emit VaultLiquidationRegistered(series, vaultId, amount, collateralLiquidated);
		// adjust the collateral in the liquidity pool to reflect the loss
		LiquidityPool(liquidityPool).adjustCollateral(collateralLiquidated, true);
		// clear the liquidation record from gamma controller so as not to double count the liquidation
		IController(gammaController).clearVaultLiquidationDetails(vaultId);
	}

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/**
	 * @notice Redeem oTokens for the locked collateral
	 * @param  _series the address of the option token to be burnt and redeemed
	 * @return amount returned
	 */
	function redeem(address _series) external returns (uint256) {
		Types.OptionSeries memory series = seriesInfo[_series];
		// strike will be in e8
		if (series.expiration == 0) {
			revert NonExistentSeries();
		}
		// check that the option has expired
		if (series.expiration >= block.timestamp) {
			revert NotExpired();
		}
		uint256 seriesBalance = ERC20(_series).balanceOf(msg.sender);
		if (seriesBalance == 0) {
			revert InsufficientBalance();
		}
		// transfer the oToken back to this account
		SafeTransferLib.safeTransferFrom(_series, msg.sender, address(this), seriesBalance);
		// redeem
		uint256 collatReturned = OpynInteractions.redeem(
			gammaController,
			marginPool,
			_series,
			seriesBalance
		);
		// assumes in collateral decimals
		return collatReturned;
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	/**
	 * @notice Send collateral funds for an option to be minted
	 * @dev series.strike should be scaled by 1e8.
	 * @param  series details of the option series
	 * @param  amount amount of options to mint always in e18
	 * @return amount transferred
	 */
	function getCollateral(Types.OptionSeries memory series, uint256 amount)
		external
		view
		returns (uint256)
	{
		IMarginCalculator marginCalc = IMarginCalculator(addressBook.getMarginCalculator());
		uint256 collateralAmount = marginCalc.getNakedMarginRequired(
			series.underlying,
			series.strikeAsset,
			series.collateral,
			amount / SCALE_FROM, // assumes that amount is always in e18
			series.strike, // assumes in e8
			IOracle(addressBook.getOracle()).getPrice(series.underlying),
			series.expiration,
			ERC20(series.collateral).decimals(),
			series.isPut
		);
		// based on this collateral requirement and the health factor get the amount to deposit
		uint256 upperHealthFactor = series.isPut ? putUpperHealthFactor : callUpperHealthFactor;
		collateralAmount = ((collateralAmount * upperHealthFactor) / MAX_BPS);
		// assumes in collateral decimals
		return collateralAmount;
	}

	/**
	 * @notice Retrieves the option token if it exists
	 * @param  underlying is the address of the underlying asset of the option
	 * @param  strikeAsset is the address of the collateral asset of the option
	 * @param  expiration is the expiry timestamp of the option
	 * @param  isPut the type of option
	 * @param  strike is the strike price of the option - 1e18 format
	 * @param  collateral is the address of the asset to collateralize the option with
	 * @return the address of the option
	 */
	function getOtoken(
		address underlying,
		address strikeAsset,
		uint256 expiration,
		bool isPut,
		uint256 strike,
		address collateral
	) external view returns (address) {
		// check for an opyn oToken
		address series = OpynInteractions.getOtoken(
			oTokenFactory,
			collateral,
			underlying,
			strikeAsset,
			formatStrikePrice(strike, collateral),
			expiration,
			isPut
		);
		return series;
	}

	/**
	 * @notice check the health of a specific vault to see if it requires collateral
	 * @param  vaultId the id of the vault to check
	 * @return isBelowMin bool to determine whether the vault needs topping up
	 * @return isAboveMax bool to determine whether the vault is too overcollateralised
	 * @return healthFactor the health factor of the vault in MAX_BPS format
	 * @return upperHealthFactor the upper bound of the acceptable health facor range in MAX_BPS format
	 * @return collatRequired the amount of collateral required to return the vault back to normal
	 * @return collatAsset the address of the collateral asset
	 */
	function checkVaultHealth(uint256 vaultId)
		public
		view
		returns (
			bool isBelowMin,
			bool isAboveMax,
			uint256 healthFactor,
			uint256 upperHealthFactor,
			uint256 collatRequired,
			address collatAsset
		)
	{
		// run checks on the vault health
		// get the vault details from the vaultId
		GammaTypes.Vault memory vault = IController(gammaController).getVault(address(this), vaultId);
		// get the series
		Types.OptionSeries memory series = seriesInfo[vault.shortOtokens[0]];
		// get the MarginRequired
		IMarginCalculator marginCalc = IMarginCalculator(addressBook.getMarginCalculator());

		uint256 marginReq = marginCalc.getNakedMarginRequired(
			series.underlying,
			series.strikeAsset,
			series.collateral,
			vault.shortAmounts[0], // assumes in e8
			series.strike, // assumes in e8
			IOracle(addressBook.getOracle()).getPrice(series.underlying),
			series.expiration,
			ERC20(series.collateral).decimals(),
			series.isPut
		);
		// get the amount held in the vault
		uint256 collatAmount = vault.collateralAmounts[0];
		// divide the amount held in the vault by the margin requirements to get the health factor
		healthFactor = (collatAmount * MAX_BPS) / marginReq;
		// set the upper and lower health factor depending on if the series is a put or a call
		upperHealthFactor = series.isPut ? putUpperHealthFactor : callUpperHealthFactor;
		uint256 lowerHealthFactor = series.isPut ? putLowerHealthFactor : callLowerHealthFactor;
		// if the vault health is above a certain threshold then the vault is above safe margins and collateral can be withdrawn
		if (healthFactor > upperHealthFactor) {
			isAboveMax = true;
			// calculate the margin to remove from the vault
			collatRequired = collatAmount - ((marginReq * upperHealthFactor) / MAX_BPS);
		} else if (healthFactor < lowerHealthFactor) {
			isBelowMin = true;
			// calculate the margin to add to the vault
			collatRequired = ((marginReq * upperHealthFactor) / MAX_BPS) - collatAmount;
		}
		collatAsset = series.collateral;
	}

	///////////////////////////
	/// non-complex getters ///
	///////////////////////////

	function getSeriesAddress(bytes32 issuanceHash) external view returns (address) {
		return seriesAddress[issuanceHash];
	}

	function getSeries(Types.OptionSeries memory _series) external view returns (address) {
		return
			seriesAddress[
				getIssuanceHash(
					_series.underlying,
					_series.strikeAsset,
					_series.collateral,
					_series.expiration,
					_series.isPut,
					_series.strike
				)
			];
	}

	function getSeriesInfo(address series) external view returns (Types.OptionSeries memory) {
		return seriesInfo[series];
	}

	function getIssuanceHash(Types.OptionSeries memory _series) public pure returns (bytes32) {
		return
			getIssuanceHash(
				_series.underlying,
				_series.strikeAsset,
				_series.collateral,
				_series.expiration,
				_series.isPut,
				_series.strike
			);
	}

	/**
	 * Helper function for computing the hash of a given issuance.
	 */
	function getIssuanceHash(
		address underlying,
		address strikeAsset,
		address collateral,
		uint256 expiration,
		bool isPut,
		uint256 strike
	) internal pure returns (bytes32) {
		return
			keccak256(abi.encodePacked(underlying, strikeAsset, collateral, expiration, isPut, strike));
	}

	//////////////////////////
	/// internal utilities ///
	//////////////////////////

	/**
	 * @notice Converts strike price to 1e8 format and floors least significant digits if needed
	 * @param  strikePrice strikePrice in 1e18 format
	 * @param  collateral address of collateral asset
	 * @return if the transaction succeeded
	 */
	function formatStrikePrice(uint256 strikePrice, address collateral) public view returns (uint256) {
		// convert strike to 1e8 format
		uint256 price = strikePrice / (10**10);
		uint256 collateralDecimals = ERC20(collateral).decimals();
		if (collateralDecimals >= OPYN_DECIMALS) return price;
		uint256 difference = OPYN_DECIMALS - collateralDecimals;
		// round floor strike to prevent errors in Gamma protocol
		return (price / (10**difference)) * (10**difference);
	}

	function _isLiquidityPool() internal view {
		if (msg.sender != liquidityPool) {
			revert NotLiquidityPool();
		}
	}

	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (
			!keeper[msg.sender] && msg.sender != authority.governor() && msg.sender != authority.manager()
		) {
			revert NotKeeper();
		}
	}
}
