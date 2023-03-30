import { BigNumber } from "@ethersproject/bignumber";
import { useContractRead } from "wagmi";

import { AlphaPortfolioValuesFeedABI } from "../../../abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "../../../abis/BeyondPricer_ABI";
import { SelectedOption } from "../../../state/types";
import { toRysk, toWei } from "../../../utils/conversion-helper";
import { getContractAddress, getOptionHash } from "../../../utils/helpers";

/**
 * @author Yassine
 * @title Hook: Quote Option Price
 * @notice Quote an option price based on order size
 * @dev There is falsey value checks due to WAGMI not using the enabled flag properly
 */
export const useQuoteOptionPrice = ({
  expiryDate,
  selectedOption,
  orderSize,
}: {
  selectedOption: SelectedOption | null;
  expiryDate: number | null;
  orderSize: string;
}): [BigNumber | null, BigNumber | null, boolean, Error | null] => {
  // compute oHash for quoting on order size change
  const oHash =
    expiryDate && selectedOption
      ? getOptionHash(
          expiryDate,
          toRysk(selectedOption.strikeOptions.strike.toString()),
          selectedOption.callOrPut === "put"
        )
      : "0x";

  const { data: exposure } = useContractRead({
    abi: AlphaPortfolioValuesFeedABI,
    address: getContractAddress("portfolioValuesFeed"),
    functionName: "netDhvExposure",
    args: [oHash],
    enabled: oHash !== "0x",
  });

  const {
    data: quote,
    isLoading,
    error,
  } = useContractRead({
    address: getContractAddress("beyondPricer"),
    abi: BeyondPricerABI,
    functionName: "quoteOptionPrice",
    args: [
      {
        expiration: BigNumber.from(expiryDate || 0),
        strike: toRysk(selectedOption?.strikeOptions.strike.toString() || "0"),
        strikeAsset: getContractAddress("USDC"),
        underlying: getContractAddress("WETH"),
        collateral: getContractAddress("USDC"),
        isPut: selectedOption?.callOrPut === "put",
      },
      toWei(orderSize?.toString() || "0"), // 1 for the table view but fetch if user wants to buy more
      selectedOption?.buyOrSell === "sell",
      exposure || BigNumber.from(0),
    ],
    enabled:
      exposure?._isBigNumber &&
      Boolean(expiryDate && selectedOption && orderSize),
  });

  return [
    quote?.totalPremium || null,
    quote?.totalFees || null,
    isLoading,
    error,
  ];
};
