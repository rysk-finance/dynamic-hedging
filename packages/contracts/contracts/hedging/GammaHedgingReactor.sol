// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../Protocol.sol";
import "../BeyondPricer.sol";
import "../BeyondOptionHandler.sol";

import "../libraries/Types.sol";
import "../libraries/BlackScholes.sol";
import "../libraries/AccessControl.sol";
import "../libraries/OptionsCompute.sol";
import "../libraries/SafeTransferLib.sol";
import "../libraries/OpynInteractions.sol";

import "../interfaces/IWhitelist.sol";
import "../interfaces/IHedgingReactor.sol";
import "../interfaces/AddressBookInterface.sol";
import "../interfaces/IPortfolioValuesFeed.sol";
import {IOtoken } from "../interfaces/GammaInterface.sol";

/**
 *   @title A hedging reactor that allows users to sell options to the reactor using funds from the
 *          liquidity pool to pay their premiums. Interacts with the LiquidityPool and Opyn-Rysk Gamma protocol
 */

contract GammaHedgingReactor is IHedgingReactor, AccessControl {
	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	/// @notice address of the parent liquidity pool contract
	address public immutable parentLiquidityPool;
	/// @notice address of the price feed used for getting asset prices
	Protocol public immutable protocol;
	/// @notice collateral asset used for premium 
	address public immutable collateralAsset;
	/// @notice strike asset used as the main numeraire
	address public immutable strikeAsset;
	/// @notice underlying asset used as the reference asset for the option
	address public immutable underlyingAsset;
	/// @notice address book used for the gamma protocol
	AddressBookInterface public immutable addressbook;

	/////////////////////////
	/// dynamic variables ///
	/////////////////////////

	/// @notice delta exposure of this reactor
	int256 public internalDelta;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	/// @notice handler used for writing options and contains options access
	BeyondOptionHandler public handler;
	/// @notice pricer for querying option price quotes
	BeyondPricer public pricer;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	/// @notice max bips used for percentages
	uint256 private constant MAX_BIPS = 10_000;

	event OptionsBought();
	event OptionPositionsClosed();
	event OptionsRedeemed(address series, uint256 optionAmount, uint256 redeemAmount);

	constructor(
		address _strikeAsset,
		address _collateralAsset,
		address _underlyingAsset,
		address _parentLiquidityPool,
		address _protocol,
		address _authority,
		address _handler,
		address _pricer,
		address _addressbook
	) AccessControl(IAuthority(_authority)) {
		strikeAsset = _strikeAsset;
		collateralAsset = _collateralAsset;
		underlyingAsset = _underlyingAsset;
		parentLiquidityPool = _parentLiquidityPool;
		protocol = Protocol(_protocol);
		handler = BeyondOptionHandler(_handler);
		pricer = BeyondPricer(_pricer);
		addressbook = AddressBookInterface(_addressbook);
	}

	///////////////
	/// setters ///
	///////////////



	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/// @inheritdoc IHedgingReactor
	function hedgeDelta(int256 _delta) external returns (int256) {
		return 0;
	}

	/// @inheritdoc IHedgingReactor
	function withdraw(uint256 _amount) external returns (uint256) {
		require(msg.sender == parentLiquidityPool, "!vault");
		address _token = collateralAsset;
		// check the holdings if enough just lying around then transfer it
		uint256 balance = ERC20(_token).balanceOf(address(this));
		if (balance == 0) {
			return 0;
		}
		if (_amount <= balance) {
			SafeTransferLib.safeTransfer(ERC20(_token), msg.sender, _amount);
			// return in collat decimals format
			return _amount;
		} else {
			SafeTransferLib.safeTransfer(ERC20(_token), msg.sender, balance);
			// return in collatDecimals format
			return balance;
		}
	}

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/// @inheritdoc IHedgingReactor
	function update() external pure returns (uint256) {
		return 0;
	}


    function buyOption(
        address _series, 
        uint256 _amount
        ) 
        external 
        returns (uint256 premium)
    {
		// check the otoken is whitelisted
		IWhitelist(addressbook.getWhitelist()).isWhitelistedOtoken(_series);
		IOtoken otoken = IOtoken(_series);
		// get the option details
		Types.OptionSeries memory optionSeries = Types.OptionSeries(
			uint64(otoken.expiryTimestamp()),
			uint128(otoken.strikePrice()) * 10**10,
			otoken.isPut(),
			otoken.underlyingAsset(),
			otoken.strikeAsset(),
			otoken.collateralAsset()
			);
		// check if the option series is approved
		bytes32 oHash = keccak256(abi.encodePacked(optionSeries.expiration, optionSeries.strike, optionSeries.isPut));
		if (!handler.approvedOptions(oHash)) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for buying
		if (!handler.isBuying(oHash)) {
			revert CustomErrors.NotSellingSeries();
		}
		// revert if the expiry is in the past
		if (optionSeries.expiration <= block.timestamp) {
			revert CustomErrors.OptionExpiryInvalid();
		}
		// check the strike asset and underlying asset
		if (optionSeries.underlying != underlyingAsset) {
			revert CustomErrors.UnderlyingAssetInvalid();
		}
		if (optionSeries.strikeAsset != strikeAsset) {
			revert CustomErrors.StrikeAssetInvalid();
		}
		// value the options
		(uint256 premium, ) = pricer.quoteOptionPrice(optionSeries, _amount, true);
		// send the otokens here
		SafeTransferLib.safeTransferFrom(
			_series,
			msg.sender,
			address(this),
			OptionsCompute.convertToDecimals(_amount, ERC20(_series).decimals())
		);
        // take the funds from the liquidity pool and pay the user for the oTokens
		SafeTransferLib.safeTransferFrom(
			collateralAsset,
			address(parentLiquidityPool),
			msg.sender,
			premium
		);
		// update on the pvfeed stores
		getPortfolioValuesFeed().updateStores(
			optionSeries,
			0,
			int256(_amount),
			_series
		);
        // emit an event
		emit OptionsBought();
    }

	function closeOption(address _series, uint256 _amount) external {
		if (ERC20(_series).balanceOf(address(this)) < _amount) {
			revert CustomErrors.InsufficientBalance();
		}
		// check the otoken is whitelisted
		IWhitelist(addressbook.getWhitelist()).isWhitelistedOtoken(_series);
		IOtoken otoken = IOtoken(_series);
		// get the option details
		Types.OptionSeries memory optionSeries = Types.OptionSeries(
			uint64(otoken.expiryTimestamp()),
			uint128(otoken.strikePrice()) * 10**10,
			otoken.isPut(),
			otoken.underlyingAsset(),
			otoken.strikeAsset(),
			otoken.collateralAsset()
			);
		// check if the option series is approved
		bytes32 oHash = keccak256(abi.encodePacked(optionSeries.expiration, optionSeries.strike, optionSeries.isPut));
		if (!handler.approvedOptions(oHash)) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for selling
		if (!handler.isSelling(oHash)) {
			revert CustomErrors.NotSellingSeries();
		}
		// revert if the expiry is in the past
		if (optionSeries.expiration <= block.timestamp) {
			revert CustomErrors.OptionExpiryInvalid();
		}
		// check the strike asset and underlying asset
		if (optionSeries.underlying != underlyingAsset) {
			revert CustomErrors.UnderlyingAssetInvalid();
		}
		if (optionSeries.strikeAsset != strikeAsset) {
			revert CustomErrors.StrikeAssetInvalid();
		}
		// value the options
		(uint256 premium, ) = pricer.quoteOptionPrice(optionSeries, _amount, false);
		// transfer the otokens back to the user
		SafeTransferLib.safeTransferFrom(
			_series,
			address(this),
			msg.sender,
			OptionsCompute.convertToDecimals(_amount, ERC20(_series).decimals())
		);
		// transfer the premium back to the liquidity pool
		SafeTransferLib.safeTransferFrom(
			collateralAsset,
			msg.sender,
			parentLiquidityPool,
			premium
		);
		// update on the pvfeed stores
		getPortfolioValuesFeed().updateStores(
			optionSeries,
			0,
			-int256(_amount),
			_series
		);
		emit OptionPositionsClosed();
	}
    function redeem(address _series) external {
		uint256 optionAmount = ERC20(_series).balanceOf(address(this));
		uint256 redeemAmount = OpynInteractions.redeem(addressbook.getController(), addressbook.getMarginPool(), _series, optionAmount);
		SafeTransferLib.safeTransferFrom(
			collateralAsset,
			address(this),
			parentLiquidityPool,
			redeemAmount
		);
		emit OptionsRedeemed(_series, optionAmount, redeemAmount);
    }

	///////////////
	/// getters ///
	///////////////

	/// @inheritdoc IHedgingReactor
	function getDelta() external view returns (int256 delta) {
		return 0;
	}

	/// @inheritdoc IHedgingReactor
	function getPoolDenominatedValue() external view returns (uint256 value) {
		return ERC20(collateralAsset).balanceOf(address(this));
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

	/**
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function getPortfolioValuesFeed() internal view returns (IPortfolioValuesFeed) {
		return IPortfolioValuesFeed(protocol.portfolioValuesFeed());
	}
}
