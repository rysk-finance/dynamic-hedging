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
	GAMMA_ORACLE_NEW
} from "./constants"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { WriteOptionEvent } from "../types/LiquidityPool"

type WriteEvent = WriteOptionEvent & Event
type DecodedData = {
	series: string
}
interface EnrichedWriteEvent extends WriteEvent {
	decoded?: DecodedData
	series?: string
	delta?: number
	expiration?: number
}

let usd: MintableERC20
let weth: WETH
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let volatility: Volatility
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let priceFeed: PriceFeed
let controller: Controller
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator

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
		// impersonate the opyn controller owner
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [CONTROLLER_OWNER[chainId]]
		})
		signers = await ethers.getSigners()
		const [sender] = signers

		const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
		await sender.sendTransaction({
			to: signer.address,
			value: ethers.utils.parseEther("1.0") // Sends exactly 1.0 ether
		})
		// get an instance of the controller
		controller = (await ethers.getContractAt(
			"contracts/packages/opyn/core/Controller.sol:Controller",
			GAMMA_CONTROLLER[chainId]
		)) as Controller
		// get an instance of the addressbook
		addressBook = (await ethers.getContractAt(
			"contracts/packages/opyn/core/AddressBook.sol:AddressBook",
			ADDRESS_BOOK[chainId]
		)) as AddressBook
		// get the oracle
		const res = await setupTestOracle(await signers[0].getAddress())
		oracle = res[0] as Oracle
		opynAggregator = res[1] as MockChainlinkAggregator
		// deploy the new calculator
		const newCalculatorInstance = await ethers.getContractFactory("NewMarginCalculator")
		newCalculator = (await newCalculatorInstance.deploy(
			GAMMA_ORACLE_NEW[chainId],
			ADDRESS_BOOK[chainId]
		)) as NewMarginCalculator
		// deploy the new whitelist
		const newWhitelistInstance = await ethers.getContractFactory("NewWhitelist")
		const newWhitelist = await newWhitelistInstance.deploy(ADDRESS_BOOK[chainId])
		// update the addressbook with the new calculator and whitelist addresses
		await addressBook.connect(signer).setMarginCalculator(newCalculator.address)
		await addressBook.connect(signer).setWhitelist(newWhitelist.address)
		// update the whitelist and calculator in the controller
		await controller.connect(signer).refreshConfiguration()
		// whitelist collateral
		await newWhitelist.whitelistCollateral(WETH_ADDRESS[chainId])
		await newWhitelist.whitelistCollateral(USDC_ADDRESS[chainId])
		// whitelist products
		// normal calls
		await newWhitelist.whitelistProduct(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			false
		)
		// normal puts
		await newWhitelist.whitelistProduct(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			true
		)
		// usd collateralised calls
		await newWhitelist.whitelistProduct(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			false
		)
		// eth collateralised puts
		await newWhitelist.whitelistProduct(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			true
		)
		// whitelist vault type 0 collateral
		await newWhitelist.whitelistCoveredCollateral(WETH_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
		await newWhitelist.whitelistCoveredCollateral(USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
		// whitelist vault type 1 collateral
		await newWhitelist.whitelistNakedCollateral(USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
		await newWhitelist.whitelistNakedCollateral(WETH_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
		// set product spot shock values
		// usd collateralised calls
		await newCalculator.setSpotShock(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			false,
			productSpotShockValue
		)
		// usd collateralised puts
		await newCalculator.setSpotShock(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			true,
			productSpotShockValue
		)
		// eth collateralised calls
		await newCalculator.setSpotShock(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			false,
			productSpotShockValue
		)
		// eth collateralised puts
		await newCalculator.setSpotShock(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			true,
			productSpotShockValue
		)
		// set expiry to value values
		// usd collateralised calls
		await newCalculator.setUpperBoundValues(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			false,
			timeToExpiry,
			expiryToValue
		)
		// usd collateralised puts
		await newCalculator.setUpperBoundValues(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			true,
			timeToExpiry,
			expiryToValue
		)
		// eth collateralised calls
		await newCalculator.setUpperBoundValues(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			false,
			timeToExpiry,
			expiryToValue
		)
		// eth collateralised puts
		await newCalculator.setUpperBoundValues(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			true,
			timeToExpiry,
			expiryToValue
		)
	})

	it("Deploys the Option Registry and sets state with written options", async () => {
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		// deploy libraries
		const constantsFactory = await hre.ethers.getContractFactory("Constants")
		const interactionsFactory = await hre.ethers.getContractFactory("OpynInteractionsV2")
		const constants = await constantsFactory.deploy()
		const interactions = await interactionsFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await hre.ethers.getContractFactory("OptionRegistry", {
			libraries: {
				OpynInteractionsV2: interactions.address
			}
		})
		// get and transfer weth
		weth = (await ethers.getContractAt(
			"contracts/interfaces/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		usd = (await ethers.getContractAt("ERC20", USDC_ADDRESS[chainId])) as MintableERC20
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		await usd.connect(signer).transfer(senderAddress, toWei("1000").div(oTokenDecimalShift18))
		await weth.deposit({ value: utils.parseEther("99") })
		const _optionRegistry = (await optionRegistryFactory.deploy(
			USDC_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId]
		)) as OptionRegistry
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")

		// deploy price feed
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, usd.address, opynAggregator.address)
		await priceFeed.addPriceFeed(weth.address, usd.address, opynAggregator.address)
		// oracle returns price denominated in 1e8
		const oraclePrice = await oracle.getPrice(weth.address)
		// pricefeed returns price denominated in 1e18
		const priceFeedPrice = await priceFeed.getNormalizedRate(weth.address, usd.address)
		expect(oraclePrice.mul(10_000_000_000)).to.equal(priceFeedPrice)

		// deploy option protocol and link to registry/price feed
		const protocolFactory = await ethers.getContractFactory("Protocol")
		optionProtocol = (await protocolFactory.deploy(
			optionRegistry.address,
			priceFeed.address
		)) as Protocol
		expect(await optionProtocol.optionRegistry()).to.equal(optionRegistry.address)

		// creates a liquidity pool with USDC as strike Asset
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

		const normDistFactory = await ethers.getContractFactory("NormalDist", {
			libraries: {}
		})
		const normDist = await normDistFactory.deploy()
		const volFactory = await ethers.getContractFactory("Volatility", {
			libraries: {}
		})
		volatility = (await volFactory.deploy()) as Volatility
		const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
			libraries: {
				NormalDist: normDist.address
			}
		})
		const blackScholesDeploy = await blackScholesFactory.deploy()

		const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
			libraries: {
				BlackScholes: blackScholesDeploy.address
			}
		})
		const lp = (await liquidityPoolFactory.deploy(
			optionProtocol.address,
			usd.address,
			weth.address,
			usd.address,
			toWei(rfr),
			coefs,
			coefs,
			"ETH/USDC",
			"EDP",
			{
				minCallStrikePrice,
				maxCallStrikePrice,
				minPutStrikePrice,
				maxPutStrikePrice,
				minExpiry: minExpiry,
				maxExpiry: maxExpiry
			},
			await signers[0].getAddress()
		)) as LiquidityPool

		const lpAddress = lp.address
		liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
		optionRegistry.setLiquidityPool(liquidityPool.address)

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
		liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		await liquidityPool.withdraw(liquidityPoolBalance, senderAddress)
		const newLiquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const expectedBalance = (
			parseFloat(liquidityPoolUsdcDeposit) - parseFloat(liquidityPoolUsdcWithdraw)
		).toString()
		expect(newLiquidityPoolBalance).to.eq(toWei(expectedBalance))
		expect(liquidityPoolBalance.sub(newLiquidityPoolBalance)).to.eq(toWei(liquidityPoolUsdcWithdraw))

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
		await usd.approve(liquidityPool.address, quote)
		balance = await usd.balanceOf(senderAddress)
		let write = await liquidityPool.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		const seriesAddress = writeEvent?.args?.series
		const putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const registryUsdBalance = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew))).to.eq(tFormatEth(quote))

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
		quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedCallSeries, amount))[0]
		write = await liquidityPool.issueAndWriteOption(proposedCallSeries, amount)
		receipt = await write.wait(1)
	})

	// encompasses primary logic to be used by external adapter to fetch and compute delta
	it("Fetches deposit events and computes delta", async () => {
		const events = liquidityPool.filters.WriteOption()
		const writeOption = await liquidityPool.queryFilter(events)
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const enrichedWriteOptions: Promise<EnrichedWriteEvent>[] = writeOption.map(
			async (x: WriteOptionEvent): Promise<EnrichedWriteEvent> => {
				const y: EnrichedWriteEvent = x
				const { data, topics, decode } = y
				if (!decode) return x
				y.decoded = decode(data, topics)
				y.series = y?.decoded?.series
				//@TODO consider batching these as a multicall or using an indexing service
				if (!y.series) return x
				const seriesInfo = await optionRegistry.seriesInfo(y.series)
				y.expiration = seriesInfo.expiration.toNumber()
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
				y.delta = delta * -1
				return y
			}
		)
		const resolved = await Promise.all(enrichedWriteOptions)
		const filtered = resolved.filter(x => {
			return expiration > timestamp
		})
		const delta = filtered.reduce((total, num) => total + (num.delta || 0), 0)
		expect(resolved.length).to.eq(2)
		expect(delta).to.eq(expected_portfolio_delta)
	})
})
