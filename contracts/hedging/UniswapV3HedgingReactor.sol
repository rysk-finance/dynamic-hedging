pragma solidity >=0.8.9;


import "../interfaces/IHedgingReactor";
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

contract UniswapV3HedgingReactor is IHedgingReactor {

    address public constant DAI; // needs setting
    address public constant USDC;   // needs setting
    address public constant wETH;  // needs setting
    
    uint24 public constant poolFee = 3000; // pool fee 0.3%

    
    ISwapRouter public immutable swapRouter;

  
    constructor (ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;
    }

    function hedgeDelta(int256 _delta) external {
        
        if (_delta > 0) {
            // sell wETH into stablecoin. DAI for example below
            // how do we calculate _amountInMaximum?
            swapExactOutputSingle(_delta, _amountInMaximum, DAI);
        }
    }


    function swapExactOutputSingle(uint256 _amountOut, uint256 _amountInMaximum, address _sellToken) external returns (uint256 amountIn) {
        // Transfer the specified amount of DAI to this contract.
        // Check msg.sender is vault accress and not the person initialising tx
        TransferHelper.safeTransferFrom(_sellToken, msg.sender, address(this), amountInMaximum);

        // Approve the router to spend the specified `amountInMaximum` of DAI.
        // In production, you should choose the maximum amount to spend based on oracles or other data sources to achieve a better swap.
        TransferHelper.safeApprove(_sellToken, address(swapRouter), amountInMaximum);

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

        // For exact output swaps, the amountInMaximum may not have all been spent.
        // If the actual amount spent (amountIn) is less than the specified maximum amount, we must refund the msg.sender and approve the swapRouter to spend 0.
        // Do we want to do this? Do we want to just have unlimited approval?
        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(DAI, address(swapRouter), 0);
            TransferHelper.safeTransfer(DAI, msg.sender, amountInMaximum - amountIn);
        }
    }
}