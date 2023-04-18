import { readContract, readContracts } from "@wagmi/core";

import { BigNumber } from "ethers";

import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import { getContractAddress, getOptionHash } from "src/utils/helpers";
import { tFormatUSDC, toWei } from "src/utils/conversion-helper";

export const getQuote = async (
  expiry: number,
  strike: BigNumber,
  isPut: boolean,
  orderSize: number,
  isSell: boolean,
  collateral: "USDC" | "WETH" = "USDC"
) => {
  const exposure = await readContract({
    abi: AlphaPortfolioValuesFeedABI,
    address: getContractAddress("portfolioValuesFeed"),
    functionName: "netDhvExposure",
    args: [getOptionHash(expiry, strike, isPut)],
  });

  const contractDetails = {
    abi: BeyondPricerABI,
    address: getContractAddress("beyondPricer"),
    functionName: "quoteOptionPrice" as const,
  };
  const series = {
    expiration: BigNumber.from(expiry),
    strike,
    strikeAsset: getContractAddress("USDC"),
    underlying: getContractAddress("WETH"),
    collateral: getContractAddress(collateral),
    isPut,
  };

  const [forOne, forOrder] = await readContracts({
    contracts: [
      {
        ...contractDetails,
        args: [series, toWei("1"), isSell, exposure],
      },
      {
        ...contractDetails,
        args: [series, toWei(orderSize.toString()), isSell, exposure],
      },
    ],
  });

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

  return { acceptablePremium, fee, premium, quote, slippage };
};
