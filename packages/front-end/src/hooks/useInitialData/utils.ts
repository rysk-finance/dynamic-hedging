import type {
  CallOrPut,
  CallSide,
  ChainData,
  CollateralType,
  LiquidityPool,
  PutSide,
  SpotShock,
  StrikeOptions,
  TimesToExpiry,
  UserPositions,
  UserVaults,
  WethOracleHashMap,
} from "src/state/types";
import type { DHVLensMK1 } from "src/types/DHVLensMK1";
import type {
  InitialDataQuery,
  OptionsTransaction,
  OraclePrices,
} from "./types";

import { readContract, readContracts } from "@wagmi/core";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { BigNumber } from "ethers";
import { getImpliedVolatility } from "implied-volatility";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { LiquidityPoolABI } from "src/abis/LiquidityPool_ABI";
import { NewControllerABI } from "src/abis/NewController_ABI";
import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";
import { UserPositionLensMK1ABI } from "src/abis/UserPositionLensMK1_ABI";
import {
  defaultSpotShock,
  defaultTimesToExpiry,
} from "src/state/GlobalContext";
import {
  SECONDS_IN_YEAR,
  fromE27toInt,
  fromOpynToNumber,
  fromUSDC,
  fromWei,
  fromWeiToInt,
  fromWeiToOpyn,
  tFormatUSDC,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { toTwoDecimalPlaces } from "src/utils/rounding";

dayjs.extend(utc);

const getExpiries = async (): Promise<string[]> => {
  const expiries = await readContract({
    address: getContractAddress("DHVLens"),
    abi: DHVLensMK1ABI,
    functionName: "getExpirations",
  });

  return expiries.map((expiry) => expiry.toString()).sort();
};

const getUserPositions = (
  positions: InitialDataQuery["longPositions" | "shortPositions"]
): UserPositions => {
  return positions.reduce(
    (
      positions,
      {
        netAmount,
        oToken,
        optionsBoughtTransactions,
        optionsSoldTransactions,
        vault,
      }
    ) => {
      const { expiryTimestamp } = oToken;
      const isLong = Number(netAmount) > 0;
      const isShort = Number(netAmount) < 0;

      const key = positions[expiryTimestamp];

      const _getPremium = (
        transactions: OptionsTransaction[],
        plusFee: boolean
      ) => {
        return transactions.reduce((acc, { fee, premium }) => {
          const paid = plusFee
            ? Number(premium) + Number(fee)
            : Number(premium) - Number(fee);
          const total = tFormatUSDC(paid, 2) + acc;

          return total;
        }, 0);
      };

      const totalPremiumBought = _getPremium(optionsBoughtTransactions, true);
      const totalPremiumSold = _getPremium(optionsSoldTransactions, false);
      // This figure is only relevant to net long positions so we can display their value.
      const totalPremium = totalPremiumBought - totalPremiumSold;

      const token = {
        ...oToken,
        netAmount,
        totalPremium,
        vault,
      };

      if (!key) {
        positions[expiryTimestamp] = {
          netAmount,
          isLong,
          isShort,
          tokens: [token],
        };
      } else {
        positions[expiryTimestamp] = {
          ...key,
          isLong: key.isLong || isLong,
          isShort: key.isShort || isShort,
          tokens: [...key.tokens, token],
        };
      }

      return positions;
    },
    {} as UserPositions
  );
};

const getChainData = async (
  expiries: string[],
  userPositions: UserPositions
): Promise<ChainData> => {
  const contracts = expiries.map((expiry) => ({
    address: getContractAddress("DHVLens"),
    abi: DHVLensMK1ABI,
    functionName: "getOptionExpirationDrill" as const,
    args: [BigNumber.from(expiry)],
  }));

  const data = (await readContracts({
    contracts,
  })) as DHVLensMK1.OptionExpirationDrillStructOutput[];

  try {
    const createSide = (
      drill: readonly DHVLensMK1.OptionStrikeDrillStruct[],
      side: CallOrPut,
      underlyingPrice: number,
      expiry: number
    ) => {
      return drill.reduce(
        (
          sideData,
          {
            buy,
            sell,
            strike,
            exposure,
            delta,
          }: DHVLensMK1.OptionStrikeDrillStruct
        ) => {
          const strikeUSDC = Number(fromWei(strike));

          const _getQuote = (
            buyOrSell: DHVLensMK1.TradingSpecStruct,
            isSell: boolean
          ) => {
            const fee = Number(fromUSDC(buyOrSell.fee as BigNumber));
            const quote = Number(fromUSDC(buyOrSell.quote as BigNumber));
            const total = isSell ? quote - fee : fee + quote;

            return total >= 0.01
              ? { fee, total, quote }
              : { fee: 0, total: 0, quote: 0 };
          };

          const _getIV = (quote: number) => {
            const IV =
              getImpliedVolatility(
                quote,
                underlyingPrice,
                strikeUSDC,
                (expiry - dayjs().unix()) / SECONDS_IN_YEAR,
                0,
                side
              ) * 100;

            return toTwoDecimalPlaces(IV);
          };

          // Longs - each strike side has only one oToken so we pass tokenID for closing.
          // Shorts - each strike side has two tokens (WETH / USDC)
          // This could also include owning long and short positions for a strike side.
          // UI PLAN
          // Single column UI (net position) --> click to open modal with checkboxes for each possible position.
          // Pass all token IDs as an array to the chain state.
          const positions = (userPositions[expiry]?.tokens || []).reduce(
            (acc, position) => {
              if (
                fromWeiToOpyn(strike).eq(position.strikePrice) &&
                (side === "put") === position.isPut
              ) {
                acc.id.push(position.id);
                acc.netAmount += fromWeiToInt(position.netAmount);
              }

              return acc;
            },
            { id: [], netAmount: 0 } as { id: HexString[]; netAmount: number }
          );

          sideData[strikeUSDC] = {
            [side]: {
              sell: {
                disabled: sell.disabled || sell.premiumTooSmall,
                IV: _getIV(Number(fromUSDC(sell.quote))),
                quote: _getQuote(sell, true),
              },
              buy: {
                disabled: buy.disabled,
                IV: _getIV(Number(fromUSDC(buy.quote))),
                quote: _getQuote(buy, false),
              },
              delta: toTwoDecimalPlaces(Number(fromWei(delta))),
              pos: positions.netAmount,
              exposure: Number(fromWei(exposure)),
              tokenID: positions.id[0], // temp
            },
          } as CallSide | PutSide;

          return sideData;
        },
        {} as {
          [strike: number]: CallSide | PutSide;
        }
      );
    };

    if (data.length && data.length === expiries.length) {
      return data.reduce(
        (
          chainData,
          { callOptionDrill, expiration, putOptionDrill, underlyingPrice }
        ) => {
          const expiry = expiration.toNumber();
          const ethPrice = Number(fromWei(underlyingPrice));
          const calls = createSide(callOptionDrill, "call", ethPrice, expiry);
          const puts = createSide(putOptionDrill, "put", ethPrice, expiry);
          const strikes = Array.from(
            new Set([...Object.keys(calls), ...Object.keys(puts)])
          );

          chainData[expiry] = strikes.reduce(
            (strikeData, currentStrike) => {
              const strike = Number(currentStrike);

              strikeData[strike] = {
                strike: strike,
                ...(calls[strike] as CallSide),
                ...(puts[strike] as PutSide),
              };

              return strikeData;
            },
            {} as {
              [strike: number]: StrikeOptions;
            }
          );

          return chainData;
        },
        {} as ChainData
      );
    } else {
      return {};
    }
  } catch (error) {
    logError(error);

    return {};
  }
};

const getOperatorStatus = async (address?: HexString): Promise<boolean> => {
  const controllerAddress = getContractAddress("OpynController");
  const exchangeAddress = getContractAddress("optionExchange");

  if (address) {
    try {
      return await readContract({
        address: controllerAddress,
        abi: NewControllerABI,
        functionName: "isOperator",
        args: [address, exchangeAddress],
      });
    } catch (error) {
      logError(error);

      return false;
    }
  } else {
    return false;
  }
};

const getUserVaults = async (address?: HexString): Promise<UserVaults> => {
  const userPositionsLens = getContractAddress("UserPositionLens");

  if (!address) {
    return { length: 0 };
  }

  try {
    const vaults = await readContract({
      address: userPositionsLens,
      abi: UserPositionLensMK1ABI,
      functionName: "getVaultsForUser",
      args: [address],
    });

    return vaults.reduce(
      (userVaults, currentVault) => {
        const address = currentVault.otoken.toLowerCase() as HexString;

        userVaults[address] = currentVault.vaultId.toString();
        userVaults.length = userVaults.length + 1;

        return userVaults;
      },
      { length: 0 } as UserVaults
    );
  } catch (error) {
    logError(error);

    return { length: 0 };
  }
};

const getLiquidationCalculationParameters = async (): Promise<{
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

const getLiquidityPoolInfo = async (): Promise<LiquidityPool> => {
  try {
    const [checkBuffer, getAssets] = await readContracts({
      contracts: [
        {
          address: getContractAddress("liquidityPool"),
          abi: LiquidityPoolABI,
          functionName: "checkBuffer",
        },
        {
          address: getContractAddress("liquidityPool"),
          abi: LiquidityPoolABI,
          functionName: "getAssets",
        },
      ],
    });

    const remainingBeforeBuffer = tFormatUSDC(checkBuffer, 2);
    const totalAssets = fromWeiToInt(getAssets);
    const utilisationLow = (remainingBeforeBuffer / totalAssets) * 100 <= 3;

    return {
      remainingBeforeBuffer,
      totalAssets,
      utilisationLow,
    };
  } catch (error) {
    logError(error);

    return {
      remainingBeforeBuffer: 0,
      totalAssets: 0,
      utilisationLow: true,
    };
  }
};

const buildOracleHashMap = (oracleAsset: OraclePrices) => {
  try {
    return oracleAsset.prices.reduce((map, { expiry, price }) => {
      map[expiry] = fromOpynToNumber(price);

      return map;
    }, {} as WethOracleHashMap);
  } catch (error) {
    logError(error);

    return {};
  }
};

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
