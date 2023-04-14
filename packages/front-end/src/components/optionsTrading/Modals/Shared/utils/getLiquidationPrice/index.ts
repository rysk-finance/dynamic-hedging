import type { CallOrPut, SpotShock, TimesToExpiry } from "src/state/types";

import dayjs from "dayjs";
import { BigNumber } from "ethers";

import { readContract } from "@wagmi/core";

import { getContractAddress } from "src/utils/helpers";
import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";
import { fromE27toInt, truncate } from "src/utils/conversion-helper";

const USDC = getContractAddress("USDC");
const WETH = getContractAddress("WETH");

/**
 * Utility function for calculating the liquidation price of a short position.
 *
 * For greater detail, please see the adjoining document. Notated values in
 * said document match up with the following parameters within this function.
 *
 * |------------------|------------------|
 * |  Function Param  |  Document Param  |
 * |------------------|------------------|
 * |  collateral      |  Collat(s,p,t)   |
 * |  spotShock       |  spot_shock      |
 * |  strikePrice     |  s               |
 * |  maxPrice        |  P(t)            |
 * |  return value    |  p               |
 * |------------------|------------------|
 *
 * @param amount - The order size the user wishes to sell.
 * @param callOrPut - The flavor of the option.
 * @param collateral - The amount of collateral the user is providing.
 * @param collateralAddress - The address of the collateral type being used.
 * @param ethPrice - The current oracle Ether price.
 * @param expiry - The expiry of the option in unix time.
 * @param spotShock - A dict of values for all collateral types & flavors.
 * @param strikePrice - The strike price of the option.
 * @param timesToExpiry - A dict of values for all collateral types & flavors.
 *
 * @returns - The liquidation price for the position.
 */
export const getLiquidationPrice = async (
  amount: number,
  callOrPut: CallOrPut,
  collateral: number,
  collateralAddress: HexString,
  ethPrice: number,
  expiry: number,
  spotShock: SpotShock,
  strikePrice: number,
  timesToExpiry: TimesToExpiry
) => {
  const collateralType = collateralAddress === USDC ? "USDC" : "WETH";
  const now = dayjs().unix();

  // Get contract call args.
  const timeToExpiry = timesToExpiry[callOrPut][collateralType].find(
    (time) => time >= expiry - now
  );
  const isPut = callOrPut === "put";

  // get maxPrice.
  const getMaxPriceResponse = await readContract({
    abi: NewMarginCalculatorABI,
    address: getContractAddress("OpynNewCalculator"),
    functionName: "getMaxPrice",
    args: [WETH, USDC, collateralAddress, isPut, BigNumber.from(timeToExpiry)],
  });
  const maxPrice = fromE27toInt(getMaxPriceResponse);

  // Adjust params based on collateral type.
  const adjustedCollateral =
    collateralType === "USDC" ? collateral : ethPrice * collateral;
  const shock = spotShock[callOrPut][collateralType];

  switch (true) {
    case !isPut && adjustedCollateral / (shock * strikePrice) > maxPrice:
      return truncate(
        (adjustedCollateral - (maxPrice - 1) * (shock * strikePrice)) / amount
      );

    case !isPut && adjustedCollateral / (shock * strikePrice) < maxPrice:
      return truncate(adjustedCollateral / maxPrice / amount);

    case isPut && strikePrice * maxPrice > adjustedCollateral:
      return truncate(
        (adjustedCollateral - strikePrice / ((maxPrice - 1) * shock)) / amount
      );

    case isPut && strikePrice * maxPrice < adjustedCollateral:
      return 0; // in this case P doesn't exist, what value to return?

    default:
      return 0;
  }
};
