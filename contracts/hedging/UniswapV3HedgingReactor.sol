pragma solidity >=0.8.9;


import "../interfaces/IHedgingReactor";
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '../tokens/SafeERC20.sol';
import '../tokens/ERC20.sol';

contract UniswapV3HedgingReactor is IHedgingReactor {

    uint constant MAX_UINT = 2**256 - 1;
   
    address public immutable USDC;
    address public immutable MIM;
    address public immutable FRAX;
    address public immutable DAI; // needs setting
    address public immutable USDT;   // needs setting
    address public immutable wETH;  // needs setting
    ISwapRouter public immutable swapRouter;
    
    int256 private delta = 0;

    constructor (ISwapRouter _swapRouter, address _daiAddress, address _usdcAddress, address _wethAddress, address _mimAddress, address _usdtAddress, address _liquidityPoolAddress) {
        swapRouter = _swapRouter;
        DAI = _daiAddress;
        USDC = _usdcAddress;
        MIM = _mimAddress;
        FRAX = _fraxAddress;
        USDT = _usdtAddress;
        wETH = _wethAddress;
        TransferHelper.safeApprove( _daiAddress , address(swapRouter), MAX_UINT );
        TransferHelper.safeApprove( _usdcAddress , address(swapRouter), MAX_UINT );
        TransferHelper.safeApprove( _mimAddress , address(swapRouter), MAX_UINT );
        TransferHelper.safeApprove( _fraxAddress , address(swapRouter), MAX_UINT);
        TransferHelper.safeApprove( _usdtAddress , address(swapRouter), MAX_UINT );
        TransferHelper.safeApprove( _wethAddress , address(swapRouter), MAX_UINT );
    }

    function hedgeDelta(int256 _delta) external {
        if (_delta > 0) {
            // sell wETH into stablecoin.
            // look into oracles for determining price and slippage to obtain amountInMaximum
            // do we need a process to determine which stable pair to use, or will this come from LiquidityPool.sol?
            // Maybe we check which pool has the least slippage?
            // Maybe we check our own stable pool and sell most overweight?
            _swapExactOutputSingle(_delta, amountInMaximum, sellToken);

        } else {
            // delta is negative, so we need to take the negative to make _amountIn positive.
            // Need to determine buyToken. Check slippage or buy underweight stable?
            _swapExactInputSingle(-_delta, amountOutMinimum, buyToken);
        }
    }

    function getDelta(int256 _delta) external returns(uint256 delta){
        return delta;
    }

    function withdraw(uint256 _amount, address _token) external {
        uint currentBalance = ERC20(_token).balanceOf(address(this));
        require(_amount <= currentBalance, "Insufficient balance.");
        ERC20(_token).transfer(msg.sender, _amount);
    }

    function update() external returns (bool) {
        // no collateral management necessary since only using spot assets
        return true;
    }



    function _swapExactOutputSingle(uint256 _amountOut, uint256 _amountInMaximum, address _sellToken) internal returns (uint256 amountIn) {
        // Transfer the specified amount of DAI to this contract.
        // Check msg.sender is vault accress and not the person initialising tx
        TransferHelper.safeTransferFrom(_sellToken, msg.sender, address(this), amountInMaximum);

        uint24 poolfee; // need to find this depending on pool we are suing

        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: _sellToken,
                tokenOut: wETH,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: _amountOut,
                amountInMaximum: _amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = swapRouter.exactOutputSingle(params);

        // update state variable to reflect delta change
        delta += delta;

    }

    // Will be used to sell |_delta| amount of wETH 
    function _swapExactInputSingle(uint256 _amountIn, uint256 _amountOutMinimum, address _buyToken) internal returns (uint256 amountOut) {
        // msg.sender must approve this contract
        
        // Transfer the specified amount of wETH to this contract.
        TransferHelper.safeTransferFrom(wETH, msg.sender, address(this), amountIn);

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: wETH,
                tokenOut: _buyToken,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: 0
            });

         // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);

        // update state variable to reflect delta change
        delta -= delta;
        return amountOut;

    }
}