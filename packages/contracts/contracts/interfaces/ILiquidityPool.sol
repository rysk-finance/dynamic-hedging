// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.9;
import { Types } from "../libraries/Types.sol";
import "../interfaces/IOptionRegistry.sol";
import "./IERC20.sol";

interface ILiquidityPool is IERC20 {
	function collateralCap() external view returns (uint256);

	function epoch() external view returns (uint256);

	function depositReceipts(address depositor) external view returns (Types.DepositReceipt memory);

	function withdrawalReceipts(address withdrawer)
		external
		view
		returns (Types.WithdrawalReceipt memory);

	function epochPricePerShare(uint256 epoch) external view returns (uint256 price);

	function collateralAsset() external view returns (address);

	function underlyingAsset() external view returns (address);

	function strikeAsset() external view returns (address);

	function collateralAllocated() external view returns (uint256);

	function bufferPercentage() external view returns (uint256);

	function MAX_BPS() external view returns (uint256);

	function handlerIssue(Types.OptionSeries memory optionSeries) external returns (address);

	function resetEphemeralValues() external;

	function getAssets() external view returns (uint256);

	function redeem(uint256) external returns (uint256);

	function handlerWriteOption(
		Types.OptionSeries memory optionSeries,
		address seriesAddress,
		uint256 amount,
		IOptionRegistry optionRegistry,
		uint256 premium,
		int256 delta,
		address recipient
	) external returns (uint256);

	function handlerBuybackOption(
		Types.OptionSeries memory optionSeries,
		uint256 amount,
		IOptionRegistry optionRegistry,
		address seriesAddress,
		uint256 premium,
		int256 delta,
		address seller
	) external returns (uint256);

	function handlerIssueAndWriteOption(
		Types.OptionSeries memory optionSeries,
		uint256 amount,
		uint256 premium,
		int256 delta,
		address recipient
	) external returns (uint256, address);

	function getPortfolioDelta() external view returns (int256);

	function quotePriceWithUtilizationGreeks(
		Types.OptionSeries memory optionSeries,
		uint256 amount,
		bool toBuy
	) external view returns (uint256 quote, int256 delta);
}
