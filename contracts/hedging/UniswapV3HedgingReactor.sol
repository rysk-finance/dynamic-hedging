pragma solidity >=0.8.9;


import "../interfaces/IHedgingReactor.sol";
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '../libraries/TransferHelper.sol';
import "../access/Ownable.sol";
import "../interfaces/IERC20.sol";
import "../tokens/SafeERC20.sol";
import "hardhat/console.sol";


/**
    @title A hedging reactor that will manage delta by swapping between ETH and stablecoin spot assets.
 */

contract UniswapV3HedgingReactor is IHedgingReactor, Ownable {

    using SafeERC20 for IERC20;

    /// @notice used for unlimited token approval 
    uint256 private constant MAX_UINT = 2**256 - 1;

    /// @notice address of the parent liquidity pool contract
    address private immutable parentLiquidityPool;

    /// @notice generalised list of stablecoin addresses to trade against wETH
    address[] public stablecoinAddresses; // we should try not to use unfixed length array
    
    /// @notice address of the wETH contract 
    address public immutable wETH;

    /// @notice instance of the uniswap V3 router interface
    ISwapRouter public immutable swapRouter;

    /// @notice uniswap v3 pool fee expressed at 10e6

    uint24 public poolFee;

    int256 private internalDelta = 0;


    constructor (ISwapRouter _swapRouter, address[] memory _stableAddresses, address _wethAddress, address _parentLiquidityPool, uint24 _poolFee) {
        swapRouter = _swapRouter;
        stablecoinAddresses = _stableAddresses;
        wETH = _wethAddress;
        parentLiquidityPool = _parentLiquidityPool;
        poolFee = _poolFee;

        for (uint i=0; i < _stableAddresses.length; i++) {
            TransferHelper.safeApprove( _stableAddresses[i] , address(swapRouter), MAX_UINT );
        }
        TransferHelper.safeApprove( _wethAddress , address(swapRouter), MAX_UINT );
    }

    
    /// @inheritdoc IHedgingReactor
    function hedgeDelta(int256 _delta) external returns (int256 deltaChange) {
        
        require(msg.sender == parentLiquidityPool, "!vault");
        uint amountOutMinimum = 0;
        uint amountInMaximum = MAX_UINT;
        if (_delta < 0) { // buy wETH
        //TODO calculate amountInMaximum using live oracle data
        //TODO set stablecoin and amountin/out variables
            (int256 deltaChange, uint256 amountPaid) = _swapExactOutputSingle(uint256(-_delta), amountInMaximum, stablecoinAddresses[0]);
            internalDelta += deltaChange;
            return deltaChange;
        } else { // sell wETH
            uint256 ethBalance = IERC20(wETH).balanceOf(address(this));
            require(ethBalance > 0, "ETH balance is 0");
            if(_delta > int256(ethBalance)){ // not enough ETH to sell to offset delta so sell all ETH available.
                //TODO calculate amountOutMinmmum using live oracle data
                (int256 deltaChange, uint256 amountReceived) = _swapExactInputSingle(ethBalance, amountOutMinimum, stablecoinAddresses[0]);
                  internalDelta += deltaChange;
                return deltaChange;
            } else {
                 (int256 deltaChange, uint256 amountReceived) = _swapExactInputSingle(uint256(_delta), amountOutMinimum, stablecoinAddresses[0]);
                  internalDelta += deltaChange;
                return deltaChange;
            }
        }
    }

    /// @inheritdoc IHedgingReactor
    function getDelta() external view returns(int256 delta){
        return internalDelta;
    }

    /// @inheritdoc IHedgingReactor
    function withdraw(uint256 _amount, address _token) external {
        require(msg.sender == parentLiquidityPool, "!vault");
        uint balance = IERC20(_token).balanceOf(address(this));
        if (_amount <= balance) {
            SafeERC20.safeTransfer( IERC20(_token) ,msg.sender, _amount);
        } else {
            // not enough in balance. Liquidate ETH.
            //TODO change amountInMaximum
            uint256 ethBalance = IERC20(wETH).balanceOf(address(this));
            uint256 stablesReceived = _liquidateETH(_amount - balance, ethBalance, _token);         
            balance = IERC20(_token).balanceOf(address(this));
            if(balance < _amount){
                SafeERC20.safeTransfer( IERC20(_token) ,msg.sender, balance);
            } else {
                SafeERC20.safeTransfer( IERC20(_token) ,msg.sender, _amount);
            }
            internalDelta = int256(IERC20(wETH).balanceOf(address(this)));
        }
    }

    /// @inheritdoc IHedgingReactor
    function update() external view returns (int256) {
        return 69420;
    }

    /// @notice update the uniswap v3 pool fee
    function changePoolFee(uint24 _poolFee) public onlyOwner {
        poolFee = _poolFee;
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


    /** @notice function to sell stablecoins for exact amount of wETH to increase delta
        @param _amountOut the exact amount of wETH to buy
        @param _amountInMaximum the max amount of stablecoin willing to spend. Slippage limit.
        @param _sellToken the stablecoin to sell
    */
    function _swapExactOutputSingle(uint256 _amountOut, uint256 _amountInMaximum, address _sellToken) internal returns (int256, uint256) {
        TransferHelper.safeTransferFrom(_sellToken, msg.sender, address(this), 100000000000);

        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: _sellToken,
                tokenOut: wETH,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: _amountOut,
                amountInMaximum: decimalHelper(_sellToken, _amountInMaximum),
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
                amountOutMinimum: decimalHelper(_buyToken, _amountOutMinimum),
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
        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: wETH,
                tokenOut: _buyToken,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: decimalHelper(_buyToken,_amountOut),
                amountInMaximum: _amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        try swapRouter.exactOutputSingle(params) returns (uint256 amountIn) {
            return (_amountOut);
        } catch {
            ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: wETH,
                tokenOut: _buyToken,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: uint256(internalDelta),
                amountOutMinimum: decimalHelper(_buyToken, 0),
                sqrtPriceLimitX96: 0
            });
            uint256 amountOut = swapRouter.exactInputSingle(params);

            return (amountOut);

        }
    }
}