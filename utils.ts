import { BigNumberish, utils, BigNumber } from "ethers";

export const formatEth = (x: BigNumberish) => Number(utils.formatEther(x));
export function truncate (num: number, places: number = 3): number {
    return Math.trunc(num * Math.pow(10, places)) / Math.pow(10, places);
}
export const tFormatEth = (x: BigNumberish): number => truncate(formatEth(x));
export const toWei = (x: string) => utils.parseEther(x);
export const call = 0, put = 1;
export const CALL = BigNumber.from(call);
export const PUT = BigNumber.from(put);
export const SECONDS_IN_DAY = 86400;
export const SECONDS_IN_YEAR = SECONDS_IN_DAY * 365.25;
export const genOptionTime = (now: moment.Moment, future: moment.Moment) => (future.unix() - now.unix()) / SECONDS_IN_YEAR;
export const fromWei = (x: BigNumberish) => utils.formatEther(x);
export const getDiffSeconds = (now: moment.Moment, future: moment.Moment) => (future.unix() - now.unix());
export const convertRounded = (x: BigNumberish): number => Math.round(Number(x.toString()));

export const genOptionTimeFromUnix = (now: number, future: number) => (future - now) / SECONDS_IN_YEAR;
export const sample = (x: any[]): any => x[Math.floor(Math.random() * x.length)];
export const percentDiff = (a: number, b: number): number => a === b ? 0 : Math.abs(1 - a / b);
export const percentDiffArr = (a: (number|string)[], b: (number|string)[]): number => {
    const diffs = a.map((i: number|string, idx: number) => {
        let j = b[idx]
        return percentDiff(Number(i), Number(j))
    })
    const sum = diffs.reduce((a: number, b: number) => a + b, 0)
    return sum
}
export type BlackScholesCalcArgs = [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];