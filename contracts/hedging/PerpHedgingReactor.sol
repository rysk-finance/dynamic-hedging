pragma solidity >=0.8.9;

import "../PriceFeed.sol";
import "../interfaces/IERC20.sol";
import "../libraries/OptionsCompute.sol";
import '../libraries/SafeTransferLib.sol';
import "../interfaces/IHedgingReactor.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@rage/core/contracts/interfaces/IClearingHouse.sol";

import "hardhat/console.sol";


/**
    @title A hedging reactor that will manage delta by opening or closing short or long perp positions
 */

contract PerpHedgingReactor is IHedgingReactor, Ownable {

    /// @notice used for unlimited token approval 
    uint256 private constant MAX_UINT = 2**256 - 1;
    /// @notice address of the parent liquidity pool contract
    address public parentLiquidityPool;
    /// @notice address of the keeper of this pool
    address public keeper;
    /// @notice address of the price feed used for getting asset prices
    address public priceFeed;
    /// @notice collateralAsset used for collateralising the pool
    address public collateralAsset;
    /// @notice address of the wETH contract 
    address public immutable wETH;
    /// @notice instance of the clearing house interface
    IClearingHouse public clearingHouse;
    /// @notice delta of the pool
    int256 public internalDelta;
    /// @notice limit to ensure we arent doing inefficient computation for dust amounts
    uint256 public minAmount = 1e16;
    /// @notice accountId for the perp pool
    uint256 public accountId;
    /// @notice collateralId to be used in the perp pool
    uint32 public collateralId;
    /// @notice poolId to be used in the perp pool
    uint32 public poolId;
    /// @notice desired healthFactor of the pool
    uint256 public healthFactor = 12_000;
    /// @notice max bips
    uint256 public MAX_BIPS = 10_0000;

    error InvalidSender();
    error IncorrectCollateral();

    constructor (
        IClearingHouse _clearingHouse, 
        address _collateralAsset, 
        address _wethAddress, 
        address _parentLiquidityPool, 
        uint32 _collateralId, 
        address _priceFeed
        ) {
        clearingHouse = _clearingHouse;
        collateralAsset = _collateralAsset;
        wETH = _wethAddress;
        parentLiquidityPool = _parentLiquidityPool;
        priceFeed = _priceFeed;
        collateralId = _collateralId;
        // make a perp account
        accountId = clearingHouse.createAccount();
    }

    /// @notice update the minAmount parameter
    function setMinAmount(uint _minAmount) public onlyOwner {
        minAmount = _minAmount;
    }
    /// @notice update the health factor parameter
    function setHealthFactor(uint _healthFactor) public onlyOwner {
        healthFactor = _healthFactor;
    }
    /// @notice update the keeper
    function setKeeper(address _keeper) public onlyOwner {
        keeper = _keeper;
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
    function getDelta() external view returns(int256 delta){
        return internalDelta;
    }

    /// @inheritdoc IHedgingReactor
    function getPoolDenominatedValue() external view returns(uint256 value){
        // calculate the value of the pools holdings (including any funding)
        // access the collateral held in the account
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        // just make sure the collateral at index 0 is correct (this is unlikely to ever fail, but should be checked)
        if (address(collatDeposits[0].collateral) != collateralAsset) {revert IncorrectCollateral();}
        value = collatDeposits[0].balance;
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
            return _amount;
        }
        // get the collatNeeded (this should not underflow as the 
        // previous check will have eliminated these cases)
        uint256 collatNeeded = convertedAmount - balance;
        // liquidate the correct amount
        (uint256 collatReturned, int256 deltaChange) = _liquidatePosition(_amount);
        // adjust the internal delta in accordance with the change that liquidatePosition made
        internalDelta += deltaChange;
        // get the actual returned value to send back to the user
        if (collatReturned < collatNeeded) {
            // transfer assets back to the liquidityPool 
            // TODO: track this transfer either in LiquidityPool or here
            SafeTransferLib.safeTransfer(ERC20(_token), parentLiquidityPool, collatReturned + balance);
            return collatReturned + balance;
        } else {
            // transfer assets back to the liquidityPool 
            // TODO: track this transfer either in LiquidityPool or here
            SafeTransferLib.safeTransfer(ERC20(_token), parentLiquidityPool, convertedAmount);
            return convertedAmount;
        }
    }

    /// @inheritdoc IHedgingReactor
    function update() external returns (uint256) {
        if (msg.sender != keeper){revert InvalidSender();}
        int256 netPosition = clearingHouse.getAccountNetTokenPosition(accountId, poolId);
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        // just make sure the collateral at index 0 is correct (this is unlikely to ever fail, but should be checked)
        if (address(collatDeposits[0].collateral) != collateralAsset) {revert IncorrectCollateral();}
        uint256 collat = collatDeposits[0].balance;
        // get the current price of the underlying asset from chainlink to be used to calculate position sizing
        uint256 currentPrice = PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset);
        // check the collateral health of positions
        // get the amount of collateral that should be expected for a given amount
        uint256 collatRequired = (((uint256(netPosition) * currentPrice) / 1e18) * healthFactor) / MAX_BIPS;
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
    /**
        @notice convert between standand 10e18 decimals and custom decimals for different tokens
        @param _token token to format the output to
        @param _amount imput amount denoted in 10e18
        @return _convertedAmount amount converted to correct decimal format
     */
    function decimalHelper(address _token, uint _amount) internal pure returns(uint _convertedAmount) {
        return _amount;
    }


    /** @notice function to change the perp position
        @param _amount the amount of position to open or close
        @return deltaChange The resulting difference in delta exposure
    */
    function _changePosition(int256 _amount) internal returns (int256 ) {
        uint256 collatToDeposit;
        uint256 collatToWithdraw;
        // check the net position of the margin account
        int256 netPosition = clearingHouse.getAccountNetTokenPosition(accountId, poolId);
        // get the new net position with the amount of the swap added
        int256 newPosition = netPosition + _amount;
        // access the collateral held in the account
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        // just make sure the collateral at index 0 is correct (this is unlikely to ever fail, but should be checked)
        if (address(collatDeposits[0].collateral) != collateralAsset) {revert IncorrectCollateral();}
        uint256 collat = collatDeposits[0].balance;
        // get the current price of the underlying asset from chainlink to be used to calculate position sizing
        uint256 currentPrice = PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset);
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
            collatToWithdraw = collat - totalCollatNeeded;
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
                false
            ); 
            // execute the swap
            clearingHouse.swapToken(accountId, poolId, swapParams);
            // withdraw excess collateral from the margin account
            clearingHouse.updateMargin(accountId, collateralId, -int256(collatToWithdraw));
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
        if (address(collatDeposits[0].collateral) != collateralAsset) {revert IncorrectCollateral();}
        uint256 collat = collatDeposits[0].balance;
        // get the current price of the underlying asset from chainlink to be used to calculate position sizing
        uint256 currentPrice = PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset);
        if (collat <= _amount) {
            // if the amount needed is greater than or equal to the collateral then close all positions and withdraw
            // all collateral
            // make the swapParams to close the position
            IClearingHouseStructures.SwapParams memory swapParams = IClearingHouseStructures.SwapParams(
                -netPosition,
                0,
                false,
                false
            ); 
            // execute the swap
            clearingHouse.swapToken(accountId, poolId, swapParams); 
            // withdraw all collateral from the margin account
            clearingHouse.updateMargin(accountId, collateralId, -int256(collat));
            return (collat, -netPosition);
        }
        // reduce the collateral by amount
        uint256 newCollat = collat - _amount;
        // calculate what the position should be if the collat is changed to newCollat
        int256 newPosition = int256((newCollat * MAX_BIPS * 1e18) / (healthFactor * currentPrice)); 
        newPosition = newPosition > 0 ? newPosition : -newPosition;
        int256 diff = newPosition - netPosition;
        IClearingHouseStructures.SwapParams memory swapParams = IClearingHouseStructures.SwapParams(
            diff,
            0,
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