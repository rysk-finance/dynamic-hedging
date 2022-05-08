import hre, { ethers, network } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber, Event } from "ethers"
//@ts-ignore
import greeks from "greeks"
import {
	toWei,
	tFormatEth,
	call,
	put,
	fromWei,
	toUSDC,
	fromUSDC,
	fmtExpiration,
	toOpyn,
	tFormatUSDC,
	scaleNum,
	genOptionTimeFromUnix,
	fromOpyn
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
import { WriteOptionEvent } from "../types/LiquidityPool"
import { VolatilityFeed } from "../types/VolatilityFeed"
import { NewController } from "../types/NewController"
import { OptionHandler } from "../types/OptionHandler"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { getMatchingEvents, WRITE_OPTION } from "../utils/events"

type WriteEvent = WriteOptionEvent & Event
type DecodedData = {
	series: string
	amount: BigNumber
}
type VaultLiquidatedEvent = {
	vaultOwner: string
	// amount of liquidation in 1e8
	debtAmount: BigNumber
	vaultId: BigNumber
}
interface EnrichedWriteEvent extends WriteEvent {
	decoded?: DecodedData
	series?: string
	delta?: number
	expiration?: number
	vaultId?: string
	amount?: BigNumber
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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const expected_put_delta = 0.39679640941831507
const expected_call_delta = -0.5856527252094983
const expected_portfolio_delta = expected_put_delta + expected_call_delta

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
			portfolioValuesFeed
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
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit), senderAddress)
		let liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		let receipt = await deposit.wait(1)
		const event = receipt?.events?.find(x => x.event == "Deposit")
		const newBalance = await usd.balanceOf(senderAddress)
		expect(event?.event).to.eq("Deposit")
		expect(balance.sub(newBalance)).to.eq(toUSDC(liquidityPoolUsdcDeposit))
		expect(liquidityPoolBalance.toString()).to.eq(toWei(liquidityPoolUsdcDeposit))

		// Removes from liquidityPool with no options written
		await liquidityPool.setMaxTimeDeviationThreshold("1000")
		liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const halfBalance = liquidityPoolBalance.div(BigNumber.from(2))
		await liquidityPool.withdraw(halfBalance, senderAddress)
		const newLiquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const expectedBalance = (
			parseFloat(liquidityPoolUsdcDeposit) - parseFloat(liquidityPoolUsdcWithdraw)
		).toString()

		// add additional liquidity from new account
		const [sender, receiver] = signers
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit), senderAddress)
		const sendAmount = toUSDC("10000")
		const usdReceiver = usd.connect(receiver)
		await usdReceiver.approve(liquidityPool.address, sendAmount)
		const lpReceiver = liquidityPool.connect(receiver)
		const totalSupply = await liquidityPool.totalSupply()
		await lpReceiver.deposit(sendAmount, receiverAddress)
		const newTotalSupply = await liquidityPool.totalSupply()
		const lpBalance = await lpReceiver.balanceOf(receiverAddress)
		const difference = newTotalSupply.sub(lpBalance)
		expect(difference).to.eq(await lpReceiver.balanceOf(senderAddress))
		expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))

		// LP writes a ETH/USD put for premium
		const amount = toWei("1")
		let blockNum = await ethers.provider.getBlockNumber()
		let block = await ethers.provider.getBlock(blockNum)
		let { timestamp } = block
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
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
		let quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await usd.approve(handler.address, quote)
		balance = await usd.balanceOf(senderAddress)
		let write = await handler.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		receipt = await write.wait(1)
		const writeEvents = getMatchingEvents(receipt, WRITE_OPTION)
		const writeEvent = writeEvents[0]
		const seriesAddress = writeEvent !== "failed" ? writeEvent?.series : ""
		//@ts-ignore
		const putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const registryUsdBalance = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew), 2)).to.eq(tFormatEth(quote, 2))
		await putOptionToken.approve(handler.address, toOpyn(fromWei(amount)))
		const buyback = await handler.buybackOption(seriesAddress, amount)

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
		receipt = await write.wait(1)
	})

	// encompasses primary logic to be used by external adapter to fetch and compute delta
	it("Fetches deposit events and computes delta", async () => {
		const writeOptionEventFilter = liquidityPool.filters.WriteOption()
		const buybackEventFilter = liquidityPool.filters.BuybackOption()
		const vaultLiquidatedFilter = controller.filters.VaultLiquidated()
		const writeOption = await liquidityPool.queryFilter(writeOptionEventFilter)
		const buybackEvents = await liquidityPool.queryFilter(buybackEventFilter)
		const vaultLiquidatedEvents = await controller.queryFilter(vaultLiquidatedFilter)
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block

		// index liquidated vaults by vaultId
		const liquidatedVaults: Record<string, BigNumber> = {}
		// index buybacks amounts by series
		const buybackAmounts: Record<string, BigNumber> = {}
		// index write amount by series address
		const writeOptionAmounts: Record<string, BigNumber> = {}

		buybackEvents.map(x => {
			if (!x.decode) return
			const decoded: DecodedData = x.decode(x.data, x.topics)
			const amount = buybackAmounts[decoded.series]
			if (!amount) {
				buybackAmounts[decoded.series] = decoded.amount
			} else {
				buybackAmounts[decoded.series] = amount.add(buybackAmounts[decoded.series])
			}
			return decoded
		})
		vaultLiquidatedEvents.map(x => {
			if (!x.decode) return
			const decoded: VaultLiquidatedEvent = x.decode(x.data, x.topics)
			liquidatedVaults[decoded.vaultId.toString()] = decoded.debtAmount
		})
		const enrichedWriteOptions: Promise<EnrichedWriteEvent>[] = writeOption.map(
			async (x: WriteOptionEvent): Promise<EnrichedWriteEvent> => {
				const y: EnrichedWriteEvent = x
				const { data, topics, decode } = y
				if (!decode) return x
				y.decoded = decode(data, topics)
				y.series = y?.decoded?.series
				if (!y.series) return y
				//@TODO consider batching these as a multicall or using an indexing service
				const seriesInfo = await optionRegistry.seriesInfo(y.series)
				const vaultId = await optionRegistry.vaultIds(y.series)
				y.vaultId = vaultId.toString()
				y.expiration = seriesInfo.expiration.toNumber()
				const amount: BigNumber = y?.decoded?.amount ? y?.decoded?.amount : BigNumber.from(0)
				y.amount = amount
				writeOptionAmounts[y.series] = amount
				return y
			}
		)
		const resolved = await Promise.all(enrichedWriteOptions)
		// remove expired options
		const filtered = resolved.filter(x => {
			if (!x.expiration) return
			return x.expiration > timestamp
		})
		// reduce write events to options positions by series
		const seriesProcessed = new Set()
		//@ts-ignore
		const optionPositions: EnrichedWriteEvent[] = filtered.reduce((acc, cv) => {
			if (!cv.series) return acc
			if (seriesProcessed.has(cv.series)) return acc
			const amount = writeOptionAmounts[cv.series]
			cv.amount = amount
			seriesProcessed.add(cv.series)
			return [...acc, cv]
		}, [])

		const enrichedOptionPositions = optionPositions.map(async x => {
			if (!x.series || !x.vaultId) return x
			// reduce notional amount by buybacks and liquidations
			const buybackAmount: BigNumber = buybackAmounts[x.series]
			const liquidationAmount: BigNumber = liquidatedVaults[x.vaultId]
			if (buybackAmount) x.amount = x.amount?.sub(buybackAmount)
			if (liquidationAmount) x.amount = x.amount?.sub(liquidationAmount)

			const seriesInfo = await optionRegistry.seriesInfo(x.series)
			const priceQuote = await priceFeed.getNormalizedRate(
				seriesInfo.underlying,
				seriesInfo.strikeAsset
			)
			const priceNorm = fromWei(priceQuote)
			const iv = await liquidityPool.getImpliedVolatility(
				seriesInfo.isPut,
				priceQuote,
				seriesInfo.strike,
				seriesInfo.expiration
			)
			const optionType = seriesInfo.isPut ? "put" : "call"
			const timeToExpiration = genOptionTimeFromUnix(
				Number(timestamp),
				seriesInfo.expiration.toNumber()
			)

			const delta = greeks.getDelta(
				priceNorm,
				fromOpyn(seriesInfo.strike),
				timeToExpiration, // don't use this
				fromWei(iv),
				parseFloat(rfr),
				optionType
			)
			// invert sign due to writing rather than buying
			// @TODO consider keeping calculation in BigNumber as more precise and is the format onchain.
			if (x.amount) x.delta = Number(fromWei(x.amount)) * delta * -1
			return x
		})
		const resolvedOptionPositions = await Promise.all(enrichedOptionPositions)

		// closed due to buyback - subtract the amount of the buyback
		// closed due to liquidation - get all liquidated events
		const portfolioDelta = resolvedOptionPositions.reduce((total, num) => total + (num.delta || 0), 0)
		expect(resolved.length).to.eq(2)
		//expect(delta).to.eq(expected_portfolio_delta)
	})
})
