import { BigNumberish, utils } from "ethers";

const formatEth = (x: BigNumberish = 0) => Number(utils.formatEther(x));
export function truncate(num: number, places: number = 3): number {
  return (
    Math.trunc(Math.round(num * Math.pow(10, places))) / Math.pow(10, places)
  );
}
export const tFormatEth = (x: BigNumberish, places: number = 3): number =>
  truncate(formatEth(x), places);
export const toWei = (x: string = "0") => utils.parseEther(x);
export const fromWei = (x: BigNumberish = 0) => utils.formatEther(x);
export const fromWeiToOpyn = (x: BigNumberish = 0) =>
  utils.parseUnits(utils.formatEther(x), 8);
export const fromWeiToInt = (x: BigNumberish = 0) =>
  Number(utils.formatEther(x));
export const fromUSDC = (x: BigNumberish = 0) => utils.formatUnits(x, 6);
export const tFormatUSDC = (x: BigNumberish, places: number = 3) =>
  truncate(Number(fromUSDC(x)), places);
export const toUSDC = (x: string = "0") => utils.parseUnits(x, 6);
export const toOpyn = (x: string = "0") => utils.parseUnits(x, 8);
