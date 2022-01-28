pragma solidity >=0.8.9;


import "../interfaces/IHedgingReactor";
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import '../tokens/SafeERC20.sol';
import '../tokens/ERC20.sol';

/**
    @title A hedging reactor that will manage delta by swapping between ETH and stablecoin spot assets.
 */

contract UniswapV3HedgingReactor is IHedgingReactor, Ownable {

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

    uint24 poolFee;

    int256 private internalDelta = 0;


    constructor (ISwapRouter _swapRouter, address[] _stableAddresses, address _parentLiquidityPool, uint24 _poolFee) {
        swapRouter = _swapRouter;
        stablecoinAddresses = _stablecoinAddresses;
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
        if (_delta < 0) { // buy wETH
        //TODO calculate amountInMaximum using live oracle data
            int deltaChange = _swapExactOutputSingle(-_delta, amountInMaximum, stablecoin);
            internalDelta += deltaChange;
            return deltaChange;
        } else { // sell wETH
            uint ethBalance = ERC(wETH).balanceOf(address(this));
            if(_delta > ethBalance){ // not enough ETH to sell to offset delta so sell all ETH available.
                //TODO calculate amountOutMinmmum using live oracle data
                int deltaChange = _swapExactInputSingle(ethBalance, amountOutMinimum, stablecoin);
                  internalDelta += deltaChange;
                return deltaChange;
            } else {
                 int deltaChange = _swapExactInputSingle(-_delta, amountOutMinimum, stablecoin);
                  internalDelta += deltaChange;
                return deltaChange;
            }
        }
    }

    /// @inheritdoc IHedgingReactor
    function getDelta() external view returns(uint256 delta){
        return internalDelta;
    }

    /// @inheritdoc IHedgingReactor
    function withdraw(uint256 _amount, address _token) external {
        require(msg.sender == parentLiquidityPool, "!vault");
        uint balance = ERC20(_token).balanceOf(address(this));
        if(_amount > balance){ // not enough in balance. Liquidate ETH.
            _liquidateETH(_amount - balance, amountInMaximum, _token);
        }  
        SafeERC20.safeTransfer( _token ,msg.sender, _amount);
        internalDelta = ERC20(wETH).balanceOf(address(this));
    }

    /// @inheritdoc IHedgingReactor
    function update() external returns (bool) {
        return true;
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
        // will divide inputs accordingly
    }


    /** @notice function to sell stablecoins for exact amount of wETH to increase delta
        @param _amountOut the exact amount of wETH to buy
        @param _amountInMaximum the max amount of stablecoin willing to spend. Slippage limit.
        @param _sellToken the stablecoin to sell
    */
    function _swapExactOutputSingle(uint256 _amountOut, uint256 _amountInMaximum, address _sellToken) internal returns (deltaChange) {

        TransferHelper.safeTransferFrom(_sellToken, msg.sender, address(this), amountInMaximum);

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
        amountIn = swapRouter.exactOutputSingle(params);

        return _amountOut;
    }

      /** @notice function to sell exact amount of wETH to decrease delta
        @param _amountIn the exact amount of wETH to sell
        @param _amountOutMinimum the min amount of stablecoin willing to receive. Slippage limit.
        @param _sellToken the stablecoin to buy
        @return deltaChange The resulting difference in delta exposure
    */
    function _swapExactInputSingle(uint256 _amountIn, uint256 _amountOutMinimum, address _buyToken) internal returns (uint256 deltaChange) {

        uint24 poolfee; // need to find this depending on pool we are using

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: wETH,
                tokenOut: _buyToken,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: decimalHelper(_buyToken, _amountOutMinimum),
                sqrtPriceLimitX96: 0
            });

         // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);

        return _amountIn;
    }

    /**
        @notice function to sell ETH if stable collateral is needed in the liquidity pool.
        @param _amountOut Amount of stablecoin needed
        @param _amountInMaximum The max amount of stablecoin willing to spend. Slippage limit.
        @param _buyToken The stablecoin to buy to withdraw to LP
     */

    function _liquidateETH(uint256 _amountOut, uint256 amountInMaximum, address _buyToken) internal {

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
        amountIn = swapRouter.exactOutputSingle(params);

    }
}