import hre, { ethers, network } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber } from "ethers"
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
	scaleNum
} from "../utils/conversion-helper"
import moment from "moment"
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { MockPortfolioValuesFeed } from "../types/MockPortfolioValuesFeed"
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
import { NewController } from "../types/NewController"
import { AddressBook } from "../types/AddressBook"
import { Oracle } from "../types/Oracle"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import { setupTestOracle, calculateOptionDeltaLocally } from "./helpers"
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
import { deployOpyn } from "../utils/opyn-deployer"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { VolatilityFeed } from "../types/VolatilityFeed"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { OptionHandler } from "../types/OptionHandler"

let usd: MintableERC20
let weth: WETH
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let volatility: Volatility
let volFeed: VolatilityFeed
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let priceFeed: PriceFeed
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let portfolioValuesFeed: MockPortfolioValuesFeed
let handler: OptionHandler

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

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
const liquidityPoolUsdcWithdraw = "8000"

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

describe("Liquidity Pools Deposit Withdraw", async () => {
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
		signers = await ethers.getSigners()
		let opynParams = await deployOpyn(signers, productSpotShockValue, timeToExpiry, expiryToValue)
		controller = opynParams.controller
		addressBook = opynParams.addressBook
		oracle = opynParams.oracle
		newCalculator = opynParams.newCalculator
		// get the oracle
		const res = await setupTestOracle(await signers[0].getAddress())
		oracle = res[0] as Oracle
		opynAggregator = res[1] as MockChainlinkAggregator
		let deployParams = await deploySystem(signers, oracle, opynAggregator)
		weth = deployParams.weth
		const wethERC20 = deployParams.wethERC20
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
	})
	it("Deposit to the liquidityPool", async () => {
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
		const balance = await usd.balanceOf(senderAddress)
		await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
		const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit), senderAddress)
		const liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
		const receipt = await deposit.wait(1)
		const event = receipt?.events?.find(x => x.event == "Deposit")
		const newBalance = await usd.balanceOf(senderAddress)
		expect(event?.event).to.eq("Deposit")
		expect(balance.sub(newBalance)).to.eq(toUSDC(liquidityPoolUsdcDeposit))
		expect(liquidityPoolBalance.toString()).to.eq(toWei(liquidityPoolUsdcDeposit))
	})

	it("Removes from liquidityPool with no options written", async () => {
		const lpSharesBalance = await liquidityPool.balanceOf(senderAddress)
		await liquidityPool.withdraw(toWei(liquidityPoolUsdcWithdraw), senderAddress)
		const newLpSharesBalance = await liquidityPool.balanceOf(senderAddress)
		const expectedBalance = (
			parseFloat(liquidityPoolUsdcDeposit) - parseFloat(liquidityPoolUsdcWithdraw)
		).toString()
		expect(newLpSharesBalance).to.eq(toWei(expectedBalance))
		expect(lpSharesBalance.sub(newLpSharesBalance)).to.eq(toWei(liquidityPoolUsdcWithdraw))
	})

	it("Adds additional liquidity from new account", async () => {
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
	})
	it("LP Writes a ETH/USD put for premium", async () => {
		const [sender] = signers
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block
		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		const proposedSeries = {
			expiration: expiration,
			strike: BigNumber.from(strikePrice),
			isPut: PUT_FLAVOR,
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const poolBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await usd.approve(handler.address, quote)
		const balance = await usd.balanceOf(senderAddress)
		const seriesAddress = (await handler.callStatic.issueAndWriteOption(proposedSeries, amount)).series
		const write = await handler.issueAndWriteOption(proposedSeries, amount)
		const poolBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
		const putBalance = await putOptionToken.balanceOf(senderAddress)
		const registryUsdBalance = await liquidityPool.collateralAllocated()
		const balanceNew = await usd.balanceOf(senderAddress)
		const opynAmount = toOpyn(fromWei(amount))
		const localDelta = await calculateOptionDeltaLocally(
			liquidityPool,
			priceFeed,
			proposedSeries,
			amount,
			true
		)
		await portfolioValuesFeed.fulfill(
			utils.formatBytes32String("2"),
			weth.address,
			usd.address,
			localDelta,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(quote),
			BigNumber.from(priceQuote)
		)
		expect(putBalance).to.eq(opynAmount)
		// ensure funds are being transfered
		expect(tFormatUSDC(balance.sub(balanceNew), 2)).to.eq(tFormatEth(quote, 2))
	})
	it("LP can redeem shares", async () => {
		const senderSharesBefore = await liquidityPool.balanceOf(senderAddress)
		expect(senderSharesBefore).to.be.gt(0)
		const senderUsdcBefore = await usd.balanceOf(senderAddress)
		const receiverSharesBefore = await liquidityPool.balanceOf(receiverAddress)
		expect(receiverSharesBefore).to.be.gt(0)
		const totalSharesBefore = await liquidityPool.totalSupply()
		const usdBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const withdraw = await liquidityPool.withdraw(senderSharesBefore, senderAddress)
		const receipt = await withdraw.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "Withdraw")
		const strikeAmount = removeEvent?.args?.strikeAmount
		const usdBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const receiverUsd = await usd.balanceOf(receiverAddress)
		const senderUsdcAfter = await usd.balanceOf(senderAddress)
		const senderSharesAfter = await liquidityPool.balanceOf(senderAddress)
		const totalSharesAfter = await liquidityPool.totalSupply()
		//@ts-ignore
		const diff = usdBalanceBefore - usdBalanceAfter
		expect(
			Number(
				fromUSDC(
					diff -
						toUSDC(
							(parseInt(liquidityPoolUsdcDeposit) * 2 - parseInt(liquidityPoolUsdcWithdraw)).toString()
						).toNumber()
				)
			)
		).to.be.within(-20, 20)
		expect(
			Number(
				fromUSDC(
					senderUsdcAfter
						.sub(senderUsdcBefore)
						.sub(
							toUSDC(
								(parseInt(liquidityPoolUsdcDeposit) * 2 - parseInt(liquidityPoolUsdcWithdraw)).toString()
							)
						)
				)
			)
		).to.be.within(-20, 20)
		expect(senderUsdcAfter.sub(senderUsdcBefore)).to.be.eq(strikeAmount)
		expect(senderSharesAfter).to.eq(0)
		expect(totalSharesBefore.sub(totalSharesAfter)).to.be.eq(senderSharesBefore)
		expect(totalSharesAfter).to.be.eq(receiverSharesBefore)
	})
	it("LP can not redeems shares when in excess of liquidity", async () => {
		const [sender, receiver] = signers

		const shares = await liquidityPool.balanceOf(receiverAddress)
		const liquidityPoolReceiver = liquidityPool.connect(receiver)
		const withdraw = liquidityPoolReceiver.withdraw(shares, receiverAddress)
		await expect(withdraw).to.be.revertedWith("WithdrawExceedsLiquidity()")
	})
})
