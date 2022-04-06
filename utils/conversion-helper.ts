import { BigNumber, BigNumberish, utils } from "ethers"
// import BigNumber from 'bignumber.js'

export const formatEth = (x: BigNumberish) => Number(utils.formatEther(x))
export function truncate(num: number, places: number = 3): number {
	return Math.trunc(num * Math.pow(10, places)) / Math.pow(10, places)
}
export const tFormatEth = (x: BigNumberish): number => truncate(formatEth(x))
export const toWei = (x: string) => utils.parseEther(x)
export const call = false,
	put = true
export const MAX_BPS = BigNumber.from(10000)
export const CALL = false
export const PUT = true
export const SECONDS_IN_DAY = 86400
export const SECONDS_IN_YEAR = SECONDS_IN_DAY * 365.25
export const genOptionTime = (now: moment.Moment, future: moment.Moment) =>
	(future.unix() - now.unix()) / SECONDS_IN_YEAR
export const fromWei = (x: BigNumberish) => utils.formatEther(x)
export const fromUSDC = (x: BigNumberish) => utils.formatUnits(x, 6)
export const tFormatUSDC = (x: BigNumberish) => truncate(Number(fromUSDC(x)))
export const fmtExpiration = (x: number) => toWei(x.toString())
export const toUSDC = (x: string) => utils.parseUnits(x, 6)
export const toOpyn = (x: string) => utils.parseUnits(x, 8)
export const toWeiFromUSDC = (x: string) => utils.parseUnits(x, 12)
export const fromWeiToUSDC = (x: string) => utils.parseUnits(utils.formatEther(x), 6)
export const fromOpyn = (x: BigNumberish) => utils.formatUnits(x, 8)
export const getDiffSeconds = (now: moment.Moment, future: moment.Moment) =>
	future.unix() - now.unix()
export const convertRounded = (x: BigNumberish): number => Math.round(Number(x.toString()))
export const scaleNum = (x: string, decimals: number) => utils.parseUnits(x, decimals)
export const genOptionTimeFromUnix = (now: number, future: number) =>
	(future - now) / SECONDS_IN_YEAR
export const sample = (x: any[]): any => x[Math.floor(Math.random() * x.length)]
export const percentDiff = (a: number, b: number): number => (a === b ? 0 : Math.abs(1 - a / b))
export const percentDiffArr = (a: (number | string)[], b: (number | string)[]): number => {
	const diffs = a.map((i: number | string, idx: number) => {
		let j = b[idx]
		return percentDiff(Number(i), Number(j))
	})
	const sum = diffs.reduce((a: number, b: number) => a + b, 0)
	return sum
}
export const createValidExpiry = (now: number, days: number) => {
	const multiplier = (now - 28800) / 86400
	return (Number(multiplier.toFixed(0)) + 1) * 86400 + days * 86400 + 28800
}
export type BlackScholesCalcArgs = [
	BigNumberish,
	BigNumberish,
	BigNumberish,
	BigNumberish,
	BigNumberish
]
const sum = function (array: [number]) {
	let total = 0
	for (let i = 0; i < array.length; i++) {
		total += array[i]
	}
	return total
}

export const mean = function (array: [number]) {
	let arraySum = sum(array)
	return arraySum / array.length
}

export const median = function (array: [number]) {
	array = array.sort()
	if (array.length % 2 === 0) {
		// array with even number elements
		return (array[array.length / 2] + array[array.length / 2 - 1]) / 2
	} else {
		return array[(array.length - 1) / 2] // array with odd number elements
	}
}
export const parseTokenAmount = (value: BigNumberish, decimals: number) =>
  BigNumber.from(value).mul(BigNumber.from(10).pow(BigNumber.from(decimals)));