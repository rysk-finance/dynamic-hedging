// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.9;
import { Types } from "../libraries/Types.sol";
import "../interfaces/IOptionRegistry.sol";
interface ILiquidityPool {
  function collateralAsset() external view returns (address);
  function resetTempValues() external;
  function handlerIssue(Types.OptionSeries memory optionSeries, IOptionRegistry optionRegistry) external returns (address);
  function handlerWriteOption(
    Types.OptionSeries memory optionSeries, 
    address seriesAddress, 
    uint256 amount, 
    IOptionRegistry optionRegistry, 
    uint256 premium,
    address recipient
  ) external returns (uint256);
  function handlerBuybackOption(Types.OptionSeries memory optionSeries, uint256 amount, IOptionRegistry optionRegistry, address seriesAddress, uint256 premium, address seller) external returns (uint256);
  function getPortfolioDelta() external view returns (int256);
  function quotePriceWithUtilizationGreeks(
    Types.OptionSeries memory optionSeries,
    uint amount
  )
    external
    view
    returns (uint256 quote, int256 delta);
  function quotePriceBuying(
      Types.OptionSeries memory optionSeries,
      uint amount
  ) 
  external
  view
  returns (uint256, int256);

}