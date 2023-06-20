import type { InitialDataQuery } from "../types";

import { getExpiries } from "./getExpiries";
import { getUserPositions } from "./getUserPositions";
import { getChainData } from "./getChainData";
import { getOperatorStatus } from "./getOperatorStatus";
import { getUserVaults } from "./getUserVaults";
import { getLiquidationCalculationParameters } from "./getLiquidationCalculationParameters";
import { getLiquidityPoolInfo } from "./getLiquidityPoolInfo";
import { buildOracleHashMap } from "./buildOracleHashMap";

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

  // Get all user short position vaults.
  const userVaults = await getUserVaults(address);

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
    userVaults,
    liquidationParameters,
    liquidityPoolInfo,
    oracleHashMap,
  ] as const;
};
