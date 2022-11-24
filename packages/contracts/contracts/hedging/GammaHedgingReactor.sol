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
import { IOtoken } from "../interfaces/GammaInterface.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import "hardhat/console.sol";

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
	/// @notice instance of the uniswap V3 router interface
	ISwapRouter public immutable swapRouter;

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
	/// @notice spot hedging reactor
	address public spotHedgingReactor;
	/// @notice when redeeming other asset, send to a reactor or sell it
	bool public sellRedemptions = true;
	/// @notice pool fees for different swappable assets
	mapping(address => uint24) public poolFees;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	/// @notice max bips used for percentages
	uint256 private constant MAX_BIPS = 10_000;
	// oToken decimals
	uint8 private constant OPYN_DECIMALS = 8;
	// scale otoken conversion decimals
	uint8 private constant CONVERSION_DECIMALS = 18 - OPYN_DECIMALS;
	/// @notice used for unlimited token approval
	uint256 private constant MAX_UINT = 2**256 - 1;

	event OptionsBought();
	event OptionPositionsClosed();
	event OptionsRedeemed(
		address series,
		uint256 optionAmount,
		uint256 redeemAmount,
		address redeemAsset
	);
	event RedemptionSent(uint256 redeemAmount, address redeemAsset, address recipient);

	error PoolFeeNotSet();

	constructor(
		address _strikeAsset,
		address _collateralAsset,
		address _underlyingAsset,
		address _parentLiquidityPool,
		address _protocol,
		address _authority,
		address _handler,
		address _pricer,
		address _addressbook,
		address _spotHedgingReactor,
		address _swapRouter
	) AccessControl(IAuthority(_authority)) {
		strikeAsset = _strikeAsset;
		collateralAsset = _collateralAsset;
		underlyingAsset = _underlyingAsset;
		parentLiquidityPool = _parentLiquidityPool;
		protocol = Protocol(_protocol);
		addressbook = AddressBookInterface(_addressbook);
		swapRouter = ISwapRouter(_swapRouter);
		handler = BeyondOptionHandler(_handler);
		pricer = BeyondPricer(_pricer);
		spotHedgingReactor = _spotHedgingReactor;
	}

	///////////////
	/// setters ///
	///////////////

	/// @notice update the handler
	function setHandler(address _handler) external {
		_onlyGovernor();
		handler = BeyondOptionHandler(_handler);
	}

	/// @notice update the pricer
	function setPricer(address _pricer) external {
		_onlyGovernor();
		pricer = BeyondPricer(_pricer);
	}

	/// @notice whether when redeeming options if the proceeds are in eth they should be converted to usdc or sent to the spot hedging reactor
	///  		true for selling off to usdc and sending to the liquidity pool and false for sell
	function setSellRedemptions(bool _sellRedemptions) external {
		_onlyGovernor();
		sellRedemptions = _sellRedemptions;
	}

	/// @notice set the uniswap v3 pool fee for a given asset, also give the asset max approval on the uni v3 swap router
	function setPoolFee(address asset, uint24 fee) external {
		_onlyGovernor();
		poolFees[asset] = fee;
		SafeTransferLib.safeApprove(ERC20(asset), address(swapRouter), MAX_UINT);
	}

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

	/**
	 * @notice sell an otoken to the dhv, user should have created the otoken themselves beforehand and sorted their collateral
	 * @param _series the option series that was created by the user to be sold to the dhv
	 * @param _amount the amount of options to sell to the dhv in e18
	 * @return premium the premium paid out to the user
	 */
	function sellOption(address _series, uint256 _amount) external returns (uint256) {
		// TODO: if we have the option on our books in the dhv then we should sell use the buyback function on the dhv instead
		// check the otoken is whitelisted
		IWhitelist(addressbook.getWhitelist()).isWhitelistedOtoken(_series);
		IOtoken otoken = IOtoken(_series);
		// get the option details
		Types.OptionSeries memory optionSeries = Types.OptionSeries(
			uint64(otoken.expiryTimestamp()),
			uint128(otoken.strikePrice() * 10**CONVERSION_DECIMALS),
			otoken.isPut(),
			otoken.underlyingAsset(),
			otoken.strikeAsset(),
			otoken.collateralAsset()
		);
		// check if the option series is approved
		bytes32 oHash = keccak256(
			abi.encodePacked(optionSeries.expiration, optionSeries.strike, optionSeries.isPut)
		);
		if (!handler.approvedOptions(oHash)) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for buying
		if (!handler.isBuying(oHash)) {
			revert CustomErrors.NotBuyingSeries();
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
		// value the options, premium in e6
		(uint256 premium, ) = pricer.quoteOptionPrice(optionSeries, _amount, true);
		// send the otokens here
		SafeTransferLib.safeTransferFrom(
			_series,
			msg.sender,
			address(this),
			OptionsCompute.convertToDecimals(_amount, ERC20(_series).decimals())
		);
		// TODO: if we have the position then close it and do buyback option and complete
		// take the funds from the liquidity pool and pay the user for the oTokens
		SafeTransferLib.safeTransferFrom(
			collateralAsset,
			address(parentLiquidityPool),
			msg.sender,
			premium
		);
		// update on the pvfeed stores
		getPortfolioValuesFeed().updateStores(optionSeries, 0, int256(_amount), _series);
		// emit an event
		emit OptionsBought();
		return premium;
	}

	/**
	 * @notice buy an otoken from the dhv
	 * @param _series the option series to receive back
	 * @param _amount the amount of options to buy from the dhv in e18
	 * @return premium the premium paid from the dhv to the user
	 */
	function closeOption(address _series, uint256 _amount) external returns (uint256) {
		if (ERC20(_series).balanceOf(address(this)) * 10**CONVERSION_DECIMALS < _amount) {
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
		bytes32 oHash = keccak256(
			abi.encodePacked(optionSeries.expiration, optionSeries.strike, optionSeries.isPut)
		);
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
		SafeTransferLib.safeTransfer(
			ERC20(_series),
			msg.sender,
			OptionsCompute.convertToDecimals(_amount, ERC20(_series).decimals())
		);
		// transfer the premium back to the liquidity pool
		SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, parentLiquidityPool, premium);
		// update on the pvfeed stores
		getPortfolioValuesFeed().updateStores(optionSeries, 0, -int256(_amount), _series);
		emit OptionPositionsClosed();
		return premium;
	}

	/**
	 * @notice get the dhv to redeem an expired otoken
	 * @param _series the list of series to redeem
	 */
	function redeem(address[] memory _series) external {
		uint256 adLength = _series.length;
		for (uint256 i; i < adLength; i++) {
			// get the number of otokens held by this address for the specified series
			uint256 optionAmount = ERC20(_series[i]).balanceOf(address(this));
			IOtoken otoken = IOtoken(_series[i]);
			// redeem from opyn to this address
			uint256 redeemAmount = OpynInteractions.redeemToAddress(
				addressbook.getController(),
				addressbook.getMarginPool(),
				_series[i],
				optionAmount,
				address(this)
			);

			address otokenCollateralAsset = otoken.collateralAsset();
			emit OptionsRedeemed(_series[i], optionAmount, redeemAmount, otokenCollateralAsset);
			// if the collateral used by the otoken is the collateral asset then transfer the redemption to the liquidity pool
			// if the collateral used by the otoken is the underlying asset and sellRedemptions is false, then send the funds to the uniswapHedgingReactor
			// if the collateral used by the otoken is anything else (or if underlying and sellRedemptions is true) then swap it on uniswap and send the proceeds to the liquidity pool
			if (otokenCollateralAsset == collateralAsset) {
				SafeTransferLib.safeTransfer(ERC20(collateralAsset), parentLiquidityPool, redeemAmount);
				emit RedemptionSent(redeemAmount, collateralAsset, parentLiquidityPool);
			} else if (otokenCollateralAsset == underlyingAsset && !sellRedemptions) {
				SafeTransferLib.safeTransfer(ERC20(otokenCollateralAsset), spotHedgingReactor, redeemAmount);
				emit RedemptionSent(redeemAmount, otokenCollateralAsset, spotHedgingReactor);
			} else {
				uint256 redeemableCollateral = _swapExactInputSingle(redeemAmount, 0, otokenCollateralAsset);
				SafeTransferLib.safeTransfer(ERC20(collateralAsset), parentLiquidityPool, redeemableCollateral);
				emit RedemptionSent(redeemableCollateral, collateralAsset, parentLiquidityPool);
			}
		}
	}

	/** @notice function to sell exact amount of wETH to decrease delta
	 *  @param _amountIn the exact amount of wETH to sell
	 *  @param _amountOutMinimum the min amount of stablecoin willing to receive. Slippage limit.
	 *  @param _assetIn the stablecoin to buy
	 *  @return the amount of usdc received
	 */
	function _swapExactInputSingle(
		uint256 _amountIn,
		uint256 _amountOutMinimum,
		address _assetIn
	) internal returns (uint256) {
		uint24 poolFee = poolFees[_assetIn];
		if (poolFee == 0) {
			revert PoolFeeNotSet();
		}
		ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
			tokenIn: _assetIn,
			tokenOut: collateralAsset,
			fee: poolFee,
			recipient: address(this),
			deadline: block.timestamp,
			amountIn: _amountIn,
			amountOutMinimum: _amountOutMinimum,
			sqrtPriceLimitX96: 0
		});

		// The call to `exactInputSingle` executes the swap.
		uint256 amountOut = swapRouter.exactInputSingle(params);
		return amountOut;
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
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function getPortfolioValuesFeed() internal view returns (IPortfolioValuesFeed) {
		return IPortfolioValuesFeed(protocol.portfolioValuesFeed());
	}
}
