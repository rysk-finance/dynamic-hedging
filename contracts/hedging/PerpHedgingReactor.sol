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

    // @notice limit to ensure we arent doing inefficient computation for dust amounts
    uint256 public minAmount = 1e16;

    error InvalidSender();

    constructor (IClearingHouse _clearingHouse, address _collateralAsset, address _wethAddress, address _parentLiquidityPool, uint24 _poolFee, address _priceFeed) {
        clearingHouse = _clearingHouse;
        collateralAsset = _collateralAsset;
        wETH = _wethAddress;
        parentLiquidityPool = _parentLiquidityPool;
        priceFeed = _priceFeed;
    }

    /// @notice update the minAmount parameter
    function setMinAmount(uint _minAmount) public onlyOwner {
        minAmount = _minAmount;
    }

    /// @notice update the keeper
    function setKeeper(address _keeper) public onlyOwner {
        keeper = _keeper;
    }


    /// @inheritdoc IHedgingReactor
    function hedgeDelta(int256 _delta) external returns (int256 deltaChange) {
        // make sure the caller is the vault
        require(msg.sender == parentLiquidityPool, "!vault");
        int256 deltaChange;
        if (_delta > 0) {
        // if the delta to hedge is positive call _goShort()
        deltaChange = _goShort(-_delta);
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
    function _goShort(int256 _amount) internal returns (int256) {
        // check for a long position, if there is then close it
        // open the perp position using the various variables of the pool
        int256 amountIn;
        return amountIn;
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