import { BigNumber } from "ethers";

export interface MarginParams {
  amount: BigNumber;
  underlyingStrikePrice: BigNumber;
  underlyingCurrentPrice: BigNumber;
  expiryTimestamp: BigNumber;
  isPut: boolean;
}
