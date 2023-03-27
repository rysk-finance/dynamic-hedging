import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";

import { DECIMALS } from "../../config/constants";
import { getContractAddress } from "../../utils/helpers";
import { BigNumber } from "ethers";
import { useState } from "react";
import { useContractRead } from "wagmi";
import { MarginParams } from "./types";

/**
 * @author Yassine
 * @title Hook: Margin Requirement
 * @notice Retrieve margin requirement for selling option
 * @dev This is how the flow should be versus using readContract
 */
const useMarginRequirement = (): [
  BigNumber | undefined,
  (params: MarginParams) => void
] => {
  // Addresses
  const marginCalculatorAddress = getContractAddress("OpynNewCalculator");
  const usdcAddress = getContractAddress("USDC");
  const wethAddress = getContractAddress("WETH");
  const strikeAsset = usdcAddress;
  const underlying = wethAddress;
  const collateral = usdcAddress;

  // Internal state
  // note - parameters to be passed for naked margin function
  // TODO - while removing hardcoded amount maybe don't keep this as array
  const [marginParams, setMarginParams] = useState<MarginParams>({
    amount: BigNumber.from(0),
    underlyingStrikePrice: BigNumber.from(0),
    underlyingCurrentPrice: BigNumber.from(0),
    expiryTimestamp: BigNumber.from(0),
    isPut: true,
  });

  // Setters
  const updateMarginParams = (params: MarginParams) => {
    setMarginParams(params);
  };

  // Contract read
  const { data: margin } = useContractRead({
    address: marginCalculatorAddress,
    abi: NewMarginCalculatorABI,
    functionName: "getNakedMarginRequired",
    args: [
      underlying,
      strikeAsset,
      collateral,
      marginParams.amount,
      marginParams.underlyingStrikePrice,
      marginParams.underlyingCurrentPrice,
      marginParams.expiryTimestamp,
      BigNumber.from(DECIMALS.USDC),
      marginParams.isPut,
    ],
  });

  // Interface
  return [
    margin, // retrieve margin requirement for selling option
    updateMarginParams, // saves array of params to pass to margin function
  ];
};

export default useMarginRequirement;
