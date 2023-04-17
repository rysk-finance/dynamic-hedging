import type {
  CallOrPut,
  CallSide,
  ChainData,
  CollateralType,
  PutSide,
  StrikeOptions,
  UserPositions,
  UserVaults,
} from "src/state/types";
import type { DHVLensMK1 } from "src/types/DHVLensMK1";
import type { InitialDataQuery, OptionsTransaction, Vault } from "./types";

import { readContract, readContracts } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { NewControllerABI } from "src/abis/NewController_ABI";
import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";
import {
  fromE27toInt,
  fromUSDC,
  fromWei,
  fromWeiToInt,
  fromWeiToOpyn,
  tFormatUSDC,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { toTwoDecimalPlaces } from "src/utils/rounding";

const getExpiries = (expiries: InitialDataQuery["expiries"]) => {
  return expiries.reduce((expiryList, { timestamp }) => {
    if (dayjs.unix(Number(timestamp)).utc().hour() === 8) {
      expiryList.push(timestamp);
    }

    return expiryList;
  }, [] as string[]);
};

const getUserPositions = (
  positions: InitialDataQuery["longPositions" | "shortPositions"]
) => {
  return positions.reduce(
    (
      positions,
      { netAmount, oToken, optionsBoughtTransactions, optionsSoldTransactions }
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
) => {
  const contracts = expiries.map((expiry) => ({
    address: getContractAddress("DHVLens"),
    abi: DHVLensMK1ABI,
    functionName: "getOptionExpirationDrill" as const,
    args: [BigNumber.from(expiry)],
  }));

  try {
    const data = (await readContracts({
      contracts,
    })) as DHVLensMK1.OptionExpirationDrillStructOutput[];

    const createSide = (
      drill: readonly DHVLensMK1.OptionStrikeDrillStruct[],
      side: CallOrPut,
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
                IV: fromWeiToInt(sell.iv) * 100,
                quote: _getQuote(sell, true),
              },
              buy: {
                disabled: buy.disabled,
                IV: fromWeiToInt(buy.iv) * 100,
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

    return data.reduce(
      (chainData, { callOptionDrill, expiration, putOptionDrill }) => {
        const expiry = expiration.toNumber();
        const calls = createSide(callOptionDrill, "call", expiry);
        const puts = createSide(putOptionDrill, "put", expiry);
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
  } catch (error) {
    logError(error);

    return {};
  }
};

const getOperatorStatus = async (address?: HexString) => {
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

const getUserVaults = (vaults: Vault[]) => {
  return vaults.reduce(
    (acc, curr) => {
      if (curr.shortOToken) {
        acc[curr.shortOToken.id] = curr.vaultId;
      }
      acc.length++;

      return acc;
    },
    { length: 0 } as UserVaults
  );
};

const getLiquidationCalculationParameters = async () => {
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

  const _parseResults = (results: BigNumber | readonly BigNumber[]) => {
    if (results instanceof BigNumber) {
      return fromE27toInt(results) as number;
    } else {
      return results.map((result) => result.toNumber()) as number[];
    }
  };

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
          USDC: _parseResults(parameters[1]) as number,
          WETH: _parseResults(parameters[3]) as number,
        },
        put: {
          USDC: _parseResults(parameters[0]) as number,
          WETH: _parseResults(parameters[2]) as number,
        },
      },
      timesToExpiry: {
        call: {
          USDC: _parseResults(parameters[5]) as number[],
          WETH: _parseResults(parameters[7]) as number[],
        },
        put: {
          USDC: _parseResults(parameters[4]) as number[],
          WETH: _parseResults(parameters[6]) as number[],
        },
      },
    };
  };
    

export const getInitialData = async (
  data: InitialDataQuery,
  address?: HexString
) => {
  const { expiries, longPositions, shortPositions } = data;

  // Get expiries.
  const validExpiries = getExpiries(expiries);

  // Get user positions.
  const userPositions = getUserPositions([...longPositions, ...shortPositions]);

  // Get chain data.
  const chainData = await getChainData(validExpiries, userPositions);

  // Get operator status.
  const isOperator = await getOperatorStatus(address);

  // Get all user short position vaults.
  const userVaults = getUserVaults(data.vaults);

  // Get required parameters for calculating liquidation price of shorts.
  const liquidationParameters = await getLiquidationCalculationParameters();

  return [
    validExpiries,
    userPositions,
    chainData,
    isOperator,
    userVaults,
    liquidationParameters,
  ] as const;
};
