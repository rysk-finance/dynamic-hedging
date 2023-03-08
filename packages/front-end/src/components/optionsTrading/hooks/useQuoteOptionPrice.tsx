import { useContractRead } from "wagmi";
import { utils } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

import { BeyondPricerABI } from "../../../abis/BeyondPricer_ABI";
import { AlphaPortfolioValuesFeedABI } from "../../../abis/AlphaPortfolioValuesFeed_ABI";
import { getContractAddress } from "../../../utils/helpers";
import { toWei } from "../../../utils/conversion-helper";
import { SelectedOption } from "../../../state/types";
import { ZERO_ADDRESS } from "../../../config/constants";

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
}) => {
  // compute oHash for quoting on order size change
  const oHash =
    expiryDate &&
    selectedOption &&
    (utils.solidityKeccak256(
      ["uint64", "uint128", "bool"],
      [
        expiryDate,
        selectedOption.strikeOptions.strike,
        selectedOption.callOrPut === "put",
      ]
    ) as HexString);

  const { data: exposure } = useContractRead({
    abi: AlphaPortfolioValuesFeedABI,
    address: getContractAddress("portfolioValuesFeed"),
    functionName: "netDhvExposure",
    args: [oHash || ZERO_ADDRESS],
    enabled: Boolean(oHash),
  });

  const { data: quote } = useContractRead({
    address: getContractAddress("beyondPricer"),
    abi: BeyondPricerABI,
    functionName: "quoteOptionPrice",
    args: [
      {
        expiration: BigNumber.from(expiryDate || 0),
        strike: toWei(selectedOption?.strikeOptions.strike.toString() || "0"),
        strikeAsset: getContractAddress("USDC"),
        underlying: getContractAddress("WETH"),
        collateral: getContractAddress("USDC"),
        isPut: selectedOption?.callOrPut === "put",
      },
      toWei(orderSize?.toString() || "0"), // 1 for the table view but fetch if user wants to buy more
      selectedOption?.bidOrAsk === "bid",
      exposure || BigNumber.from(0),
    ],
    enabled:
      exposure?._isBigNumber &&
      Boolean(expiryDate && selectedOption && orderSize),
  });

  return [quote?.[0], quote?.[2]];
};
