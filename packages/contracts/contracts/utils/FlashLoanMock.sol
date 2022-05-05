pragma solidity >= 0.8.9;

import "../OptionHandler.sol";
import "../tokens/ERC20.sol";
import "../interfaces/ILiquidityPool.sol";
import "../libraries/SafeTransferLib.sol";
import "hardhat/console.sol";


contract FlashLoanMock {

   OptionHandler public immutable optionHandler;
   ILiquidityPool public immutable liquidityPool;
   address public immutable collateralAsset;

    constructor (address _optionHandler, address _liquidityPool) {
        optionHandler = OptionHandler(_optionHandler);
        liquidityPool = ILiquidityPool(_liquidityPool);
        collateralAsset = liquidityPool.collateralAsset();
        SafeTransferLib.safeApprove(ERC20(collateralAsset), address(liquidityPool), 2**256 -1);
        SafeTransferLib.safeApprove(ERC20(collateralAsset), address(optionHandler), 2**256 -1);
    }

    /**
        @notice simulates someone using a flash loan to deposit and withdraw large liquidity in the same tx
        @param _amount amount of USDC to deposit. Denominated in 1e6
     */

    function depositAndWithdraw(uint256 _amount) public {
        uint shares = _deposit(_amount);
        _withdraw(shares);
    }

    function depositBuyAndWithdraw(uint _collateralAmount, uint _optionAmount, Types.OptionSeries memory _optionSeries) public {
        uint shares = _deposit(_collateralAmount);
        _buyOptionSeries(_optionSeries, _optionAmount);
        _withdraw(shares);
    }

    function depositBuySellAndWithdraw(uint _collateralAmount, uint _optionAmount, Types.OptionSeries memory _optionSeries) public returns (address){
        uint shares = _deposit(_collateralAmount);
        (uint optionAmount, address seriesAddress) =_buyOptionSeries(_optionSeries, _optionAmount);
        _sellOptionSeriesBack(seriesAddress, optionAmount);
        _withdraw(shares);
      
        return seriesAddress;
    }

    function _deposit(uint256 _amount) internal returns (uint) {
        SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), _amount);
        return liquidityPool.deposit(_amount, address(this));
       
    }

    function _withdraw(uint256 shares) internal {
         // make recipient msg.sender so USDC goes back to calling address
        // withdraw 80% each time to get around buffer requirements in liquidity pool
        uint usdcReceived = liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
        usdcReceived += liquidityPool.withdraw(shares * 8/10, msg.sender);
        shares = ERC20(address(liquidityPool)).balanceOf(address(this));
    }

    function _buyOptionSeries(Types.OptionSeries memory _optionSeries, uint _amount) internal returns (uint optionAmount, address series){
        (uint256 premium,) = liquidityPool.quotePriceWithUtilizationGreeks(_optionSeries, _amount);
        SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), premium/10**12);
        return optionHandler.issueAndWriteOption(_optionSeries, _amount);
    }

    function _sellOptionSeriesBack(address _seriesAddress, uint _amount) internal {
        SafeTransferLib.safeApprove(ERC20(_seriesAddress), address(optionHandler), _amount);
        uint balanceBefore = ERC20(collateralAsset).balanceOf(address(this));
        optionHandler.buybackOption(_seriesAddress, _amount);
        uint balanceAfter = ERC20(collateralAsset).balanceOf(address(this));
        SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, balanceAfter - balanceBefore);
    }   

    

    /**
        @notice simulates buying and selling options
     */
}