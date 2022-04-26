pragma solidity >=0.8.9;

import "../PriceFeed.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IERC20.sol";
import "../libraries/OptionsCompute.sol";
import '../libraries/SafeTransferLib.sol';
import "../interfaces/IHedgingReactor.sol";
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import "hardhat/console.sol";


/**
    @title A hedging reactor that will manage delta by swapping between ETH and stablecoin spot assets.
 */

contract UniswapV3HedgingReactor is IHedgingReactor, Ownable {

    ///////////////////////////
    /// immutable variables ///
    ///////////////////////////

    /// @notice address of the parent liquidity pool contract
    address public immutable parentLiquidityPool;
    /// @notice address of the price feed used for getting asset prices
    address public immutable priceFeed;
    /// @notice generalised list of stablecoin addresses to trade against wETH
    address public immutable collateral;
    /// @notice address of the wETH contract 
    address public immutable wETH;
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

    // @notice limit to ensure we arent doing inefficient computation for dust amounts
    uint256 public minAmount = 1e16;
    /// @notice uniswap v3 pool fee expressed at 10e6
    uint24 public poolFee;

    //////////////////////////
    /// constant variables ///
    //////////////////////////

    /// @notice used for unlimited token approval 
    uint256 private constant MAX_UINT = 2**256 - 1;

    constructor (ISwapRouter _swapRouter, address _collateral, address _wethAddress, address _parentLiquidityPool, uint24 _poolFee, address _priceFeed) {
        swapRouter = _swapRouter;
        collateral = _collateral;
        wETH = _wethAddress;
        parentLiquidityPool = _parentLiquidityPool;
        poolFee = _poolFee;
        priceFeed = _priceFeed;

        SafeTransferLib.safeApprove( ERC20(collateral), address(swapRouter), MAX_UINT );
        SafeTransferLib.safeApprove( ERC20(_wethAddress), address(swapRouter), MAX_UINT );
    }

    ///////////////
    /// setters ///
    ///////////////

    /// @notice update the uniswap v3 pool fee
    function changePoolFee(uint24 _poolFee) public onlyOwner {
        poolFee = _poolFee;
    }

    /// @notice update the minAmount parameter
    function setMinAmount(uint _minAmount) public onlyOwner {
        minAmount = _minAmount;
    }

    //////////////////////////////////////////////////////
    /// access-controlled state changing functionality ///
    //////////////////////////////////////////////////////

    /// @inheritdoc IHedgingReactor
    function hedgeDelta(int256 _delta) external returns (int256 deltaChange) {
        
        require(msg.sender == parentLiquidityPool, "!vault");
        uint amountOutMinimum = 0;
        uint amountInMaximum = MAX_UINT;
        if (_delta < 0) { // buy wETH
        //TODO calculate amountInMaximum using live oracle data
        //TODO set stablecoin and amountin/out variables
            (int256 deltaChange, uint256 amountPaid) = _swapExactOutputSingle(uint256(-_delta), amountInMaximum, collateral);
            internalDelta += deltaChange;
            return deltaChange;
        } else { // sell wETH
            uint256 ethBalance = IERC20(wETH).balanceOf(address(this));
            if(ethBalance < minAmount){
                return 0;
            }
            if(_delta > int256(ethBalance)){ // not enough ETH to sell to offset delta so sell all ETH available.
                //TODO calculate amountOutMinmmum using live oracle data
                (int256 deltaChange, uint256 amountReceived) = _swapExactInputSingle(ethBalance, amountOutMinimum, collateral);
                  internalDelta += deltaChange;
                return deltaChange;
            } else {
                 (int256 deltaChange, uint256 amountReceived) = _swapExactInputSingle(uint256(_delta), amountOutMinimum, collateral);
                  internalDelta += deltaChange;
                return deltaChange;
            }
        }
    }

    /// @inheritdoc IHedgingReactor
    function withdraw(uint256 _amount, address _token) external returns (uint256) {
        require(msg.sender == parentLiquidityPool, "!vault");
        uint256 convertedAmount = OptionsCompute.convertToDecimals(_amount, IERC20(_token).decimals());
        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 convertedBalance = OptionsCompute.convertFromDecimals(balance, IERC20(_token).decimals());
        if (convertedAmount <= balance) {
            SafeTransferLib.safeTransfer(ERC20(_token) ,msg.sender, convertedAmount);
            return _amount;
        } else {
            // not enough in balance. Liquidate ETH.
            //TODO change amountInMaximum
            uint256 ethBalance = IERC20(wETH).balanceOf(address(this));
            if(ethBalance < minAmount) {
                return 0;
            }
            uint256 stablesReceived = _liquidateETH(convertedAmount - balance, ethBalance, _token);         
            balance = IERC20(_token).balanceOf(address(this));
            if(balance < convertedAmount){
                SafeTransferLib.safeTransfer(ERC20(_token) ,msg.sender, balance);
                internalDelta = int256(IERC20(wETH).balanceOf(address(this)));
                return convertedBalance;
            } else {
                SafeTransferLib.safeTransfer(ERC20(_token) ,msg.sender, convertedAmount);
                internalDelta = int256(IERC20(wETH).balanceOf(address(this)));
                return _amount;
            }
        }
    }

    /////////////////////////////////////////////
    /// external state changing functionality ///
    /////////////////////////////////////////////

    /// @inheritdoc IHedgingReactor
    function update() external returns (int256) {
        return 0;
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
        return OptionsCompute.convertFromDecimals(IERC20(collateral).balanceOf(address(this)), IERC20(collateral).decimals()) +
                (PriceFeed(priceFeed).getNormalizedRate(wETH, collateral) * IERC20(wETH).balanceOf(address(this))) / 10**IERC20(wETH).decimals();
    }

    //////////////////////////
    /// internal utilities ///
    //////////////////////////


    /** @notice function to sell stablecoins for exact amount of wETH to increase delta
        @param _amountOut the exact amount of wETH to buy
        @param _amountInMaximum the max amount of stablecoin willing to spend. Slippage limit.
        @param _sellToken the stablecoin to sell
    */
    function _swapExactOutputSingle(uint256 _amountOut, uint256 _amountInMaximum, address _sellToken) internal returns (int256, uint256) {
        /// @TODO get live uniswap price data to establish _amountInMaximum value and change tempTransferAmount to that value
        uint tempTransferAmount =  5000000000; // 5,000 USDC
        SafeTransferLib.safeTransferFrom(_sellToken, msg.sender, address(this), tempTransferAmount);

        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: _sellToken,
                tokenOut: wETH,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: _amountOut,
                amountInMaximum: _amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        uint256 amountIn = swapRouter.exactOutputSingle(params);
        return (int256(_amountOut), amountIn);
    }

      /** @notice function to sell exact amount of wETH to decrease delta
        @param _amountIn the exact amount of wETH to sell
        @param _amountOutMinimum the min amount of stablecoin willing to receive. Slippage limit.
        @param _buyToken the stablecoin to buy
        @return deltaChange The resulting difference in delta exposure
    */
    function _swapExactInputSingle(uint256 _amountIn, uint256 _amountOutMinimum, address _buyToken) internal returns (int256, uint256) {
    
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: wETH,
                tokenOut: _buyToken,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: 0
            });

         // The call to `exactInputSingle` executes the swap.
        uint256 amountOut = swapRouter.exactInputSingle(params);
        
        // return ngative _amountIn because deltaChange is negative
        return (-int256(_amountIn), amountOut);
    }

    /**
        @notice function to sell ETH if stable collateral is needed in the liquidity pool.
        @param _amountOut Amount of stablecoin needed
        @param _amountInMaximum The max amount of ETH willing to spend. Slippage limit.
        @param _buyToken The stablecoin to buy to withdraw to LP
     */
    
    function _liquidateETH(uint256 _amountOut, uint256 _amountInMaximum, address _buyToken) internal returns (uint256 stableBalanceReceived){
        // tries to use exact output to obtain amount of stablecoin needed to withdraw without over-selling
        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: wETH,
                tokenOut: _buyToken,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: _amountOut,
                amountInMaximum: _amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        // Tries to execute the swap and return output 
        try swapRouter.exactOutputSingle(params) returns (uint256 amountIn) {
            return (_amountOut);
        // Transaction will fail if not enough ETH to fund the output needed
        // So in this case, liquidate all ETH and return output
        } catch {
            ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: wETH,
                tokenOut: _buyToken,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: uint256(internalDelta), // amount of ETH this reactor has
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
            uint256 amountOut = swapRouter.exactInputSingle(params);

            return (amountOut);

        }
    }
}