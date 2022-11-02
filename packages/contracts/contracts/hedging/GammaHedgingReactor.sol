// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../PriceFeed.sol";

import "../libraries/Types.sol";
import "../libraries/BlackScholes.sol";
import "../libraries/AccessControl.sol";
import "../libraries/OptionsCompute.sol";
import "../libraries/SafeTransferLib.sol";
import "../libraries/OpynInteractions.sol";

import "../interfaces/IHedgingReactor.sol";

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
	address public immutable priceFeed;
	/// @notice generalised list of stablecoin addresses to trade against wETH
	address public immutable collateralAsset;

	/////////////////////////
	/// dynamic variables ///
	/////////////////////////

	/// @notice delta exposure of this reactor
	int256 public internalDelta;
    /// @notice user existing opyn-rysk vaults
    mapping(address => mapping (address => uint256)) public vaultIds;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

    /// @notice information of a series
	mapping(address => Types.OptionSeries) public seriesInfo;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	/// @notice max bips used for percentages
	uint256 private constant MAX_BIPS = 10_000;

	constructor(
		address _collateralAsset,
		address _parentLiquidityPool,
		address _priceFeed,
		address _authority
	) AccessControl(IAuthority(_authority)) {
		collateralAsset = _collateralAsset;
		parentLiquidityPool = _parentLiquidityPool;
		priceFeed = _priceFeed;
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

    function issueNewSeries(
        Types.OptionSeries memory _seriesParams
        ) 
        external 
        returns (address series)
    {
        _onlyManager();
        // check the series for its validity, expiry, collateral, strike, underlying etc.
        // issue the series via opyn interactions issue getting the address
        // store information on the series
        // store it in some form of array so its delta and value can be calculated
        // emit an event of the series creation, now users can write options on this series
    }

    function revokeSeries(
        address _series
        ) 
        external 
    {
        _onlyManager();
        delete seriesInfo[_series];
    }

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/// @inheritdoc IHedgingReactor
	function update() external pure returns (uint256) {
		return 0;
	}


    function writeAndBuyOption(
        address _series, 
        uint256 _amount, 
        uint256 _vaultType,
        uint256 _healthFactor
        ) 
        external 
        returns (uint256 vaultId, uint256 premium)
    {
        // check the series for its existence
        // check the series is allowed by the reactor
        // check the series has a valid expiry
        // check the amount
        // make sure the vault type is 0 or 1
        // open a vault on opyn (or find if they have an existing one for this series) and store this
        // get the collateral amount from something like OpynInteractions.getCollateral taking into account their health factor
        // deposit the collateral amount into the vault they just created or had already
        // mint the amount of options they want
        // price the options using LiquidityPool.quotePriceWithUtilisationGreeks in buy mode or a different pricing algo
        // take the funds from the liquidity pool and pay the user for the oTokens
        // emit an event
    }

    function adjustCollateral(address _series, uint256 _collateralAmount, bool _isTopUp) external {
        // check the existence of the series
        // check they have a vault
        // make sure the series has not expired
        // make sure the collateral amount is non 0
        // if it is a top up then deposit the collateral amount
        // if it is a withdrawal then withdraw the collateral amount
        // make sure funds go to the user or oToken vault
    }

    function redeem(address _series) external {
        // check the existence of the series
        // make sure it has expired
        // make sure the oToken balance is greater than 0
        // call redeem on the vault
        // send redeemed funds to the liquidityPool
        // emit redeem event
    }

    function settle(address _series) external {
        // check the existence of the series
        // check if they have a vault
        // settle the vault
        // clear the vault from the mapping
    }


	///////////////
	/// getters ///
	///////////////

	/// @inheritdoc IHedgingReactor
	function getDelta() external view returns (int256 delta) {

        // Returns the pools delta value, which in this case would be the options aggregate delta, 
        // this could be calculated completely on chain if we limited the number of options series 
        // that the pool purchased. So getDelta from BlackScholes.sol could be used
        // Otherwise if this is unbound then we would need to adopt an 
        // oracle based solution.
	}

	/// @inheritdoc IHedgingReactor
	function getPoolDenominatedValue() external view returns (uint256 value) {
        // Returns the pools option value, which in this case would be the options aggregate value 
        // and the collateral left loose, 
        // this could be calculated completely on chain if we limited the number of options series 
        // that the pool purchased. So blackScholesCalc could be used from BlackScholes.sol could be used
        // Otherwise if this is unbound then we would need to adopt an oracle based solution.
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
}
