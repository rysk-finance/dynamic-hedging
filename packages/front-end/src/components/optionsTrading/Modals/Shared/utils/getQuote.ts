import { readContract } from "@wagmi/core";

import { BigNumber } from "ethers";
import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import { getContractAddress, getOptionHash } from "src/utils/helpers";

export const getQuote = async (
  expiry: number,
  strike: BigNumber,
  isPut: boolean,
  orderSize: BigNumber,
  isSell: boolean
) => {
  const exposure = await readContract({
    abi: AlphaPortfolioValuesFeedABI,
    address: getContractAddress("portfolioValuesFeed"),
    functionName: "netDhvExposure",
    args: [getOptionHash(expiry, strike, isPut)],
  });

  return await readContract({
    abi: BeyondPricerABI,
    address: getContractAddress("beyondPricer"),
    functionName: "quoteOptionPrice",
    args: [
      {
        expiration: BigNumber.from(expiry),
        strike,
        strikeAsset: getContractAddress("USDC"),
        underlying: getContractAddress("WETH"),
        collateral: getContractAddress("USDC"),
        isPut,
      },
      orderSize,
      isSell,
      exposure,
    ],
  });
};
