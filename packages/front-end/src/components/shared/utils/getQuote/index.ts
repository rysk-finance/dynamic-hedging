import type { QuoteData, QuoteProps } from "./types";

import { readContracts } from "@wagmi/core";
import { BigNumber } from "ethers";

import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import { fromWeiToInt, tFormatUSDC, toWei } from "src/utils/conversion-helper";
import { getContractAddress, getOptionHash } from "src/utils/helpers";

export const getQuotes = async (
  quoteProps: QuoteProps[]
): Promise<QuoteData[]> => {
  const exposures = await readContracts({
    contracts: quoteProps.map(
      ({ expiry, strike, isPut }) =>
        ({
          abi: AlphaPortfolioValuesFeedABI,
          address: getContractAddress("portfolioValuesFeed"),
          functionName: "netDhvExposure",
          args: [getOptionHash(expiry, strike, isPut)],
        } as const)
    ),
  });

  const quotes = await readContracts({
    contracts: quoteProps.flatMap(
      ({ expiry, strike, collateral, isPut, isSell, orderSize }, index) => {
        const quoteOptionPriceContractDetails = {
          abi: BeyondPricerABI,
          address: getContractAddress("beyondPricer"),
          functionName: "quoteOptionPrice" as const,
        };

        const series = {
          expiration: BigNumber.from(expiry),
          strike,
          strikeAsset: getContractAddress("USDC"),
          underlying: getContractAddress("WETH"),
          collateral: getContractAddress(collateral || "USDC"),
          isPut,
        };

        return [
          {
            ...quoteOptionPriceContractDetails,
            args: [series, toWei("1"), isSell, exposures[index]],
          } as const,
          {
            ...quoteOptionPriceContractDetails,
            args: [
              series,
              toWei(orderSize.toString()),
              isSell,
              exposures[index],
            ],
          } as const,
        ];
      }
    ),
  });

  return quoteProps.map(({ isSell, orderSize, strike, isPut }, index) => {
    const forOne = quotes[index * 2];
    const forOrder = quotes[index * 2 + 1];

    if (forOne === null || forOrder === null) {
      return {
        acceptablePremium: BigNumber.from(0),
        breakEven: 0,
        fee: 0,
        premium: 0,
        quote: 0,
        slippage: 0,
      };
    }

    const fee = tFormatUSDC(forOne.totalFees);
    const premium = tFormatUSDC(forOne.totalPremium);
    const quoteForOne = tFormatUSDC(
      isSell
        ? forOne.totalPremium.sub(forOne.totalFees)
        : forOne.totalPremium.add(forOne.totalFees),
      4
    );
    const quote = tFormatUSDC(
      isSell
        ? forOrder.totalPremium.sub(forOrder.totalFees)
        : forOrder.totalPremium.add(forOrder.totalFees),
      4
    );
    const calc = (quote / orderSize / quoteForOne - 1) * 100;
    const slippage = isSell ? Math.min(0, calc) : Math.max(0, calc);
    const acceptablePremium = isSell
      ? forOrder.totalPremium.div(100).mul(97)
      : forOrder.totalPremium.div(100).mul(103);
    const breakEven = isPut
      ? fromWeiToInt(strike) - quote / orderSize
      : fromWeiToInt(strike) + quote / orderSize;

    return { acceptablePremium, breakEven, fee, premium, quote, slippage };
  });
};
