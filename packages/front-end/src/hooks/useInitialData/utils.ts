import type {
  CallOrPut,
  CallSide,
  ChainData,
  PutSide,
  StrikeOptions,
  UserPositions,
  UserVaults,
} from "src/state/types";
import type { DHVLensMK1 } from "src/types/DHVLensMK1";
import type { InitialDataQuery, OptionsTransaction, Vault } from "./types";

import { captureException } from "@sentry/react";
import { readContract, readContracts } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { getImpliedVolatility } from "implied-volatility";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { NewControllerABI } from "src/abis/NewController_ABI";
import {
  fromUSDC,
  fromWei,
  fromWeiToInt,
  fromWeiToOpyn,
  SECONDS_IN_YEAR,
  tFormatUSDC,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { toTwoDecimalPlaces } from "src/utils/rounding";

const getExpiries = (expiries: InitialDataQuery["expiries"]) => {
  return expiries.reduce((expiryList, { timestamp }) => {
    if (dayjs.unix(Number(timestamp)).utc().hour() === 8) {
      expiryList.push(timestamp);
    }

    return expiryList;
  }, [] as string[]);
};

const getUserPositions = (positions: InitialDataQuery["positions"]) => {
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

          const _getQuote = (buyOrSell: DHVLensMK1.TradingSpecStruct) => {
            const fee = Number(fromUSDC(buyOrSell.fee as BigNumber));
            const quote = Number(fromUSDC(buyOrSell.quote as BigNumber));
            const total = fee + quote;

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

          const position = userPositions[expiry]?.tokens.find(
            (position) =>
              fromWeiToOpyn(strike).eq(position.strikePrice) &&
              (side === "put") === position.isPut
          );

          sideData[strikeUSDC] = {
            [side]: {
              sell: {
                disabled: sell.disabled || sell.premiumTooSmall,
                IV: _getIV(Number(fromUSDC(sell.quote))),
                quote: _getQuote(sell),
              },
              buy: {
                disabled: buy.disabled,
                IV: _getIV(Number(fromUSDC(buy.quote))),
                quote: _getQuote(buy),
              },
              delta: toTwoDecimalPlaces(Number(fromWei(delta))),
              pos: fromWeiToInt(position?.netAmount || 0),
              exposure: Number(fromWei(exposure)),
              tokenID: position?.id,
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
  } catch (error) {
    captureException(error);

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
      captureException(error);

      return false;
    }
  } else {
    return false;
  }
};

const getUserVaults = (vaults: Vault[]) => {
  return vaults.reduce(
    (acc, curr) => {
      acc[curr.shortOToken.id] = curr.vaultId;
      acc.length++;

      return acc;
    },
    { length: 0 } as UserVaults
  );
};

export const getInitialData = async (
  data: InitialDataQuery,
  address?: HexString
) => {
  const { expiries, positions } = data;

  // Get expiries.
  const validExpiries = getExpiries(expiries);

  // Get user positions.
  const userPositions = getUserPositions(positions);

  // Get chain data.
  const chainData = await getChainData(validExpiries, userPositions);

  // Get operator status.
  const isOperator = await getOperatorStatus(address);

  // Get all user short position vaults.
  const userVaults = getUserVaults(data.vaults);

  return [
    validExpiries,
    userPositions,
    chainData,
    isOperator,
    userVaults,
  ] as const;
};
