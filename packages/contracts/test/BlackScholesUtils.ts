import { toWei } from "../utils/conversion-helper"

const toStandardLPParam = (x: { toString: () => string }) => toWei(x.toString())
const identity = (x: any) => x
const bsParamsMap = [
	toStandardLPParam,
	toStandardLPParam,
	identity,
	toStandardLPParam,
	toStandardLPParam
]
export const bsParamsApply = (x: any, i: number) => bsParamsMap[i](x)
