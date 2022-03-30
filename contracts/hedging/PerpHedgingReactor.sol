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
        // make sure the caller is the vault
        require(msg.sender == parentLiquidityPool, "!vault");
        if (_delta > 0) {
        // if the delta to hedge is positive call _goShort()
        deltaChange = _goShort(_delta);
        } else if (_delta < 0) {
        // if the delta to hedge is negative call _goLong()
        deltaChange = _goLong(_delta);
        }
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
    }

    /// @inheritdoc IHedgingReactor
    function withdraw(uint256 _amount, address _token) external returns (uint256) {
        require(msg.sender == parentLiquidityPool, "!vault");
        // check the holdings if enough just lying around then transfer it
        // get the difference then call liquidatePosition()
        // adjust the internal delta in accordance with the change that liquidatePosition made
    }

    /// @inheritdoc IHedgingReactor
    function update() external view returns (int256) {
        if (msg.sender != keeper){revert InvalidSender();}
        // check the collateral health of positions
        // if there is not enough collateral then request more
        // if there is too much collateral then return some to the pool
        // change the internal holdings around
        // return the collateral spent
        return 69420;
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


    /** @notice function to open a short perp position
        @param _amount the amount to open
        @return deltaChange The resulting difference in delta exposure
    */
    function _goShort(int256 _amount) internal returns (int256 ) {
        uint256 collatToDeposit;
        uint256 collatToWithdraw;
        // check for long positions
        int256 netPosition = clearingHouse.getAccountNetTokenPosition(accountId, poolId);
        // get the new net position with the amount of the swap added
        int256 newPosition = netPosition + _amount;
        (,,IClearingHouse.CollateralDepositView[] memory collatDeposits,) = clearingHouse.getAccountInfo(accountId);
        if (address(collatDeposits[0].collateral) != collateralAsset) {revert IncorrectCollateral();}
        uint256 collat = collatDeposits[0].balance;
        uint256 currentPrice = PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset);
        // calculate the margin requirement for newPosition
        uint256 totalCollatNeeded = newPosition >= 0 
                                ? 
                                (((uint256(newPosition) * currentPrice) / 1e18) * healthFactor) / MAX_BIPS 
                                : 
                                (((uint256(-newPosition) * currentPrice) / 1e18) * healthFactor) / MAX_BIPS;
        // if there is not enough collateral then increase the margin collateral
        // if there is too much collateral then decrease the margin collateral
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
            SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), collatToDeposit);
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
            clearingHouse.updateMargin(accountId, collateralId, -int256(collatToWithdraw));
            SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, uint256(collatToWithdraw));
            // make the swapParams
            IClearingHouseStructures.SwapParams memory swapParams = IClearingHouseStructures.SwapParams(
                _amount,
                0,
                false,
                false
            ); 
            // execute the swap
            clearingHouse.swapToken(accountId, poolId, swapParams);
        }
        return _amount;
    }

    /** @notice function to sell exact amount of wETH to decrease delta
        @param _amount the amount to open
        @return deltaChange The resulting difference in delta exposure
    */
    function _goLong(int256 _amount) internal returns (int256) {
        // check for a short position, if there is then close it
        // open a perp position using the various variables of the pool
        int256 amountOut;
        return _amount;
    }

    /**
        @notice function to close positions if stable collateral is needed in the liquidity pool.
        @param _amount the amount to liquidate
     */
    function _liquidatePosition(uint256 _amount) internal returns (uint256 stableBalanceReceived){
        // look at the net pool holdings
        // determine the stablecoins to withdraw and the associated position adjustment required
        // withdraw them, record the stables withdrawn and the delta change
    }
}