import type {
  CallOrPut,
  CallSide,
  ChainData,
  PutSide,
  StrikeOptions,
  UserPositions,
} from "src/state/types";
import type { DHVLensMK1 } from "src/types/DHVLensMK1";

import { readContracts } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { getImpliedVolatility } from "implied-volatility";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { SECONDS_IN_YEAR } from "src/utils/time";

export const getChainData = async (
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
            delta,
            exposure,
            sell,
            strike,
            usdCollatseriesExchangeBalance,
            wethCollatseriesExchangeBalance,
          }: DHVLensMK1.OptionStrikeDrillStruct
        ) => {
          const convertStrike = Convert.fromWei(strike as string);
          const strikeUSDC = convertStrike.toInt();

          const _getQuote = (
            buyOrSell: DHVLensMK1.TradingSpecStruct,
            isSell: boolean
          ) => {
            const fee = Convert.fromUSDC(buyOrSell.fee as BigNumber).toInt();
            const quote = Convert.fromUSDC(
              buyOrSell.quote as BigNumber
            ).toInt();
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

            return Convert.round(IV);
          };

          const positions = (userPositions[expiry]?.activeTokens || []).reduce(
            (acc, position) => {
              const longCollateral = position.vault?.longCollateral;

              if (
                convertStrike.toOpyn().eq(position.strikePrice) &&
                (side === "put") === position.isPut
              ) {
                acc += Convert.fromWei(position.netAmount).toInt();
              }

              if (
                longCollateral &&
                convertStrike.toOpyn().eq(longCollateral.oToken.strikePrice) &&
                (side === "put") === longCollateral.oToken.isPut
              ) {
                acc += Math.abs(Convert.fromWei(position.netAmount).toInt());
              }

              return acc;
            },
            0
          );

          sideData[strikeUSDC] = {
            [side]: {
              buy: {
                disabled: buy.disabled,
                IV: _getIV(Convert.fromUSDC(buy.quote as BigNumber).toInt()),
                quote: _getQuote(buy, false),
              },
              delta: Convert.fromWei(delta as BigNumber).toInt(),
              exchangeAddresses: {
                USDC: usdCollatseriesExchangeBalance.seriesAddress,
                WETH: wethCollatseriesExchangeBalance.seriesAddress,
              },
              exchangeBalances: {
                USDC: usdCollatseriesExchangeBalance.optionExchangeBalance,
                WETH: wethCollatseriesExchangeBalance.optionExchangeBalance,
              },
              exposure: {
                net: Convert.fromWei(exposure as BigNumber).toInt(),
                USDC: {
                  long: Convert.fromWei(
                    usdCollatseriesExchangeBalance.longExposure as BigNumber
                  ).toInt(),
                  short: Convert.fromWei(
                    usdCollatseriesExchangeBalance.shortExposure as BigNumber
                  ).toInt(),
                },
                WETH: {
                  long: Convert.fromWei(
                    wethCollatseriesExchangeBalance.longExposure as BigNumber
                  ).toInt(),
                  short: Convert.fromWei(
                    wethCollatseriesExchangeBalance.shortExposure as BigNumber
                  ).toInt(),
                },
              },
              pos: positions,
              sell: {
                disabled: sell.disabled,
                IV: _getIV(Convert.fromUSDC(sell.quote as BigNumber).toInt()),
                premiumTooSmall: sell.premiumTooSmall,
                quote: _getQuote(sell, true),
              },
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
      return data.reduce((chainData, currentExpiry) => {
        if (
          currentExpiry &&
          currentExpiry.callOptionDrill &&
          currentExpiry.putOptionDrill
        ) {
          const {
            callOptionDrill,
            expiration,
            putOptionDrill,
            underlyingPrice,
          } = currentExpiry;

          const expiry = expiration.toNumber();
          const ethPrice = Convert.fromWei(underlyingPrice).toInt();
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
        }

        return chainData;
      }, {} as ChainData);
    } else {
      return {};
    }
  } catch (error) {
    logError(error);

    return {};
  }
};
