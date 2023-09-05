import type { CollateralType, SpotShock, TimesToExpiry } from "src/state/types";
import type { LiquidationProps } from "./types";

import dayjs from "dayjs";
import { BigNumber } from "ethers";

import { readContracts } from "@wagmi/core";

import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";

const USDC = getContractAddress("USDC");
const WETH = getContractAddress("WETH");

/**
 * Utility function for calculating the liquidation price of multiple short positions.
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
 * The following detail the dict shape for the liquidationProps list param.
 * amount - The order size the user wishes to sell.
 * callOrPut - The flavor of the option.
 * collateral - The amount of collateral the user is providing.
 * collateralAddress - The address of the collateral type being used.
 * expiry - The expiry of the option in unix time.
 * strikePrice - The strike price of the option.
 *
 * @param liquidationProps - List of liquidation props as above.
 * @param ethPrice - The current oracle Ether price.
 * @param spotShock - A dict of values for all collateral types & flavors.
 * @param timesToExpiry - A dict of values for all collateral types & flavors.
 *
 * @returns - The liquidation price for the positions.
 */
export const getLiquidationPrices = async (
  liquidationProps: LiquidationProps[],
  ethPrice: number,
  spotShock: SpotShock,
  timesToExpiry: TimesToExpiry
) => {
  // Get contract call args.
  const additionalProps = liquidationProps.map(
    ({ callOrPut, collateralAddress, expiry }) => {
      const collateralType = (
        collateralAddress === USDC ? "USDC" : "WETH"
      ) as CollateralType;
      const now = dayjs().unix();

      return {
        collateralType,
        timeToExpiry: timesToExpiry[callOrPut][collateralType].find(
          (time) => time >= expiry - now
        ),
        isPut: callOrPut === "put",
      };
    }
  );

  // get maxPrice.
  const getMaxPriceResponses = await readContracts({
    contracts: liquidationProps.map(
      ({ collateralAddress }, index) =>
        ({
          abi: NewMarginCalculatorABI,
          address: getContractAddress("OpynNewCalculator"),
          functionName: "getMaxPrice",
          args: [
            WETH,
            USDC,
            collateralAddress,
            additionalProps[index].isPut,
            BigNumber.from(additionalProps[index].timeToExpiry),
          ],
        }) as const
    ),
  });

  return liquidationProps.map(
    (
      { amount, callOrPut, collateral, collateralAddress, strikePrice },
      index
    ) => {
      const fullyCollateralisedCall =
        collateral >= amount &&
        callOrPut === "call" &&
        collateralAddress === WETH;
      const fullyCollateralisedPut =
        collateral >= strikePrice * amount &&
        callOrPut === "put" &&
        collateralAddress === USDC;

      if (!collateral || fullyCollateralisedCall || fullyCollateralisedPut)
        return 0;

      // get maxPrice as int.
      const maxPrice = Convert.fromE27(getMaxPriceResponses[index]).toInt();

      // Adjust params based on collateral type.
      const { collateralType, isPut } = additionalProps[index];
      const formattedCollateral =
        collateralType === "USDC" ? collateral : ethPrice * collateral;
      const adjustedCollateral = formattedCollateral / amount;
      const shock = spotShock[callOrPut][collateralType];

      switch (true) {
        case !isPut && adjustedCollateral > maxPrice * shock * strikePrice:
          return Convert.round(
            adjustedCollateral + (1 - maxPrice) * shock * strikePrice
          );

        case !isPut && adjustedCollateral <= maxPrice * shock * strikePrice:
          return Convert.round(adjustedCollateral / maxPrice);

        case isPut && adjustedCollateral > strikePrice * maxPrice:
          return Convert.round(
            (strikePrice - adjustedCollateral) / ((1 - maxPrice) * shock)
          );

        case isPut && adjustedCollateral <= strikePrice * maxPrice:
          return strikePrice / shock;

        default:
          return 0;
      }
    }
  );
};
