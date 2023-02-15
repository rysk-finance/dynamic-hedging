import { readContract } from "@wagmi/core";
import MarginCollateralABI from "../../abis/opyn/NewMarginCalculator.json";
import { DECIMALS } from "../../config/constants";
import { getContractAddress } from "../../utils/helpers";

const useMarginRequirement = () => {
  // Addresses
  const marginCalculatorAddress = getContractAddress("OpynNewCalculator");
  const usdcAddress = getContractAddress("USDC");
  const wethAddress = getContractAddress("WETH");
  const strikeAsset = usdcAddress;
  const underlying = wethAddress;
  const collateral = usdcAddress;

  // Contract read
  const getMargin = async (
    amount: string,
    underlyingStrikePrice: string,
    underlyingCurrentPrice: string,
    expiryTimestamp: number,
    isPut: boolean
  ) => {
    return await readContract({
      address: marginCalculatorAddress,
      abi: MarginCollateralABI,
      functionName: "getNakedMarginRequired",
      args: [
        underlying,
        strikeAsset,
        collateral,
        amount,
        underlyingStrikePrice,
        underlyingCurrentPrice,
        expiryTimestamp,
        DECIMALS.USDC,
        isPut,
      ],
    });
  };

  // Interface
  return [
    getMargin, // retrieve margin requirement for selling option
  ];
};

export default useMarginRequirement;
