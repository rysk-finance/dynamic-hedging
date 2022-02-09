import { ethers } from "hardhat"
import { BigNumberish, Contract, ContractFactory, utils, Signer, BigNumber } from "ethers"
import { MockProvider } from "@ethereum-waffle/provider"
import {
	toWei,
	truncate,
	tFormatEth,
	call,
	put,
	genOptionTimeFromUnix,
	fromWei,
	getDiffSeconds,
	convertRounded,
	percentDiffArr,
	percentDiff
} from "../utils"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import moment from "moment"
//@ts-ignore
import bs from "black-scholes"
import { expect } from "chai"
import OptionToken from "../artifacts/contracts/tokens/OptionToken.sol/OptionToken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { AggregatorV3Interface as IAggregatorV3 } from "../types/AggregatorV3Interface"
import { ERC20 } from "../types/ERC20"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { Exchange } from "../types/Exchange"
import { OptionToken as IOptionToken } from "../types/OptionToken"
import { UniswapV2Factory } from "../types/UniswapV2Factory"
import { UniswapV2Router02 } from "../types/UniswapV2Router02"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPools } from "../types/LiquidityPools"
import { LiquidityPool } from "../types/LiquidityPool"
import { Volatility } from "../types/Volatility"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import { convertDoubleToDec } from "../utils/math"

const IMPLIED_VOL = "60"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
let expiration = moment().add(3, "weeks")
const strike = toWei("300")

let dai: MintableERC20
let currentTime: moment.Moment
let optionRegistry: OptionRegistry
let optionToken: IOptionToken
let putOption: IOptionToken
let erc20PutOption: IOptionToken
let erc20CallOption: IOptionToken
let optionProtocol: Protocol
let erc20CallExpiration: moment.Moment
let putOptionExpiration: moment.Moment
let erc20PutOptionExpiration: moment.Moment
let erc20Token: MintableERC20
let signers: Signer[]
let volatility: Volatility
let senderAddress: string
let receiverAddress: string

describe("Options protocol", function () {
	it("Deploys the Option Registry", async () => {
		signers = await ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		const erc20 = await ethers.getContractFactory("MintableERC20")
		const erc20Contract: MintableERC20 = (await erc20.deploy("DAI", "DAI")) as MintableERC20
		const constantsFactory = await ethers.getContractFactory("Constants")
		const constants = await constantsFactory.deploy()
		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
			libraries: {
				Constants: constants.address
			}
		})
		dai = erc20Contract
		const _optionRegistry = (await optionRegistryFactory.deploy(dai.address)) as OptionRegistry
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")
	})

	it("Creates an option token series", async () => {
		const [sender] = signers
		let optionTokenEvent = new Promise((resolve, reject) => {
			optionRegistry.on("OptionTokenCreated", (address, event) => {
				event.removeListener()

				resolve({
					address: address
				})
			})

			setTimeout(() => {
				reject(new Error("timeout"))
			}, 60000)
		})
		const issue = optionRegistry.issue(ZERO_ADDRESS, ZERO_ADDRESS, expiration.unix(), call, strike)
		let event: any = await optionTokenEvent
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		optionToken = new Contract(event.address, OptionToken.abi, sender) as IOptionToken
	})

	it("opens option token with ETH", async () => {
		const value = toWei("2")
		await optionRegistry.open(optionToken.address, value, { value })
		const balance = await optionToken.balanceOf(senderAddress)
		expect(balance).to.equal(value)
	})

	it("writer transfers part of balance to new account", async () => {
		const sender1Address = receiverAddress
		const transferAmount = toWei("1")
		await optionToken.transfer(sender1Address, transferAmount)
		const balance = await optionToken.balanceOf(sender1Address)
		expect(balance).to.equal(transferAmount)
	})

	it("receiver attempts to close and transaction should revert", async () => {
		const [sender, receiver] = signers
		const optionRegistryReceiver = optionRegistry.connect(receiver)
		await expect(optionRegistryReceiver.close(optionToken.address, toWei("1"))).to.be.revertedWith(
			"Caller did not write sufficient amount"
		)
	})

	it("should not allow anyone outside registry to mint options tokens", async () => {
		await expect(optionToken.mint(receiverAddress, toWei("1000"))).to.be.reverted
	})

	it("receiver exercises call option", async () => {
		const [sender, receiver] = signers
		const daiReceiver = dai.connect(receiver)
		const optionRegistryReceiver = optionRegistry.connect(receiver)
		await dai.mint(receiverAddress, toWei("1000"))
		const series = await optionRegistry.seriesInfo(optionToken.address)
		const { expiration, strike } = series
		await daiReceiver.approve(optionRegistry.address, toWei("1000"))
		const ethBalanceReceiver = await receiver.getBalance()
		await optionRegistryReceiver.exercise(optionToken.address, toWei("1"))
		const newBalance = await optionToken.balanceOf(receiverAddress)
		const newBalanceUSD = await dai.balanceOf(receiverAddress)
		const newEthBalanceReceiver = await receiver.getBalance()
		expect(newBalance).to.equal(0)
		expect(newBalanceUSD).to.equal(toWei("700"))
		expect(newEthBalanceReceiver.sub(ethBalanceReceiver)).to.lte(toWei("1")).to.gte(toWei("0.98"))
	})

	it("writer closes not transfered balance on option token", async () => {
		await optionRegistry.close(optionToken.address, toWei("1"))
		const balance = await optionToken.balanceOf(senderAddress)
		expect(balance).to.equal("0")
	})

	it("writer redeems and receives monies owed from exercises", async () => {
		const balanceUSD = await dai.balanceOf(senderAddress)
		expect(balanceUSD).to.equal("0")
		const now = moment()
		const future = moment(now).add(13, "M")
		const time = Number(getDiffSeconds(now, future))
		await ethers.provider.send("evm_increaseTime", [time])
		await optionRegistry.redeem(optionToken.address)
		const newBalanceUSD = await dai.balanceOf(senderAddress)
		expect(newBalanceUSD).to.equal(toWei("300"))
	})

	it("creates an ERC20 call option token series", async () => {
		const [sender] = signers
		let optionTokenEvent = new Promise((resolve, reject) => {
			optionRegistry.on("OptionTokenCreated", (address, event) => {
				event.removeListener()

				resolve({
					address: address
				})
			})

			setTimeout(() => {
				reject(new Error("timeout"))
			}, 60000)
		})
		const now = moment()
		const future = moment(now).add(14, "M")
		erc20CallExpiration = future
		const erc20 = await ethers.getContractFactory("MintableERC20")
		const erc20Contract: MintableERC20 = (await erc20.deploy("genericERC", "GRC")) as MintableERC20
		erc20Token = erc20Contract
		await erc20Token.mint(senderAddress, toWei("1000"))
		const issue = optionRegistry.issue(erc20Token.address, dai.address, future.unix(), call, strike)
		let event: any = await optionTokenEvent
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		erc20CallOption = new Contract(event.address, OptionToken.abi, sender) as IOptionToken
	})

	it("opens an ERC20 call option", async () => {
		await erc20Token.approve(optionRegistry.address, toWei("2"))
		await optionRegistry.open(erc20CallOption.address, toWei("2"))
		const balance = await erc20CallOption.balanceOf(senderAddress)
		expect(balance).to.be.equal(toWei("2"))
	})

	it("writer transfers part of erc20 call balance to new account", async () => {
		const [sender, receiver] = signers
		await erc20CallOption.transfer(receiverAddress, toWei("1"))
		const balance = await erc20CallOption.balanceOf(receiverAddress)
		expect(balance).to.be.equal(toWei("1"))
	})

	it("new account exercises erc20 call option", async () => {
		const [sender, receiver] = signers
		const daiReceiver = dai.connect(receiver)
		await daiReceiver.mint(receiverAddress, toWei("1000"))
		const optionRegistryReceiver = optionRegistry.connect(receiver)
		const usdBalance = await dai.balanceOf(receiverAddress)
		const series = await optionRegistry.seriesInfo(erc20CallOption.address)
		const { strike } = series
		const balance = await erc20CallOption.balanceOf(receiverAddress)
		const exerciseAmount = balance.div(toWei("1")).mul(strike)
		await daiReceiver.approve(erc20CallOption.address, exerciseAmount)
		await optionRegistryReceiver.exercise(erc20CallOption.address, balance)
		const newBalance = await erc20CallOption.balanceOf(receiverAddress)
		const newUsdBalance = await dai.balanceOf(receiverAddress)
		const newBalanceToken = await erc20Token.balanceOf(receiverAddress)
		expect(newBalance).to.equal("0")
		expect(usdBalance.sub(exerciseAmount)).to.equal(newUsdBalance)
		expect(newBalanceToken).to.equal(toWei("1"))
	})

	it("writer closes not transfered balance on ERC20 call option", async () => {
		const [sender] = signers
		await optionRegistry.close(erc20CallOption.address, toWei("1"))
		const balance = await optionToken.balanceOf(senderAddress)
		expect(balance).to.equal("0")
	})

	it("writer redeems and receives monies owed from ERC20 call exercises", async () => {
		const [sender] = signers
		const future = moment(erc20CallExpiration).add(1, "M")
		const time = getDiffSeconds(moment(), future)
		await ethers.provider.send("evm_increaseTime", [time])
		currentTime = future
		let optionTokenEvent = new Promise((resolve, reject) => {
			optionRegistry.on("SeriesRedeemed", (series, underlyingAmount, strikeAmount, event) => {
				event.removeListener()

				resolve({
					series,
					underlyingAmount,
					strikeAmount
				})
			})

			setTimeout(() => {
				reject(new Error("timeout"))
			}, 60000)
		})
		await optionRegistry.redeem(erc20CallOption.address)
		const newBalance = await dai.balanceOf(senderAddress)
		let event: any = await optionTokenEvent
		const { underlyingAmount, strikeAmount } = event
		expect(underlyingAmount).to.eq("0")
		expect(strikeAmount).to.eq(toWei("300"))
		expect(newBalance).to.eq(toWei("600"))
	})

	it("creates a put option token series", async () => {
		const [sender] = signers
		let expiration = currentTime.add(24, "M")
		putOptionExpiration = expiration
		let issue = optionRegistry.issue(ZERO_ADDRESS, ZERO_ADDRESS, expiration.unix(), put, strike)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		let receipt = await (await issue).wait(1)
		let events = receipt.events
		//@ts-ignore
		const address = events[1]["args"][0]
		putOption = new Contract(address, OptionToken.abi, sender) as IOptionToken
	})

	it("opens put option token position with ETH", async () => {
		const [sender] = signers
		const amount = 2 * 300
		await dai.approve(optionRegistry.address, toWei(amount.toString()))
		await optionRegistry.open(putOption.address, toWei("2"))
		const balance = await putOption.balanceOf(senderAddress)
		expect(balance).to.be.equal(toWei("2"))
	})

	it("writer transfers part of put balance to new account", async () => {
		const [sender, receiver] = signers
		await putOption.transfer(receiverAddress, toWei("1"))
		const balance = await putOption.balanceOf(receiverAddress)
		expect(balance).to.eq(toWei("1"))
	})

	it("new account exercises put option", async () => {
		const [sender, receiver] = signers
		const optionRegistryReceiver = optionRegistry.connect(receiver)
		await dai.mint(receiverAddress, toWei("1000"))
		const originalBalanceUSD = await dai.balanceOf(receiverAddress)
		const series = await optionRegistry.seriesInfo(putOption.address)
		const { strike } = series
		const balance = await putOption.balanceOf(receiverAddress)
		const ethBalance = await receiver.getBalance()
		const exerciseAmount = balance.div(toWei("1")).mul(strike)
		await optionRegistryReceiver.exercise(putOption.address, balance, {
			value: toWei("1")
		})
		const newBalance = await putOption.balanceOf(receiverAddress)
		const newBalanceUSD = await dai.balanceOf(receiverAddress)
		const newBalanceEth = await receiver.getBalance()
		const expectedUSDBalance = originalBalanceUSD.add(exerciseAmount)
		expect(newBalance).to.eq("0")
		expect(newBalanceUSD).to.eq(expectedUSDBalance)
		const diff = ethBalance.sub(newBalanceEth)
		expect(diff)
			.to.gte(toWei("1"))
			.lt(diff.add(toWei("1")))
	})

	it("writer closes not transfered balance on put option token", async () => {
		await optionRegistry.close(putOption.address, toWei("1"))
		const balance = await putOption.balanceOf(senderAddress)
		expect(balance).to.eq("0")
	})

	it("creates an ERC20 put option token series", async () => {
		const [sender] = signers
		const now = currentTime
		const future = moment(now).add(14, "M")
		erc20PutOptionExpiration = future
		const issue = await optionRegistry.issue(
			erc20Token.address,
			dai.address,
			future.unix(),
			put,
			strike
		)
		let receipt = await issue.wait(1)
		let events = receipt.events
		//@ts-ignore
		const optionTokenCreated = events[1]
		//@ts-ignore
		const address = optionTokenCreated["args"][0]
		expect(optionTokenCreated.event).to.eq("OptionTokenCreated")
		erc20PutOption = new Contract(address, OptionToken.abi, sender) as IOptionToken
	})

	it("opens an ERC20 put option", async () => {
		// amount * strike
		await dai.mint(senderAddress, toWei("1000"))
		await dai.approve(optionRegistry.address, toWei("1000"))
		await optionRegistry.open(erc20PutOption.address, toWei("2"))
		const balance = await erc20PutOption.balanceOf(senderAddress)
		expect(balance).to.eq(toWei("2"))
	})

	it("writer transfers part of erc20 put balance to new account", async () => {
		await erc20PutOption.transfer(receiverAddress, toWei("1"))
		const balance = await erc20PutOption.balanceOf(receiverAddress)
		expect(balance).to.eq(toWei("1"))
	})

	it("new account exercises erc20 put option", async () => {
		const [sender, receiver] = signers
		const balance = await erc20PutOption.balanceOf(receiverAddress)
		const strikeBalance = await dai.balanceOf(receiverAddress)
		const series = await optionRegistry.seriesInfo(erc20PutOption.address)
		const { strike } = series
		const erc20TokenReceiver = erc20Token.connect(receiver)
		const optionRegistryReceiver = optionRegistry.connect(receiver)
		await erc20TokenReceiver.approve(optionRegistry.address, balance)
		await optionRegistryReceiver.exercise(erc20PutOption.address, balance)
		const newBalance = await erc20PutOption.balanceOf(receiverAddress)
		const newStrikeBalance = await dai.balanceOf(receiverAddress)
		expect(newBalance).to.eq("0")
		const newUnderlyingBalance = await erc20Token.balanceOf(receiverAddress)
		expect(newUnderlyingBalance).to.eq("0")
		expect(newStrikeBalance.sub(strikeBalance)).to.eq(balance.div(toWei("1")).mul(strike))
	})

	it("writer closes not transfered balance on erc20 put option", async () => {
		const series = await optionRegistry.seriesInfo(erc20PutOption.address)
		const { strike } = series
		const balanceUSD = await dai.balanceOf(receiverAddress)
		await optionRegistry.close(erc20PutOption.address, toWei("1"))
		const balance = await erc20PutOption.balanceOf(receiverAddress)
		const newBalanceUSD = await dai.balanceOf(receiverAddress)
		expect(balance).to.eq("0")
		expect(newBalanceUSD.sub(balanceUSD)).to.eq(strike.mul(balance).div(toWei("1")))
	})
})

describe("Exchange", async () => {
	let optionToken: IOptionToken
	let optionTokenExpiration: moment.Moment
	let optionExchange: Exchange
	it("Deploys the Options Exchange", async () => {
		const [sender] = signers
		const optionExchangeFactory = await ethers.getContractFactory("Exchange")
		const _optionExchange = (await optionExchangeFactory.deploy()) as Exchange
		optionExchange = _optionExchange
		expect(optionRegistry).to.have.property("deployTransaction")
	})

	it("Creates an eth call option and deposits it on the exchange", async () => {
		const [sender] = signers
		optionTokenExpiration = moment(currentTime).add("12", "M")
		const issue = await optionRegistry.issue(
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			optionTokenExpiration.unix(),
			call,
			strike
		)
		let receipt = await issue.wait(1)
		let events = receipt.events
		const optionTokenCreated: any = events ? events[1] : undefined
		const address = optionTokenCreated?.args[0]
		expect(optionTokenCreated.event).to.eq("OptionTokenCreated")
		optionToken = new Contract(address, OptionToken.abi, sender) as IOptionToken
		const value = toWei("2")
		await optionRegistry.open(optionToken.address, value, {
			value
		})
		const balance = await optionToken.balanceOf(senderAddress)
		expect(balance).to.eq(value)
		await optionToken.approve(optionExchange.address, balance)
		const deposit = await optionExchange.depositToken(optionToken.address, balance)
		const depositReceipt = await deposit.wait(1)
		const depositEvents = depositReceipt.events
		const depositEvent = depositEvents?.find(x => x.event == "Deposit")
		const eventBalance = depositEvent?.args?.balance
		expect(eventBalance).to.eq(balance)
	})

	it("Creates a limit order to sell the eth call option", async () => {
		const order = await optionExchange.createOrder(
			dai.address,
			toWei("50"),
			optionToken.address,
			toWei("2"),
			optionTokenExpiration.unix(),
			"1"
		)

		const receipt = await order.wait(1)
		const events = receipt.events
		const orderEvent = events?.find(x => x.event == "Order")
		expect(orderEvent?.event).to.eq("Order")
	})

	it("Buys the options from a holder of strike token", async () => {
		const [, receiver] = signers
		const daiReceiver = dai.connect(receiver)
		await daiReceiver.approve(optionExchange.address, toWei("26"))
		const exchangeReceiver = optionExchange.connect(receiver)
		await exchangeReceiver.depositToken(dai.address, toWei("26"))
		const trade = await exchangeReceiver.trade(
			dai.address,
			toWei("50"),
			optionToken.address,
			toWei("2"),
			optionTokenExpiration.unix(),
			"1",
			senderAddress,
			toWei("25")
		)
		const optionBalance = await optionExchange.balanceOf(optionToken.address, receiverAddress)
		const receipt = await trade.wait(1)
		const events = receipt.events
		const tradeEvent = events?.find(x => x.event == "Trade")
		expect(optionBalance).to.eq(toWei("1"))
		expect(tradeEvent?.event).to.eq("Trade")
	})

	it("Buyer of option should be able to withdraw from exchange", async () => {
		const [, receiver] = signers
		const balanceStart = await optionToken.balanceOf(receiverAddress)
		expect(balanceStart).to.eq("0")
		const exchangeReceiver = optionExchange.connect(receiver)
		await exchangeReceiver.withdrawToken(optionToken.address, toWei("1"))
		const balance = await optionToken.balanceOf(receiverAddress)
		expect(balance).to.eq(toWei("1"))
	})
	//TODO add implied vol based orders
})

let priceFeed: PriceFeed
let ethDaiAggregator: MockContract
let weth: WETH
describe("Price Feed", async () => {
	it("Should deploy price feed", async () => {
		const Weth = await ethers.getContractFactory("contracts/tokens/WETH.sol:WETH")
		const wethContract = (await Weth.deploy()) as WETH
		weth = wethContract
		const uniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory")
		const _uniswapFactory = (await uniswapFactoryFactory.deploy(senderAddress)) as UniswapV2Factory
		let uniswapFactory: UniswapV2Factory = _uniswapFactory
		const uniswapRouterFactory = await ethers.getContractFactory("UniswapV2Router02")
		const _uniswapRouter = (await uniswapRouterFactory.deploy(
			uniswapFactory.address,
			wethContract.address
		)) as UniswapV2Router02
		let uniswapRouter: UniswapV2Router02 = _uniswapRouter
		ethDaiAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)

		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, dai.address, ethDaiAggregator.address)
		await priceFeed.addPriceFeed(weth.address, dai.address, ethDaiAggregator.address)
		const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, dai.address)
		expect(feedAddress).to.eq(ethDaiAggregator.address)
	})

	let rate: string
	it("Should return a price quote", async () => {
		// 567.70 - Chainlink uses 8 decimal places for this pair
		rate = "56770839675"
		await ethDaiAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			rate,
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		const quote = await priceFeed.getRate(weth.address, dai.address)
		expect(quote).to.eq(rate)
	})

	it("Should return a normalized price quote", async () => {
		await ethDaiAggregator.mock.decimals.returns("8")
		const quote = await priceFeed.getNormalizedRate(weth.address, dai.address)
		// get decimal to 18 places
		const expected = BigNumber.from(rate).mul(BigNumber.from(10 ** 10))
		expect(quote).to.eq(expected)
	})
})

let liquidityPools: LiquidityPools
let liquidityPool: LiquidityPool
let ethLiquidityPool: LiquidityPool
const CALL_FLAVOR = BigNumber.from(call)
const PUT_FLAVOR = BigNumber.from(put)
describe("Liquidity Pools", async () => {
	it("Should deploy liquidity pools", async () => {
		const abdkMathFactory = await ethers.getContractFactory("ABDKMathQuad")
		const abdkMathDeploy = await abdkMathFactory.deploy()
		const normDistFactory = await ethers.getContractFactory("NormalDist", {
			libraries: {}
		})
		const normDist = await normDistFactory.deploy()
		const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
			libraries: {
				NormalDist: normDist.address
			}
		})
		const blackScholesDeploy = await blackScholesFactory.deploy()
		const constFactory = await ethers.getContractFactory(
			"contracts/libraries/Constants.sol:Constants"
		)
		const constants = await constFactory.deploy()
		const optComputeFactory = await ethers.getContractFactory(
			"contracts/libraries/OptionsCompute.sol:OptionsCompute",
			{
				libraries: {}
			}
		)
		await optComputeFactory.deploy()
		const volFactory = await ethers.getContractFactory("Volatility", {
			libraries: {}
		})
		volatility = (await volFactory.deploy()) as Volatility
		const liquidityPoolsFactory = await ethers.getContractFactory("LiquidityPools", {
			libraries: {
				Constants: constants.address,
				BlackScholes: blackScholesDeploy.address
			}
		})
		const _liquidityPools: LiquidityPools = (await liquidityPoolsFactory.deploy()) as LiquidityPools
		liquidityPools = _liquidityPools
	})

	it("Should deploy option protocol and link to liquidity pools", async () => {
		const protocolFactory = await ethers.getContractFactory("Protocol")
		optionProtocol = (await protocolFactory.deploy(
			optionRegistry.address,
			liquidityPools.address,
			priceFeed.address
		)) as Protocol
		await liquidityPools.setup(optionProtocol.address)
		const lpProtocol = await liquidityPools.protocol()
		expect(optionProtocol.address).to.eq(lpProtocol)
	})

	it("Creates a liquidity pool with DAI (erc20) as strikeAsset", async () => {
		type int7 = [
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish
		]
		type number7 = [number, number, number, number, number, number, number]
		const coefInts: number7 = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		]
		//@ts-ignore
		const coefs: int7 = coefInts.map(x => toWei(x.toString()))
		const lp = await liquidityPools.createLiquidityPool(
			dai.address,
			weth.address,
			toWei("0.03"),
			coefs,
			coefs,
			"ETH/DAI",
			"EDP"
		)
		const lpReceipt = await lp.wait(1)
		const events = lpReceipt.events
		const createEvent = events?.find(x => x.event == "LiquidityPoolCreated")
		const strikeAsset = createEvent?.args?.strikeAsset
		const lpAddress = createEvent?.args?.lp
		expect(createEvent?.event).to.eq("LiquidityPoolCreated")
		expect(strikeAsset).to.eq(dai.address)
		liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
	})

	it("Adds liquidity to the liquidityPool", async () => {
		const price = await priceFeed.getNormalizedRate(weth.address, dai.address)
		await weth.deposit({ value: toWei("1") })
		const balance = await dai.balanceOf(senderAddress)
		const wethBalance = await weth.balanceOf(senderAddress)
		await dai.approve(liquidityPool.address, toWei("600"))
		await weth.approve(liquidityPool.address, toWei("1"))
		const addLiquidity = await liquidityPool.addLiquidity(toWei("600"), toWei("1"), 0, 0)
		const liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const receipt = await addLiquidity.wait(1)
		const event = receipt?.events?.find(x => x.event == "LiquidityDeposited")
		const newBalance = await dai.balanceOf(senderAddress)
		const newWethBalance = await weth.balanceOf(senderAddress)
		expect(event?.event).to.eq("LiquidityDeposited")
		expect(wethBalance.sub(newWethBalance)).to.eq(toWei("1"))
		expect(balance.sub(newBalance)).to.eq(toWei("600"))
		expect(liquidityPoolBalance).to.eq(toWei("600"))
	})

	it("Removes from liquidityPool with no options written", async () => {
		const liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		await liquidityPool.removeLiquidity(toWei("60"), "0", "0")
		const newLiquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		expect(liquidityPoolBalance.sub(newLiquidityPoolBalance)).to.eq(toWei("60"))
	})

	it("Adds additional liquidity from new account", async () => {
		const [sender, receiver] = signers
		const price = await priceFeed.getNormalizedRate(weth.address, dai.address)
		const balance = await dai.balanceOf(receiverAddress)
		const wethBalance = await weth.balanceOf(receiverAddress)
		const sendAmount = toWei("1")
		const daiReceiver = dai.connect(receiver)
		await daiReceiver.approve(liquidityPool.address, toWei("1000"))
		const wethReceiver = weth.connect(receiver)
		await wethReceiver.deposit({ value: toWei("1") })
		const lpReceiver = liquidityPool.connect(receiver)
		await wethReceiver.approve(liquidityPool.address, sendAmount)
		const totalSupply = await liquidityPool.totalSupply()
		await lpReceiver.addLiquidity(toWei("1000"), toWei("1"), 0, 0)
		const newTotalSupply = await liquidityPool.totalSupply()
		const lpBalance = await lpReceiver.balanceOf(receiverAddress)
		const difference = newTotalSupply.sub(lpBalance)
		const supplyRatio = convertRounded(newTotalSupply) / convertRounded(totalSupply)
		expect(Math.floor(supplyRatio)).to.eq(2)
		expect(difference).to.eq(lpBalance.sub(toWei("60")))
	})

	it("Creates a liquidity pool with ETH as strikeAsset", async () => {
		type int7 = [
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish
		]
		type number7 = [number, number, number, number, number, number, number]
		const coefInts: number7 = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		]
		//@ts-ignore
		const coefs: int7 = coefInts.map(x => toWei(x.toString()))
		const lp = await liquidityPools.createLiquidityPool(
			weth.address,
			dai.address,
			toWei("0.03"),
			coefs,
			coefs,
			"weth/dai",
			"wdp"
		)
		const receipt = await lp.wait(1)
		const events = receipt.events
		const createEvent = events?.find(x => x.event == "LiquidityPoolCreated")
		const strikeAsset = createEvent?.args?.strikeAsset
		const lpAddress = createEvent?.args?.lp
		expect(createEvent?.event).to.eq("LiquidityPoolCreated")
		expect(strikeAsset).to.eq(weth.address)
		ethLiquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
	})

	it("Returns a quote for a single ETH/USD call option", async () => {
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const expiration = moment(Number(timestamp) * 1000).add("5", "M")
		const timeToExpiration = genOptionTimeFromUnix(Number(timestamp), expiration.unix())
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, dai.address)
		const strikePrice = priceQuote.add(toWei("20"))
		const optionSeries = {
			expiration: toWei(expiration.unix().toString()),
			flavor: CALL_FLAVOR,
			strike: strikePrice,
			strikeAsset: dai.address,
			underlying: weth.address
		}
		const iv = await liquidityPool.getImpliedVolatility(
			optionSeries.flavor,
			priceQuote,
			optionSeries.strike,
			optionSeries.expiration
		)
		const localBS = bs.blackScholes(
			fromWei(priceQuote),
			fromWei(strikePrice),
			timeToExpiration,
			fromWei(iv),
			0.03,
			"call"
		)
		await priceFeed.addPriceFeed(ETH_ADDRESS, dai.address, ethDaiAggregator.address)
		const quote = await liquidityPool.quotePrice(optionSeries)
		expect(Math.round(truncate(localBS))).to.eq(Math.round(tFormatEth(quote.toString())))
	})

	it("Returns a quote for ETH/USD call with utilization", async () => {
		const totalLiqidity = await liquidityPool.totalSupply()
		const amount = toWei("5")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const expiration = moment(Number(timestamp) * 1000).add("5", "M")
		const timeToExpiration = genOptionTimeFromUnix(Number(timestamp), expiration.unix())
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, dai.address)
		const strikePrice = priceQuote.add(toWei("20"))
		const priceNorm = fromWei(priceQuote)
		const volatility = Number(IMPLIED_VOL) / 100
		const utilization = Number(fromWei(amount)) / Number(fromWei(totalLiqidity))
		const utilizationPrice = Number(priceNorm) * utilization
		const optionSeries = {
			expiration: toWei(expiration.unix().toString()),
			flavor: CALL_FLAVOR,
			strike: strikePrice,
			strikeAsset: dai.address,
			underlying: weth.address
		}
		const iv = await liquidityPool.getImpliedVolatility(
			optionSeries.flavor,
			priceQuote,
			optionSeries.strike,
			optionSeries.expiration
		)
		const localBS = bs.blackScholes(
			priceNorm,
			fromWei(strikePrice),
			timeToExpiration,
			fromWei(iv),
			0.03,
			"call"
		)
		const finalQuote = utilizationPrice > localBS ? utilizationPrice : localBS
		const quote = await liquidityPool.quotePriceWithUtilization(optionSeries, amount)
		const truncFinalQuote = Math.round(truncate(finalQuote))
		const formatEthQuote = Math.round(tFormatEth(quote.toString()))
		expect(truncFinalQuote).to.be.eq(formatEthQuote)
	})

	it("Returns a quote for a ETH/USD put with utilization", async () => {
		const totalLiqidity = await liquidityPool.totalSupply()
		const amount = toWei("5")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const expiration = moment(Number(timestamp) * 1000).add("5", "M")
		const timeToExpiration = genOptionTimeFromUnix(Number(timestamp), expiration.unix())
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, dai.address)
		const strikePrice = priceQuote.sub(toWei("20"))
		const priceNorm = fromWei(priceQuote)
		const utilization = Number(fromWei(amount)) / Number(fromWei(totalLiqidity))
		const utilizationPrice = Number(priceNorm) * utilization
		const optionSeries = {
			expiration: toWei(expiration.unix().toString()),
			flavor: PUT_FLAVOR,
			strike: strikePrice,
			strikeAsset: dai.address,
			underlying: weth.address
		}
		const iv = await liquidityPool.getImpliedVolatility(
			optionSeries.flavor,
			priceQuote,
			optionSeries.strike,
			optionSeries.expiration
		)
		const localBS = bs.blackScholes(
			priceNorm,
			fromWei(strikePrice),
			timeToExpiration,
			fromWei(iv),
			0.03,
			"put"
		)
		const finalQuote = utilizationPrice > localBS ? utilizationPrice : localBS
		const quote = await liquidityPool.quotePriceWithUtilization(optionSeries, amount)
		const truncQuote = truncate(finalQuote)
		const chainQuote = tFormatEth(quote.toString())
		const diff = percentDiff(truncQuote, chainQuote)
		expect(diff).to.be.lt(0.01)
	})

	let lpCallOption: IOptionToken
	it("LP Writes a ETH/USD call for premium", async () => {
		const [sender] = signers
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const expiration = moment(Number(timestamp) * 1000).add("5", "M")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, dai.address)
		const strikePrice = priceQuote.add(toWei("20"))
		await dai.mint(senderAddress, toWei("6000"))
		await dai.approve(liquidityPool.address, toWei("6000"))
		await weth.deposit({ value: amount.mul("5") })
		await weth.approve(liquidityPool.address, amount.mul("5"))
		await liquidityPool.addLiquidity(toWei("6000"), amount.mul("4"), 0, 0)
		const lpDaiBalanceBefore = await dai.balanceOf(liquidityPool.address)
		const proposedSeries = {
			expiration: toWei(expiration.unix().toString()),
			flavor: BigNumber.from(call),
			strike: BigNumber.from(strikePrice),
			strikeAsset: dai.address,
			underlying: weth.address
		}
		const quote = await liquidityPool.quotePriceWithUtilization(proposedSeries, amount)
		await dai.approve(liquidityPool.address, quote.toString())
		const write = await liquidityPool.issueAndWriteOption(proposedSeries, amount, weth.address)
		const receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		const seriesAddress = writeEvent?.args?.series
		const callOptionToken = new Contract(seriesAddress, OptionToken.abi, sender) as IOptionToken
		lpCallOption = callOptionToken
		const buyerOptionBalance = await callOptionToken.balanceOf(senderAddress)
		const openInterest = await optionRegistry.totalInterest(seriesAddress)
		const writersBalance = await optionRegistry.writers(seriesAddress, liquidityPool.address)
		const lpDaiBalance = await dai.balanceOf(liquidityPool.address)
		const senderEthBalance = await sender.getBalance()
		const balanceDiff = lpDaiBalanceBefore.sub(lpDaiBalance)
		expect(writersBalance).to.eq(amount)
		expect(buyerOptionBalance).to.eq(amount)
		expect(openInterest).to.eq(amount)
	})

	it("LP Writes a ETH/USD put for premium", async () => {
		const [sender] = signers
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const expiration = moment(Number(timestamp) * 1000).add("5", "M")
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, dai.address)
		const strikePrice = priceQuote.sub(toWei("20"))
		const proposedSeries = {
			expiration: toWei(expiration.unix().toString()),
			flavor: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: dai.address,
			underlying: weth.address
		}
		const quote = await liquidityPool.quotePriceWithUtilization(proposedSeries, amount)
		await dai.approve(liquidityPool.address, quote)
		const balance = await dai.balanceOf(senderAddress)
		const write = await liquidityPool.issueAndWriteOption(proposedSeries, amount, weth.address)
		const receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		const seriesAddress = writeEvent?.args?.series
		const putOptionToken = new Contract(seriesAddress, OptionToken.abi, sender) as IOptionToken
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const balanceNew = await dai.balanceOf(senderAddress)
		expect(putBalance).to.eq(amount)
		// ensure funds are being transfered
		expect(tFormatEth(balance.sub(balanceNew))).to.eq(tFormatEth(quote))
	})

	it("Exercises call option issued by LP", async () => {
		// exercise half
		const seriesInfo = await optionRegistry.seriesInfo(lpCallOption.address)
		const strike = seriesInfo.strike
		const exerciseAmount = toWei("0.5")
		const amount = strike.mul(exerciseAmount).div(toWei("1"))
		const balance = await dai.balanceOf(senderAddress)
		const lpBalance = await dai.balanceOf(liquidityPool.address)
		await optionRegistry.exercise(lpCallOption.address, exerciseAmount)
		const balanceAfter = await dai.balanceOf(senderAddress)
		const lpBalanceAfter = await dai.balanceOf(liquidityPool.address)
		expect(balance.sub(balanceAfter)).to.eq(amount)
	})

	it("Can compute IV from volatility skew coefs", async () => {
		const coefs: BigNumberish[] = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		].map(x => toWei(x.toString()))
		const points = [-0.36556715, 0.59115575].map(x => toWei(x.toString()))
		const expected_iv = 1.4473946
		//@ts-ignore
		const res = await volatility.computeIVFromSkewInts(coefs, points)
		expect(tFormatEth(res)).to.eq(truncate(expected_iv))
	})

	it("Can set the calls volatility skew", async () => {
		const coefInts: number[] = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		]
		const coefs: BigNumberish[] = coefInts.map(x => toWei(x.toString()))
		//@ts-ignore
		const res = await liquidityPool.setVolatilitySkew(coefs, BigNumber.from(call))
		const vs = await liquidityPool.getVolatilitySkew(BigNumber.from(call))
		const converted = vs.map((n: BigNumber) => fromWei(n))
		const diff = percentDiffArr(converted, coefInts)
		// allow for small float inprecision
		expect(diff).to.eq(0)
	})

	it("can set the puts volatility skew", async () => {})

	it("can compute portfolio delta", async function () {
		const res = await liquidityPool.getPortfolioDelta()
	})

	it("LP can buy back option to reduce open interest", async () => {})

	it("LP can redeem shares", async () => {
		const shares = await liquidityPool.balanceOf(senderAddress)
		const totalShares = await liquidityPool.totalSupply()
		//@ts-ignore
		const ratio = 1 / fromWei(totalShares)
		const daiBalance = await dai.balanceOf(liquidityPool.address)
		const withdraw = await liquidityPool.removeLiquidity(shares, 0, 0)
		const receipt = await withdraw.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "LiquidityRemoved")
		const strikeAmount = removeEvent?.args?.strikeAmount
		const daiBalanceAfter = await dai.balanceOf(liquidityPool.address)
		//@ts-ignore
		const diff = fromWei(daiBalance) * ratio
		expect(diff).to.be.lt(1)
		expect(strikeAmount).to.be.eq(daiBalance.sub(daiBalanceAfter))
	})

	it("LP can not redeems shares when in excess of liquidity", async () => {
		const shares = await liquidityPool.balanceOf(receiverAddress)
		const liquidityPoolReceiver = liquidityPool.connect(receiverAddress)
		const withdraw = liquidityPoolReceiver.removeLiquidity(shares, 0, 0)
		await expect(withdraw).to.be.revertedWith("StrikeAmountExceedsLiquidity")
	})
})
