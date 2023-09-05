import { BigNumberish, utils } from "ethers";

export function truncate(num: number, places: number = 3): number {
  return (
    Math.trunc(Math.round(num * Math.pow(10, places))) / Math.pow(10, places)
  );
}

export const fromWeiToOpyn = (x: BigNumberish = 0) =>
  utils.parseUnits(utils.formatEther(x), 8);
