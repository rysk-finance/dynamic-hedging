import { ethers } from "hardhat"
import {
	toWei,
	truncate,
	tFormatEth,
	CALL,
	PUT,
	genOptionTime,
	sample,
	median,
	percentDiff,
	BlackScholesCalcArgs
} from "../utils/conversion-helper"
import moment from "moment"
//@ts-ignore
import bs from "black-scholes"
//@ts-ignore
import greeks from "greeks"
import { expect } from "chai"
import { BlackScholes as IBlackScholes } from "../types/BlackScholes"
import { BlackScholesTest as IBlackScholesTest } from "../types/BlackScholesTest"

describe("Pricing options", function () {
	let BlackScholes: IBlackScholes
	let BlackScholesTest: IBlackScholesTest

	it("Should deploy Black Scholes library", async function () {
		const normDistFactory = await ethers.getContractFactory("NormalDist", {
			libraries: {}
		})
		const normDist = await normDistFactory.deploy()
		const bsFactory = await ethers.getContractFactory("BlackScholes", {
			libraries: {
				NormalDist: normDist.address
			}
		})
		const blackScholes = (await bsFactory.deploy()) as IBlackScholes
		BlackScholes = blackScholes
		const bsTestFactory = await ethers.getContractFactory("BlackScholesTest", {
			libraries: {
				BlackScholes: BlackScholes.address
			}
		})
		BlackScholesTest = (await bsTestFactory.deploy()) as IBlackScholesTest
	})

	it("correctly prices in the money call with a one year time to expiration", async function () {
		const strike = 250
		const price = 300
		const now: moment.Moment = moment()
		const oneYear = moment(now).add(12, "M")
		const time = genOptionTime(now, oneYear)
		const vol = 0.15
		const rfr = 0.03
		const localBS = bs.blackScholes(300, 250, time, 0.15, 0.03, "call")
		const args = [price, strike, oneYear.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, CALL)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly  prices out of the money call with one year time", async () => {
		const strike = 350
		const price = 300
		const now: moment.Moment = moment()
		const oneYear = moment(now).add(12, "M")
		const time = genOptionTime(now, oneYear)
		const vol = 0.15
		const rfr = 0.03
		const localBS = bs.blackScholes(300, 350, time, 0.15, 0.03, "call")
		const args = [price, strike, oneYear.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, CALL)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices out of the money call with one year time high volatility", async () => {
		const strike = 350
		const price = 300
		const now: moment.Moment = moment()
		const oneYear = moment(now).add(12, "M")
		const time = genOptionTime(now, oneYear)
		const vol = 1.5
		const rfr = 0.03
		const localBS = bs.blackScholes(300, 350, time, 1.5, 0.03, "call")
		const args = [price, strike, oneYear.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, CALL)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices in the money call with one month expiration high volatility", async () => {
		const strike = 250
		const price = 300
		const now: moment.Moment = moment()
		const oneYear = moment(now).add(12, "M")
		const time = genOptionTime(now, oneYear)
		const vol = 1.5
		const rfr = 0.03
		const localBS = bs.blackScholes(300, 250, time, 1.5, 0.03, "call")
		const args = [price, strike, oneYear.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, CALL)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices in the money put with one year time", async () => {
		const strike = 250
		const price = 200
		const now: moment.Moment = moment()
		const oneYear = moment(now).add(12, "M")
		const time = genOptionTime(now, oneYear)
		const vol = 0.15
		const rfr = 0.03
		const localBS = bs.blackScholes(200, 250, time, 0.15, 0.03, "put")
		const args = [price, strike, oneYear.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, PUT)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices in the money put with one year time high volatility", async () => {
		const strike = 250
		const price = 200
		const now: moment.Moment = moment()
		const oneYear = moment(now).add(12, "M")
		const time = genOptionTime(now, oneYear)
		const vol = 1.5
		const rfr = 0.03
		const localBS = bs.blackScholes(200, 250, time, 1.5, 0.03, "put")
		const args = [price, strike, oneYear.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, PUT)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices in the money put with one month time high volatility", async () => {
		const strike = 250
		const price = 200
		const now: moment.Moment = moment()
		const future = moment(now).add(1, "M")
		const time = genOptionTime(now, future)
		const vol = 1.5
		const rfr = 0.03
		const localBS = bs.blackScholes(200, 250, time, 1.5, 0.03, "put")
		const args = [price, strike, future.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, PUT)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices in the money put with one month time high volatility", async () => {
		const strike = 250
		const price = 200
		const now: moment.Moment = moment()
		const future = moment(now).add(1, "M")
		const time = genOptionTime(now, future)
		const vol = 1.5
		const rfr = 0.03
		const localBS = bs.blackScholes(200, 250, time, 1.5, 0.03, "put")
		const args = [price, strike, future.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, PUT)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices at the money put with one month time high volatility", async () => {
		const strike = 200
		const price = 200
		const now: moment.Moment = moment()
		const future = moment(now).add(1, "M")
		const time = genOptionTime(now, future)
		const vol = 1.5
		const rfr = 0.03
		const localBS = bs.blackScholes(200, 200, time, 1.5, 0.03, "put")
		const args = [price, strike, future.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, PUT)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices near the money put with one month time high volatility", async () => {
		const strike = 190
		const price = 200
		const now: moment.Moment = moment()
		const future = moment(now).add(1, "M")
		const time = genOptionTime(now, future)
		const vol = 1.5
		const rfr = 0.03
		const localBS = bs.blackScholes(200, 190, time, 1.5, 0.03, "put")
		const args = [price, strike, future.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, PUT)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices out of the money put with one month time high volatility", async () => {
		const strike = 150
		const price = 200
		const now: moment.Moment = moment()
		const future = moment(now).add(1, "M")
		const time = genOptionTime(now, future)
		const vol = 1.5
		const rfr = 0.03
		const localBS = bs.blackScholes(200, 150, time, 1.5, 0.03, "put")
		const args = [price, strike, future.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, PUT)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly prices out of the money put with one month time", async () => {
		const strike = 150
		const price = 200
		const now: moment.Moment = moment()
		const future = moment(now).add(1, "M")
		const time = genOptionTime(now, future)
		const vol = 0.15
		const rfr = 0.03
		const localBS = bs.blackScholes(200, 150, time, 0.15, 0.03, "put")
		const args = [price, strike, future.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractBS = await BlackScholesTest.retBlackScholesCalc(...args, PUT)
		expect(truncate(localBS)).to.eq(tFormatEth(contractBS))
	})

	it("correctly computes delta of out of the money call with one month time", async () => {
		const strike = 220
		const price = 200
		const now: moment.Moment = moment()
		const future = moment(now).add(1, "M")
		const time = genOptionTime(now, future)
		const vol = 0.15
		const rfr = 0.03
		const localDelta = greeks.getDelta(200, 220, time, 0.15, 0.03, "call")
		const args = [price, strike, future.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractDelta = await BlackScholesTest.getDelta(...args, CALL)
		expect(tFormatEth(contractDelta)).to.eq(truncate(localDelta))
	})

	it("correctly computes delta of out of the money put with one month time", async () => {
		const strike = 190
		const price = 200
		const now: moment.Moment = moment()
		const future = moment(now).add(1, "M")
		const time = genOptionTime(now, future)
		const vol = 0.15
		const rfr = 0.03
		const localDelta = greeks.getDelta(200, 190, time, 0.15, 0.03, "put")
		const args = [price, strike, future.unix(), vol, rfr].map((x, index) => {
			return index === 2 ? x : toWei(x.toString())
		}) as BlackScholesCalcArgs
		const contractDelta = await BlackScholesTest.getDelta(...args, PUT)
		expect(tFormatEth(contractDelta)).to.eq(truncate(localDelta))
	})

	it("Estimated portfolio deltas should deviate by more than 10% compared with cached values at scale", async () => {
		// This test is to confirm that used cached values can not be relied upon to accurately compute portfolio delta
		let iterations = 10000
		const now: moment.Moment = moment()
		const priceRange = Array.from({ length: 200 }, (_, i) => i + 100)
		const amountRange = Array.from({ length: 200 }, (_, i) => i + 1)
		const timeRange = Array.from({ length: 365 }, (_, i) => (i + 1) / 365)
		const volRange = Array.from({ length: 150 }, (_, i) => (i + 1) / 100)
		function randomOption() {
			const optType = sample(["call", "put"])
			const opt = {
				price: sample(priceRange),
				strike: sample(priceRange),
				time: sample(timeRange),
				vol: sample(volRange),
				optType,
				amount: sample(amountRange)
			}
			return opt
		}
		let totalAmountCall = 0
		let totalAmountPut = 0
		let weightedStrikeCall = 0
		let weightedTimeCall = 0
		let weightedVolCall = 0
		let weightedStrikePut = 0
		let weightedTimePut = 0
		let weightedVolPut = 0

		const options = []
		for (let i = 0; i <= iterations; i++) {
			const opt = randomOption()
			options.push(opt)
			if (opt.optType == "call") {
				totalAmountCall += opt.amount
				const weight = opt.amount / totalAmountCall
				const exWeight = 1 - weight
				weightedStrikeCall = exWeight * weightedStrikeCall + weight * opt.strike
				weightedTimeCall = exWeight * weightedTimeCall + weight * opt.time
				weightedVolCall = exWeight * weightedVolCall + weight * opt.vol
			} else {
				totalAmountPut += opt.amount
				const weight = opt.amount / totalAmountPut
				const exWeight = 1 - weight
				weightedStrikePut = exWeight * weightedStrikePut + weight * opt.strike
				weightedTimePut = exWeight * weightedTimePut + weight * opt.time
				weightedVolPut = exWeight * weightedVolPut + weight * opt.vol
			}
		}
		const currentPrice = 150
		const rfr = 0.01
		const traditionalCallDelta = options
			.filter(o => o.optType == "call")
			.map(option => {
				const future = moment(now).add(option.time, "M")
				const time = genOptionTime(now, future)
				const delta = greeks.getDelta(
					currentPrice,
					option.strike,
					time,
					option.vol,
					rfr,
					option.optType
				)
				return option.amount * delta
			})
			.reduce((a, b) => a + b)
		const traditionalPutDelta = options
			.filter(o => o.optType == "put")
			.map(option => {
				const future = moment(now).add(option.time, "M")
				const time = genOptionTime(now, future)
				const delta = greeks.getDelta(
					currentPrice,
					option.strike,
					time,
					option.vol,
					rfr,
					option.optType
				)
				return option.amount * delta
			})
			.reduce((a, b) => a + b)
		const future = moment(now).add(weightedTimeCall, "M")
		const time = genOptionTime(now, future)
		const futurePut = moment(now).add(weightedTimePut, "M")
		const timePut = genOptionTime(now, futurePut)
		const callDelta = greeks.getDelta(
			currentPrice,
			weightedStrikeCall,
			time,
			weightedVolCall,
			rfr,
			"call"
		)
		const netCallDelta = callDelta * totalAmountCall
		const putDelta = greeks.getDelta(
			currentPrice,
			weightedStrikePut,
			timePut,
			weightedVolPut,
			rfr,
			"put"
		)
		const netPutDelta = putDelta * totalAmountPut
		const callDiff = percentDiff(netCallDelta, traditionalCallDelta)
		const putDiff = percentDiff(netPutDelta, traditionalPutDelta)
		expect(callDiff).to.be.greaterThan(0.1)
		expect(putDiff).to.be.greaterThan(0.1)
	})
})
