import hre, { ethers, network } from "hardhat"
import {
	BigNumberish,
	Contract,
	utils,
	Signer,
	BigNumber,
	ContractTransaction,
	ContractReceipt
} from "ethers"
import { AbiCoder, serializeTransaction } from "ethers/lib/utils"
//@ts-ignore
import greeks from "greeks"
//@ts-ignore
import bs from "black-scholes"
import {
	toWei,
	tFormatEth,
	fromWei,
	toUSDC,
	toOpyn,
	tFormatUSDC,
	scaleNum,
	truncate
} from "../utils/conversion-helper"
import moment from "moment"
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import HandlerSol from "../artifacts/contracts/OptionHandler.sol/OptionHandler.json"
import { ERC20 } from "../types/ERC20"
import { ERC20Interface } from "../types/ERC20Interface"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPool } from "../types/LiquidityPool"
import { Volatility } from "../types/Volatility"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import { Controller } from "../types/Controller"
import { AddressBook } from "../types/AddressBook"
import { Oracle } from "../types/Oracle"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import { setupTestOracle } from "./helpers"
import {
	ADDRESS_BOOK,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS,
	CONTROLLER_OWNER,
	CHAINLINK_WETH_PRICER
} from "./constants"
import { deployOpyn } from "../utils/opyn-deployer"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { MockPortfolioValuesFeed } from "../types/MockPortfolioValuesFeed"
import { VolatilityFeed } from "../types/VolatilityFeed"
import { NewController } from "../types/NewController"
import { OptionHandler } from "../types/OptionHandler"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { getMatchingEvents, WRITE_OPTION, BUYBACK_OPTION } from "../utils/events"
import { getPortfolioValues } from "../utils/portfolioValues"

type Series = {
	expiration: number
	isPut: boolean
	strike: BigNumber
	strikeAsset: string
	underlying: string
	collateral: string
}
type WrittenOption = {
	amount: BigNumber
	series: Series
}
let usd: MintableERC20
let weth: WETH
let wethERC20: ERC20Interface
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let volatility: Volatility
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let priceFeed: PriceFeed
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let volFeed: VolatilityFeed
let portfolioValuesFeed: MockPortfolioValuesFeed
let handler: OptionHandler
let portfolioValueArgs: [LiquidityPool, NewController, OptionRegistry, PriceFeed, Oracle]

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
// delta of first put written
const expected_put_delta = 0.39679640941831507
// delta of first call written
const expected_call_delta = -0.5856527252094983
const expected_portfolio_delta = expected_put_delta + expected_call_delta
const expected_portfolio_delta_two_calls = expected_put_delta + expected_call_delta * 2

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

// decimal representation of a percentage
const rfr: string = "0.03"
// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = "20"

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "10000"
const liquidityPoolWethDeposit = "1"

// balance to withdraw after deposit
const liquidityPoolWethWithdraw = "0.1"
const liquidityPoolUsdcWithdraw = "10000"

const minCallStrikePrice = utils.parseEther("500")
const maxCallStrikePrice = utils.parseEther("10000")
const minPutStrikePrice = utils.parseEther("500")
const maxPutStrikePrice = utils.parseEther("10000")
// one week in seconds
const minExpiry = 86400 * 7
// 365 days in seconds
const maxExpiry = 86400 * 365

const productSpotShockValue = scaleNum("0.6", 27)
// array of time to expiry
const day = 60 * 60 * 24
const timeToExpiry = [day * 7, day * 14, day * 28, day * 42, day * 56]
// array of upper bound value correspond to time to expiry
const expiryToValue = [
	scaleNum("0.1678", 27),
	scaleNum("0.237", 27),
	scaleNum("0.3326", 27),
	scaleNum("0.4032", 27),
	scaleNum("0.4603", 27)
]

/* --- end variables to change --- */

const expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000

const CALL_FLAVOR = false
const PUT_FLAVOR = true
const amount = toWei("1")
let callOptionToken: IOToken
let callSeriesAddress: any
let blockNum: number
let block: any
let timestamp: any
let strikePrice: BigNumber
let priceQuote: BigNumber
let write: ContractTransaction
let receipt: ContractReceipt
let authority: string

const writtenOptions: WrittenOption[] = []

describe("Oracle core logic", async () => {
	before(async function () {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						chainId: 1,
						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
						blockNumber: 14290000
					}
				}
			]
		})

		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [CHAINLINK_WETH_PRICER[chainId]]
		})
		signers = await ethers.getSigners()
		let opynParams = await deployOpyn(signers, productSpotShockValue, timeToExpiry, expiryToValue)
		controller = opynParams.controller
		addressBook = opynParams.addressBook
		oracle = opynParams.oracle
		newCalculator = opynParams.newCalculator
		const [sender] = signers

		const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
		await sender.sendTransaction({
			to: signer.address,
			value: ethers.utils.parseEther("10.0") // Sends exactly 10.0 ether
		})

		const forceSendContract = await ethers.getContractFactory("ForceSend")
		const forceSend = await forceSendContract.deploy() // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
		await forceSend
			.connect(signer)
			.go(CHAINLINK_WETH_PRICER[chainId], { value: utils.parseEther("0.5") })

		// get the oracle
		const res = await setupTestOracle(await sender.getAddress())
		oracle = res[0] as Oracle
		opynAggregator = res[1] as MockChainlinkAggregator
		let deployParams = await deploySystem(signers, oracle, opynAggregator)
		weth = deployParams.weth
		wethERC20 = deployParams.wethERC20
		usd = deployParams.usd
		optionRegistry = deployParams.optionRegistry
		priceFeed = deployParams.priceFeed
		volFeed = deployParams.volFeed
		portfolioValuesFeed = deployParams.portfolioValuesFeed
		optionProtocol = deployParams.optionProtocol
		authority = deployParams.authority.address
		let lpParams = await deployLiquidityPool(
			signers,
			optionProtocol,
			usd,
			wethERC20,
			rfr,
			minCallStrikePrice,
			minPutStrikePrice,
			maxCallStrikePrice,
			maxPutStrikePrice,
			minExpiry,
			maxExpiry,
			optionRegistry,
			portfolioValuesFeed,
			authority
		)
		volatility = lpParams.volatility
		liquidityPool = lpParams.liquidityPool
		handler = lpParams.handler
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		//await portfolioValuesFeed.setLiquidityPool(liquidityPool.address)
	})

	it("Deploys the Option Registry and sets state with written options", async () => {
		// deposit to the liquidity pool
		const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_WHALE]
		})
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		await weth.deposit({ value: toWei(liquidityPoolWethDeposit) })
		await usdWhaleConnect.transfer(senderAddress, toUSDC("1000000"))
		await usdWhaleConnect.transfer(receiverAddress, toUSDC("1000000"))
		let balance = await usd.balanceOf(senderAddress)
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
		let liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		let receipt = await deposit.wait(1)
		const event = receipt?.events?.find(x => x.event == "Deposit")
		expect(event?.event).to.eq("Deposit")
		portfolioValueArgs = [liquidityPool, controller, optionRegistry, priceFeed, oracle]

		// Removes from liquidityPool with no options written
		liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const halfBalance = liquidityPoolBalance.div(BigNumber.from(2))
		const newLiquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const expectedBalance = (
			parseFloat(liquidityPoolUsdcDeposit) - parseFloat(liquidityPoolUsdcWithdraw)
		).toString()

		// add additional liquidity from new account
		const [sender, receiver] = signers
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
		const sendAmount = toUSDC("10000")
		const usdReceiver = usd.connect(receiver)
		await usdReceiver.approve(liquidityPool.address, sendAmount)
		const lpReceiver = liquidityPool.connect(receiver)
		const totalSupply = await liquidityPool.totalSupply()
		await lpReceiver.deposit(sendAmount)
		const newTotalSupply = await liquidityPool.totalSupply()
		const lpBalance = await lpReceiver.balanceOf(receiverAddress)
		const difference = newTotalSupply.sub(lpBalance)
		expect(difference).to.eq(await lpReceiver.balanceOf(senderAddress))
		expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))

		// LP writes a ETH/USD put for premium
		blockNum = await ethers.provider.getBlockNumber()
		block = await ethers.provider.getBlock(blockNum)
		let { timestamp } = block
		priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		let strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration,
			isPut: PUT_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		let quote = (
			await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount, false)
		)[0]
		await usd.approve(handler.address, quote)
		balance = await usd.balanceOf(senderAddress)
		let write = await handler.issueAndWriteOption(proposedSeries, amount)
		writtenOptions.push({ amount, series: proposedSeries })
		receipt = await write.wait(1)
		const writeEvents = getMatchingEvents(receipt, WRITE_OPTION)
		const portfolioValuesPutWrite = await getPortfolioValues(...portfolioValueArgs)
		// check that computed portfolio delta from events matches expected put delta
		expect(truncate(portfolioValuesPutWrite.portfolioDelta)).to.eq(truncate(expected_put_delta))
		const writeEvent = writeEvents[0]
		const seriesAddress = writeEvent !== "failed" ? writeEvent?.series : ""
		//@ts-ignore
		const putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		expect(putBalance).to.eq(opynAmount)
		expect(writeEvents.length).to.eq(1)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew), 2)).to.eq(tFormatEth(quote, 2))
	})

	it("Computes portfolio delta after writing a call with intial put option from the pool", async () => {
		const [sender] = signers
		// LP writes a ETH/USD call for premium
		blockNum = await ethers.provider.getBlockNumber()
		block = await ethers.provider.getBlock(blockNum)
		timestamp = block.timestamp
		strikePrice = priceQuote.add(toWei(strike)).add(toWei(strike))
		const proposedCallSeries = {
			expiration: expiration,
			isPut: CALL_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		write = await handler.issueAndWriteOption(proposedCallSeries, amount)
		writtenOptions.push({ amount, series: proposedCallSeries })
		receipt = await write.wait(1)
		const portfolioValuesCallWrite = await getPortfolioValues(...portfolioValueArgs)
		expect(truncate(portfolioValuesCallWrite.portfolioDelta)).to.eq(
			truncate(expected_portfolio_delta)
		)
	})

	it("Computes portfolio delta after writing an additional call from an existing pool", async () => {
		const [sender] = signers
		// LP writes a ETH/USD call for premium
		blockNum = await ethers.provider.getBlockNumber()
		block = await ethers.provider.getBlock(blockNum)
		timestamp = block.timestamp
		strikePrice = priceQuote.add(toWei(strike)).add(toWei(strike))
		const proposedCallSeries = {
			expiration: expiration,
			isPut: CALL_FLAVOR,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		write = await handler.issueAndWriteOption(proposedCallSeries, amount)
		writtenOptions.push({ amount, series: proposedCallSeries })
		receipt = await write.wait(1)
		const callWriteEvents = getMatchingEvents(receipt, WRITE_OPTION)
		const callWriteEvent = callWriteEvents[0]
		callSeriesAddress = callWriteEvent !== "failed" ? callWriteEvent?.series : ""
		callOptionToken = new Contract(callSeriesAddress, Otoken.abi, sender) as IOToken
		const portfolioValuesCallWrite = await getPortfolioValues(...portfolioValueArgs)
		expect(truncate(portfolioValuesCallWrite.portfolioDelta)).to.eq(
			truncate(expected_portfolio_delta_two_calls)
		)
	})

	it("Computes portfolio delta after partial buyback of option", async () => {
		// 0.02 from wei
		const buybackAmount = amount.div(BigNumber.from(50))
		const buybackAmountOpyn = buybackAmount.sub(BigNumber.from(10 ** 10))
		await callOptionToken.approve(handler.address, buybackAmount)
		const buyback = await handler.buybackOption(callSeriesAddress, buybackAmountOpyn)
		const buybackReceipt = await buyback.wait(0)
		const buybackAmountNormalized = fromWei(buybackAmount)
		const buybackDeltaAmount = Number(buybackAmountNormalized) * expected_call_delta
		const newDelta = expected_portfolio_delta_two_calls - buybackDeltaAmount
		const portfolioValuesBuyback = await getPortfolioValues(...portfolioValueArgs)
		expect(truncate(newDelta)).to.eq(truncate(portfolioValuesBuyback.portfolioDelta))
	})

	it("properly computed portfolio delta after liquidation event", async () => {
		const arr = await optionRegistry.checkVaultHealth(2)
		const healthFBefore = arr[2]
		// move price and change vault health
		const currentPrice = await oracle.getPrice(weth.address)
		const settlePrice = currentPrice.add(toWei("1000").div(oTokenDecimalShift18))
		await opynAggregator.setLatestAnswer(settlePrice)
		await opynAggregator.setRoundAnswer(0, settlePrice)
		await opynAggregator.setRoundTimestamp(0)

		const vaultDetails = await controller.getVault(optionRegistry.address, 2)
		const value = vaultDetails.shortAmounts[0]
		const liqBalBef = await usd.balanceOf(senderAddress)
		const collatAmountsBef = vaultDetails.collateralAmounts[0]
		const liqOpBalBef = await callOptionToken.balanceOf(senderAddress)
		expect(liqOpBalBef).to.be.gt(0)
		const abiCode = new AbiCoder()
		const liquidateArgs = [
			{
				actionType: 10,
				owner: optionRegistry.address,
				secondAddress: senderAddress,
				asset: callOptionToken.address,
				vaultId: 2,
				amount: value,
				index: "0",
				data: abiCode.encode(["uint256"], ["6"])
			}
		]
		await controller.operate(liquidateArgs)
		await optionRegistry.registerLiquidatedVault(2)

		await opynAggregator.setLatestAnswer(currentPrice)
		await opynAggregator.setRoundAnswer(0, currentPrice)
		await opynAggregator.setRoundTimestamp(0)
		const portfolioValues = await getPortfolioValues(
			liquidityPool,
			controller,
			optionRegistry,
			priceFeed,
			oracle
		)
		expect(truncate(expected_put_delta)).to.eq(truncate(portfolioValues.portfolioDelta))
	})

	it("properly computes calls and puts values with expired OTM options", async () => {
		// set block timestamp past expiration of all options
		const TARGET_BLOCK = 1649145600
		await network.provider.request({
			method: "evm_setNextBlockTimestamp",
			params: [TARGET_BLOCK]
		})
		await ethers.provider.send("evm_mine", [])
		blockNum = await ethers.provider.getBlockNumber()
		block = await ethers.provider.getBlock(blockNum)
		timestamp = block.timestamp
		expect(timestamp).to.eq(TARGET_BLOCK)
		priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const sumValues = writtenOptions
			.map(x => {
				const { series } = x
				const { isPut, strike, expiration } = series
				if (expiration > timestamp) throw "Option is not expired"
				if (isPut) {
					if (priceQuote.gt(strike)) return BigNumber.from(0)
					return strike.sub(priceQuote)
				}
				if (priceQuote.lt(strike)) return BigNumber.from(0)
				return priceQuote.sub(strike)
			})
			.reduce((pv: BigNumber, cv: BigNumber) => pv.add(cv), BigNumber.from(0))
		expect(sumValues).to.eq(BigNumber.from(0))
		const portfolioValues = await getPortfolioValues(
			liquidityPool,
			controller,
			optionRegistry,
			priceFeed,
			oracle
		)
		expect(portfolioValues.callsPutsValue).to.eq(0)
	})
})
