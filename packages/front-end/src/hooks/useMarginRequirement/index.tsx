import { getNetwork, readContract } from "@wagmi/core";
import addresses from "../../contracts.json";
import { ETHNetwork } from "../../types";
import MarginCollateralABI from "../../abis/opyn/NewMarginCalculator.json";
import { DECIMALS } from "../../config/constants";

const useMarginRequirement = () => {
  // Global state
  // TODO: this is repetitive code
  const { chain } = getNetwork();
  const network = chain?.network as ETHNetwork;

  const marginCalculatorAddress = addresses[network].OpynNewCalculator;

  const strikeAsset = addresses[network].USDC;
  const underlying = addresses[network].WETH;
  const collateral = addresses[network].USDC;

  // Contract read
  const getMargin = async (
    amount: string,
    underlyingStrikePrice: string,
    underlyingCurrentPrice: string,
    expiryTimestamp: string,
    isPut: boolean
  ) => {
    return await readContract({
      address: marginCalculatorAddress as `0x${string}`, // TODO update after rebasing Tim's branch
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
