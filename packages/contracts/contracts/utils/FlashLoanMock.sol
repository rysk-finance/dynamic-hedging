pragma solidity >=0.8.9;

import "../OptionHandler.sol";
import "../PortfolioValuesFeed.sol";
import "../tokens/ERC20.sol";
import "../PriceFeed.sol";
import "../LiquidityPool.sol";
import "../libraries/SafeTransferLib.sol";
import "hardhat/console.sol";

contract FlashLoanMock {
	OptionHandler public immutable optionHandler;
	LiquidityPool public immutable liquidityPool;
	PriceFeed public immutable priceFeed;
	PortfolioValuesFeed public immutable portfolioValuesFeed;
	address public immutable collateralAsset;
	address public immutable underlyingAsset;

	event BuyOption(uint256 optionAmount, address series);

	constructor(
		address _optionHandler,
		address _liquidityPool,
		address _priceFeed,
		address _portfoliovaluesFeed
	) {
		optionHandler = OptionHandler(_optionHandler);
		liquidityPool = LiquidityPool(_liquidityPool);
		priceFeed = PriceFeed(_priceFeed);
		portfolioValuesFeed = PortfolioValuesFeed(_portfoliovaluesFeed);
		collateralAsset = liquidityPool.collateralAsset();
		underlyingAsset = liquidityPool.underlyingAsset();
		SafeTransferLib.safeApprove(ERC20(collateralAsset), address(liquidityPool), 2**256 - 1);
		SafeTransferLib.safeApprove(ERC20(collateralAsset), address(optionHandler), 2**256 - 1);
	}

	function deposit(uint256 _amount) public {
		_deposit(_amount);
	}

	function completeWithdraw(uint256 _shares) public {
		uint256 withdrawalAmount = liquidityPool.completeWithdraw(_shares);
		SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, withdrawalAmount);
	}

	function redeem(uint256 _shares) public {
		liquidityPool.redeem(_shares);
	}

	function buyAndWithdraw(
		uint256 _shares,
		uint256 _optionAmount,
		Types.OptionSeries memory _optionSeries
	) public {
		_buyOptionSeries(_optionSeries, _optionAmount);
		_withdraw(_shares);
	}

	function buySellAndWithdraw(
		uint256 _shares,
		uint256 _optionAmount,
		Types.OptionSeries memory _optionSeries
	) public returns (address) {
		(uint256 optionAmount, address seriesAddress) = _buyOptionSeries(_optionSeries, _optionAmount);
		_sellOptionSeriesBack(seriesAddress, optionAmount);
		_withdraw(_shares);
		return seriesAddress;
	}

	function _deposit(uint256 _amount) internal {
		SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), _amount);
		liquidityPool.deposit(_amount);
	}

	function _withdraw(uint256 shares) internal {
		liquidityPool.initiateWithdraw(shares);
	}

	function _buyOptionSeries(Types.OptionSeries memory _optionSeries, uint256 _amount)
		internal
		returns (uint256 optionAmount, address series)
	{
		(uint256 premium, ) = liquidityPool.quotePriceWithUtilizationGreeks(
			_optionSeries,
			_amount,
			false
		);
		SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), premium / 10**12);
		(optionAmount, series) = optionHandler.issueAndWriteOption(_optionSeries, _amount);
		emit BuyOption(optionAmount, series);
	}

	function _sellOptionSeriesBack(address _seriesAddress, uint256 _amount) public {
		SafeTransferLib.safeApprove(ERC20(_seriesAddress), address(optionHandler), _amount);
		uint256 balanceBefore = ERC20(collateralAsset).balanceOf(address(this));
		optionHandler.buybackOption(_seriesAddress, _amount);
		uint256 balanceAfter = ERC20(collateralAsset).balanceOf(address(this));
		SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, balanceAfter - balanceBefore);
	}

	/**
        @notice simulates buying and selling options
     */
}
