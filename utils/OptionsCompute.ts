import { BigNumber } from "ethers"
import { toWei } from "./conversion-helper"

const zero: BigNumber = BigNumber.from(0)
const one: BigNumber = toWei("1")
export function computeNewWeights(
	amount: BigNumber,
	strike: BigNumber,
	expiration: BigNumber,
	totalAmount: BigNumber,
	weightedStrike: BigNumber,
	weightedTime: BigNumber
) {
	let weight: BigNumber = one
	if (totalAmount.gt(zero)) {
		weight = amount.div(totalAmount)
	}
	const exWeight = one.sub(weight)
	const newTotalAmount = totalAmount.add(amount)
	const newWeightedStrike = exWeight.mul(weightedStrike).add(weight.mul(strike)).div(one)
	const newWeightedTime = exWeight.mul(weightedTime).add(weight.mul(expiration)).div(one)
	return { newWeightedTime, newWeightedStrike, newTotalAmount }
}
