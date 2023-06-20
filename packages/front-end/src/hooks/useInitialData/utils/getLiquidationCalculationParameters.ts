import type { CollateralType, SpotShock, TimesToExpiry } from "src/state/types";

import { readContracts } from "@wagmi/core";

import { BigNumber } from "ethers";

import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";
import {
  defaultSpotShock,
  defaultTimesToExpiry,
} from "src/state/GlobalContext";
import { fromE27toInt } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";

export const getLiquidationCalculationParameters = async (): Promise<{
  spotShock: SpotShock;
  timesToExpiry: TimesToExpiry;
}> => {
  const _getParams = (
    collateral: CollateralType,
    functionName: "getSpotShock" | "getTimesToExpiry",
    isPut: boolean
  ) => {
    return {
      abi: NewMarginCalculatorABI,
      address: getContractAddress("OpynNewCalculator"),
      functionName,
      args: [
        getContractAddress("WETH"),
        getContractAddress("USDC"),
        getContractAddress(collateral),
        isPut,
      ],
    } as const;
  };

  const _parseSpotShockResults = (results?: BigNumber) => {
    return results ? (fromE27toInt(results) as number) : defaultSpotShock;
  };

  const _parseTimesToExpiry = (results?: readonly BigNumber[]) => {
    return results
      ? (results.map((result) => result.toNumber()) as number[])
      : defaultTimesToExpiry;
  };

  try {
    const parameters = await readContracts({
      contracts: [
        _getParams("USDC", "getSpotShock", true),
        _getParams("USDC", "getSpotShock", false),
        _getParams("WETH", "getSpotShock", true),
        _getParams("WETH", "getSpotShock", false),
        _getParams("USDC", "getTimesToExpiry", true),
        _getParams("USDC", "getTimesToExpiry", false),
        _getParams("WETH", "getTimesToExpiry", true),
        _getParams("WETH", "getTimesToExpiry", false),
      ],
    });

    return {
      spotShock: {
        call: {
          USDC: _parseSpotShockResults(parameters[1] as BigNumber),
          WETH: _parseSpotShockResults(parameters[3] as BigNumber),
        },
        put: {
          USDC: _parseSpotShockResults(parameters[0] as BigNumber),
          WETH: _parseSpotShockResults(parameters[2] as BigNumber),
        },
      },
      timesToExpiry: {
        call: {
          USDC: _parseTimesToExpiry(parameters[5] as BigNumber[]),
          WETH: _parseTimesToExpiry(parameters[7] as BigNumber[]),
        },
        put: {
          USDC: _parseTimesToExpiry(parameters[4] as BigNumber[]),
          WETH: _parseTimesToExpiry(parameters[6] as BigNumber[]),
        },
      },
    };
  } catch (error) {
    logError(error);

    return {
      spotShock: {
        call: {
          USDC: defaultSpotShock,
          WETH: defaultSpotShock,
        },
        put: {
          USDC: defaultSpotShock,
          WETH: defaultSpotShock,
        },
      },
      timesToExpiry: {
        call: {
          USDC: defaultTimesToExpiry,
          WETH: defaultTimesToExpiry,
        },
        put: {
          USDC: defaultTimesToExpiry,
          WETH: defaultTimesToExpiry,
        },
      },
    };
  }
};
