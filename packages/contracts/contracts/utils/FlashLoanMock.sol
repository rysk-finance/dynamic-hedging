pragma solidity >= 0.8.9;

import "../OptionHandler.sol";
import "../tokens/ERC20.sol";
import "../interfaces/ILiquidityPool.sol";
import "../libraries/SafeTransferLib.sol";


contract FlashLoanMock {

   OptionHandler public immutable optionHandler;
   ILiquidityPool public immutable liquidityPool;
   address public immutable collateralAsset;

    constructor (address _optionHandler, address _liquidityPool) {
        optionHandler = OptionHandler(_optionHandler);
        liquidityPool = ILiquidityPool(_liquidityPool);
        collateralAsset = liquidityPool.collateralAsset();

    }

    /**
        @notice simulates someone using a flash loan to deposit and withdraw large liquidity in the same tx
        @param _amount amount of USDC to deposit. Denominated in 1e6
     */
    function depositAndWithdraw(uint256 _amount) public {
        SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), _amount);
        SafeTransferLib.safeApprove(ERC20(collateralAsset), address(liquidityPool), _amount);
        uint shares = liquidityPool.deposit(_amount, msg.sender);
        SafeTransferLib.safeApprove(ERC20(address(liquidityPool)), address(liquidityPool), shares);
        // make recipient msg.sender so USDC goes back to calling address
        uint usdcReceived = liquidityPool.withdraw(shares, msg.sender);
    }
}