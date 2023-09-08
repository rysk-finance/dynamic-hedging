import type { InitialDataQuery } from "../types";

import { buildOracleHashMap } from "./buildOracleHashMap";
import { getChainData } from "./getChainData";
import { getExpiries } from "./getExpiries";
import { getLiquidationCalculationParameters } from "./getLiquidationCalculationParameters";
import { getLiquidityPoolInfo } from "./getLiquidityPoolInfo";
import { getOperatorStatus } from "./getOperatorStatus";
import { getUserPositions } from "./getUserPositions";

export const getInitialData = async (
  data: InitialDataQuery,
  address?: HexString
) => {
  const { longPositions, shortPositions, oracleAsset } = data;

  // Get expiries.
  const validExpiries = await getExpiries();

  // Get user positions.
  const userPositions = getUserPositions([...longPositions, ...shortPositions]);

  // Get chain data.
  const chainData = await getChainData(validExpiries, userPositions);

  // Get operator status.
  const isOperator = await getOperatorStatus(address);

  // Get required parameters for calculating liquidation price of shorts.
  const liquidationParameters = await getLiquidationCalculationParameters();

  // Get information about the liquidity pool.
  const liquidityPoolInfo = await getLiquidityPoolInfo();

  // Construct HashMap from WETH oracle prices.
  const oracleHashMap = buildOracleHashMap(oracleAsset);

  return [
    validExpiries,
    userPositions,
    chainData,
    isOperator,
    liquidationParameters,
    liquidityPoolInfo,
    oracleHashMap,
  ] as const;
};
