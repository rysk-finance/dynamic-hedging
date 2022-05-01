// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../PriceFeed.sol";
import "../interfaces/IERC20.sol";
import "../libraries/OptionsCompute.sol";
import '../libraries/SafeTransferLib.sol';
import "../interfaces/IHedgingReactor.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@rage/core/contracts/interfaces/IClearingHouse.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "hardhat/console.sol";


/**
    @title A hedging reactor that will manage delta by opening or closing short or long perp positions
 */

contract PerpHedgingReactor is IHedgingReactor, Ownable {

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
    /// @notice instance of the clearing house interface
    IClearingHouse public clearingHouse;

    /////////////////////////
    /// dynamic variables ///
    /////////////////////////

    /// @notice accountId for the perp pool
    uint256 public accountId;
    /// @notice delta of the pool
    int256 public internalDelta;
    /// @notice collateralId to be used in the perp pool
    uint32 public collateralId;
    /// @notice poolId to be used in the perp pool
    uint32 public poolId;

    /////////////////////////////////////
    /// governance settable variables ///
    /////////////////////////////////////

    /// @notice address of the keeper of this pool
    address public keeper;
    /// @notice desired healthFactor of the pool
    uint256 public healthFactor = 12_500;
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
    error InvalidSender();
    error InvalidHealthFactor();
    error IncorrectCollateral();
    error InvalidTransactionNotEnoughMargin(int256 accountMarketValue, int256 totalRequiredMargin);

    constructor (
        address _clearingHouse, 
        address _collateralAsset, 
        address _wethAddress, 
        address _parentLiquidityPool, 
        uint32 _poolId,
        uint32 _collateralId, 
        address _priceFeed
        ) {
        clearingHouse = IClearingHouse(_clearingHouse);
        collateralAsset = _collateralAsset;
        wETH = _wethAddress;
        parentLiquidityPool = _parentLiquidityPool;
        priceFeed = _priceFeed;
        poolId = _poolId;
        collateralId = _collateralId;
        // make a perp account
        accountId = clearingHouse.createAccount();
    }

    ///////////////
    /// setters ///
    ///////////////

    /// @notice update the health factor parameter
    function setHealthFactor(uint _healthFactor) public onlyOwner {
        if (_healthFactor < MAX_BIPS) {revert InvalidHealthFactor();}
        healthFactor = _healthFactor;
    }
    /// @notice update the keeper
    function setKeeper(address _keeper) public onlyOwner {
        keeper = _keeper;
    }
    /// @notice update the keeper
    function setSyncOnChange(bool _syncOnChange) public onlyOwner {
        syncOnChange = _syncOnChange;
    }

    ////////////////////////////////////////////
    /// access-controlled external functions ///
    ////////////////////////////////////////////

    function initialiseReactor() external onlyOwner {
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        if (collatDeposits.length != 0) {revert();}
        SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), 1);
        SafeTransferLib.safeApprove(ERC20(collateralAsset), address(clearingHouse), MAX_UINT);
        clearingHouse.updateMargin(accountId, collateralId, 1);
    }

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
    function withdraw(uint256 _amount, address _token) external returns (uint256) {
        require(msg.sender == parentLiquidityPool, "!vault");
        if (_token != collateralAsset) {revert IncorrectCollateral();}
        // check the holdings if enough just lying around then transfer it
        // assume amount is passed in as e18
        uint256 convertedAmount = OptionsCompute.convertToDecimals(_amount, IERC20(_token).decimals());
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (convertedAmount <= balance) {
            SafeTransferLib.safeTransfer(ERC20(_token) ,msg.sender, convertedAmount);
            // return in e18 format
            return _amount;
        }
        // get the collatNeeded (this should not underflow as the 
        // previous check will have eliminated these cases)
        uint256 collatNeeded = convertedAmount - balance;
        // liquidate the collateral needed
        (uint256 collatReturned, int256 deltaChange) = _liquidatePosition(collatNeeded);
        // adjust the internal delta in accordance with the change that liquidatePosition made
        internalDelta += deltaChange;
        // get the actual returned value to send back to the user
        if (collatReturned < collatNeeded) {
            // transfer assets back to the liquidityPool 
            // TODO: track this transfer either in LiquidityPool or here
            SafeTransferLib.safeTransfer(ERC20(_token), parentLiquidityPool, collatReturned + balance);
            // return in e18 format
            return OptionsCompute.convertFromDecimals(collatReturned + balance, IERC20(_token).decimals());
        } else {
            // transfer assets back to the liquidityPool 
            // TODO: track this transfer either in LiquidityPool or here
            SafeTransferLib.safeTransfer(ERC20(_token), parentLiquidityPool, convertedAmount);
            // return in e18 format
            return _amount;
        }
    }

    /// @notice function to poke the margin account to update the profits of the vault and also manage
    ///         the collateral to safe bounds.
    /// @dev    only callable by a keeper
    function syncAndUpdate() public {
        sync();
        update();
    }

    /// @notice function to poke the margin account to update the profits of the vault
    /// @dev    only callable by a keeper
    function sync() public {
        if (msg.sender != keeper || msg.sender != parentLiquidityPool){revert InvalidSender();}
        clearingHouse.settleProfit(accountId);
    }

    /// @inheritdoc IHedgingReactor
    function update() public returns (uint256) {
        if (msg.sender != keeper){revert InvalidSender();}

        int256 netPosition = clearingHouse.getAccountNetTokenPosition(accountId, poolId);    
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        // just make sure the collateral at index 0 is correct (this is unlikely to ever fail, but should be checked)
        if (collatDeposits.length == 0) {revert IncorrectCollateral();}
        if (address(collatDeposits[0].collateral) != collateralAsset) {revert IncorrectCollateral();}
        uint256 collat = collatDeposits[0].balance;
        // we want 1 wei at all times, so if there is only 1 wei of collat and the net position is 0 then just return
        if (collat == 1 && netPosition == 0) {
            return 0;
        }
        // get the current price of the underlying asset from chainlink to be used to calculate position sizing
        uint256 currentPrice = OptionsCompute.convertToDecimals(PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset), ERC20(collateralAsset).decimals());
        // check the collateral health of positions
        // get the amount of collateral that should be expected for a given amount
        uint256 collatRequired = netPosition >= 0 
                        ? 
                        (((uint256(netPosition) * currentPrice) / 1e18) * healthFactor) / MAX_BIPS 
                        : 
                        (((uint256(-netPosition) * currentPrice) / 1e18) * healthFactor) / MAX_BIPS;
        // if there is not enough collateral then request more
        // if there is too much collateral then return some to the pool
        if (collatRequired > collat) {
            // transfer assets from the liquidityPool to here to collateralise the pool
            // TODO: track this transfer either in LiquidityPool or here
            SafeTransferLib.safeTransferFrom(collateralAsset, parentLiquidityPool, address(this), collatRequired - collat);
            // deposit the collateral into the margin account
            clearingHouse.updateMargin(accountId, collateralId, int256(collatRequired - collat));
            // TODO: change the internal holdings around
            return collatRequired - collat;
        } else if (collatRequired < collat) {
            // withdraw excess collateral from the margin account
            clearingHouse.updateMargin(accountId, collateralId, -int256(collat - collatRequired));
            // transfer assets back to the liquidityPool 
            // TODO: track this transfer either in LiquidityPool or here
            SafeTransferLib.safeTransfer(ERC20(collateralAsset), parentLiquidityPool, collat - collatRequired);
            // TODO: change the internal holdings around
            return collat - collatRequired;
        } else {
            return 0;
        }   
    }

    ///////////////////////
    /// complex getters ///
    ///////////////////////

    /// @inheritdoc IHedgingReactor
    function getDelta() external view returns(int256 delta){
        return internalDelta;
    }

    /// @inheritdoc IHedgingReactor
    function getPoolDenominatedValue() external view returns(uint256 value){
        // calculate the value of the pools holdings (including any funding)
        // access the collateral held in the account
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        // just make sure the collateral at index 0 exists and is correct (this is unlikely to ever fail, but should be checked)
        if (collatDeposits.length != 0) {
            if (address(collatDeposits[0].collateral) == collateralAsset) {
                value += collatDeposits[0].balance;
            } 
        }
        // increment any loose balance held by the pool
        value += ERC20(collateralAsset).balanceOf(address(this));
        // get the net profit of the account position
        int256 netProfit = clearingHouse.getAccountNetProfit(accountId);
        if (netProfit > 0) {
            value += uint256(netProfit);
        } else if (netProfit < 0) {
            // if there is ever a case where value is negative then something has gone very wrong and this should be dealt with 
            // by the reactor manager so the transaction should revert here
            if( value < uint256(-netProfit) ) {revert ValueFailure();}
            value -= uint256(-netProfit);
        }
        // value to be returned in e18
        value = OptionsCompute.convertFromDecimals(value, IERC20(collateralAsset).decimals());
    }

    //////////////////////////
    /// internal utilities ///
    //////////////////////////

    /** @notice function to change the perp position
        @param _amount the amount of position to open or close
        @return deltaChange The resulting difference in delta exposure
    */
    function _changePosition(int256 _amount) internal returns (int256 ) {
        if (syncOnChange) {
            sync();
        }
        uint256 collatToDeposit;
        uint256 collatToWithdraw;
        // access the collateral held in the account
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        // just make sure the collateral at index 0 is correct (this is unlikely to ever fail, but should be checked)
        if (collatDeposits.length == 0) {revert IncorrectCollateral();}
        if (address(collatDeposits[0].collateral) != collateralAsset) {revert IncorrectCollateral();}
        uint256 collat = collatDeposits[0].balance;
        // getAccountNetProfit and updateProfit 
        // check the net position of the margin account
        int256 netPosition = clearingHouse.getAccountNetTokenPosition(accountId, poolId);
        // get the new net position with the amount of the swap added
        int256 newPosition = netPosition + _amount;
        // get the current price of the underlying asset from chainlink to be used to calculate position sizing
        uint256 currentPrice = OptionsCompute.convertToDecimals(PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset), ERC20(collateralAsset).decimals());
        // calculate the margin requirement for newPosition making sure to account for the health factor of the pool 
        // as we want the position to be overcollateralised
        uint256 totalCollatNeeded = newPosition >= 0 
                                ? 
                                (((uint256(newPosition) * currentPrice) / 1e18) * healthFactor) / MAX_BIPS 
                                : 
                                (((uint256(-newPosition) * currentPrice) / 1e18) * healthFactor) / MAX_BIPS;
        // if there is not enough collateral then increase the margin collateral balance
        // if there is too much collateral then decrease the margin collateral balance
        if (totalCollatNeeded > collat) {
            collatToDeposit = totalCollatNeeded - collat;
        } else if(totalCollatNeeded < collat) {
            collatToWithdraw = collat - Math.max(totalCollatNeeded, 1);
        } else if(totalCollatNeeded == collat && _amount != 0) {
            // highly improbable but if collateral is exactly equal if the amount to hedge is exactly opposite of the current
            // hedge then just swap without changing the margin
            // make the swapParams
            IClearingHouseStructures.SwapParams memory swapParams = IClearingHouseStructures.SwapParams(
                _amount,
                0,
                false,
                false,
                false
            ); 
            // execute the swap
            clearingHouse.swapToken(accountId, poolId, swapParams);
        } else {
            // this will happen if amount is 0
            return 0;
        }
        // if the current margin held is smaller than the new margin required then deposit more collateral
        // and open more positions
        // if the current margin held is larger than the new margin required then swap tokens out and 
        // withdraw the excess margin
        if (collatToDeposit > 0) {
            // transfer assets from the liquidityPool to here to collateralise the pool
            // TODO: track this transfer either in LiquidityPool or here
            SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), collatToDeposit);
            // deposit the collateral into the margin account
            clearingHouse.updateMargin(accountId, collateralId, int256(collatToDeposit));
            // make the swapParams
            IClearingHouseStructures.SwapParams memory swapParams = IClearingHouseStructures.SwapParams(
                _amount,
                0,
                false,
                false,
                false
            ); 
            // execute the swap
            clearingHouse.swapToken(accountId, poolId, swapParams);
        } else if (collatToWithdraw > 0) {
            // make the swapParams to close the position
            IClearingHouseStructures.SwapParams memory swapParams = IClearingHouseStructures.SwapParams(
                _amount,
                0,
                false,
                false,
                false
            ); 
            // execute the swap, since this is a withdrawal and we may withdraw all we want to make sure the account is properly settled
            // so we update the margin, if it fails then we settle any profits and update
            clearingHouse.swapToken(accountId, poolId, swapParams);
            try clearingHouse.updateMargin(accountId, collateralId, -int256(collatToWithdraw)) {} 
            catch (bytes memory reason) {
                // way of catching custom errors referenced here: https://ethereum.stackexchange.com/questions/125238/catching-custom-error
                bytes4 expectedSelector = InvalidTransactionNotEnoughMargin.selector;
                bytes4 receivedSelector = bytes4(reason);
                assert(expectedSelector == receivedSelector);
                // settle the profits to make sure the collateral is covered
                clearingHouse.settleProfit(accountId);
                // get the new collat
                (,,collatDeposits,) = clearingHouse.getAccountInfo(accountId);
                collat = collatDeposits[0].balance;
                // if the collat value is smaller than collatToWithdraw then withdraw all collat
                if (collat <= collatToWithdraw && collat != 0) {
                  collatToWithdraw = collat - 1;  
                } 
                clearingHouse.updateMargin(accountId, collateralId, -int256(collatToWithdraw));
            }
            // transfer assets back to the liquidityPool 
            // TODO: track this transfer either in LiquidityPool or here
            SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, uint256(collatToWithdraw));
        }
        return _amount;
    }

    /**
        @notice function to close positions if stable collateral is needed in the liquidity pool.
        @param _amount the amount to liquidate
     */
    function _liquidatePosition(uint256 _amount) internal returns (uint256 stableBalanceReceived, int256 deltaChange){
        // look at the net pool holdings
        int256 netPosition = clearingHouse.getAccountNetTokenPosition(accountId, poolId);
        // access the collateral held in the account
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        // just make sure the collateral at index 0 is correct (this is unlikely to ever fail, but should be checked)
        if (collatDeposits.length == 0) {revert IncorrectCollateral();}
        if (address(collatDeposits[0].collateral) != collateralAsset) {revert IncorrectCollateral();}
        uint256 collat = collatDeposits[0].balance;
        // get the current price of the underlying asset from chainlink to be used to calculate position sizing
        uint256 currentPrice = OptionsCompute.convertToDecimals(PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset), ERC20(collateralAsset).decimals());
        IClearingHouseStructures.SwapParams memory swapParams;
        if (collat <= _amount) {
            // if the amount needed is greater than or equal to the collateral then close all positions and withdraw
            // all collateral
            // make the swapParams to close the position
            swapParams = IClearingHouseStructures.SwapParams(
                -netPosition,
                0,
                false,
                false,
                true
            ); 
            // execute the swap
            clearingHouse.swapToken(accountId, poolId, swapParams); 
            (,,collatDeposits,) = clearingHouse.getAccountInfo(accountId);
            collat = collatDeposits[0].balance;
            // withdraw all collateral from the margin account, leave 1 wei to make sure the collateral index stays
            clearingHouse.updateMargin(accountId, collateralId, -int256(collat) + 1);
            return (collat - 1, -netPosition);
        }
        // reduce the collateral by amount
        uint256 newCollat = collat - _amount;
        // calculate what the position should be if the collat is changed to newCollat
        int256 newPosition = int256((newCollat * MAX_BIPS * 1e18) / (healthFactor * currentPrice)); 
        // get the correct sign for the newPosition
        newPosition = netPosition > 0 ? newPosition : -newPosition;
        // calculate the difference between the old and new position
        int256 diff = newPosition - netPosition;
        swapParams = IClearingHouseStructures.SwapParams(
            diff,
            0,
            false,
            false,
            false
        ); 
        // execute the swap
        clearingHouse.swapToken(accountId, poolId, swapParams);   
        // withdraw excess collateral from the margin account
        clearingHouse.updateMargin(accountId, collateralId, -int256(_amount));
        return (_amount, diff);
    }
}