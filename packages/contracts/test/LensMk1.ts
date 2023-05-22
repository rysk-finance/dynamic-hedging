import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Signer, utils } from "ethers"
import { AbiCoder } from "ethers/lib/utils"
import hre, { ethers, network } from "hardhat"
import {
	CALL_FLAVOR,
	emptySeries,
	PUT_FLAVOR,
	scaleNum,
	toUSDC,
	toWei,
	ZERO_ADDRESS
} from "../utils/conversion-helper"
//@ts-ignore
import { expect } from "chai"
import {
	AddressBook,
	AlphaPortfolioValuesFeed,
	BeyondPricer,
	DHVLensMK1,
	LiquidityPool,
	MintableERC20,
	MockChainlinkAggregator,
	NewController,
	NewMarginCalculator,
	NewWhitelist,
	OptionCatalogue,
	OptionExchange,
	OptionRegistry,
	Oracle,
	Otoken,
	OtokenFactory,
	PriceFeed,
	Protocol,
	UserPositionLensMK1,
	VolatilityFeed,
	WETH
} from "../types"

import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { deployOpyn } from "../utils/opyn-deployer"
import { CHAINLINK_WETH_PRICER, MARGIN_POOL, WETH_ADDRESS } from "./constants"
import { compareQuotes, setOpynOracleExpiryPrice, setupOracle, setupTestOracle } from "./helpers"
dayjs.extend(utc)
let usd: MintableERC20
let weth: WETH
let wethERC20: MintableERC20
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let portfolioValuesFeed: AlphaPortfolioValuesFeed
let volFeed: VolatilityFeed
let priceFeed: PriceFeed
let controller: NewController
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let newWhitelist: NewWhitelist
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let optionToken: Otoken
let oTokenUSDCXC: Otoken
let oTokenUSDCSXC: Otoken
let oTokenUSDC1650C: Otoken
let exchange: OptionExchange
let pricer: BeyondPricer
let authority: string
let catalogue: OptionCatalogue
let lens: DHVLensMK1
let userLens: UserPositionLensMK1

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"

// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = "20"

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "100000"
const liquidityPoolWethDeposit = "1"

// time travel period between each expiry
const productSpotShockValue = scaleNum("0.6", 27)
// array of time to expiry
const day = 60 * 60 * 24
const timeToExpiry = [day * 7, day * 14, day * 28, day * 42, day * 56, day * 84]
// array of upper bound value correspond to time to expiry
const expiryToValue = [
	scaleNum("0.1678", 27),
	scaleNum("0.237", 27),
	scaleNum("0.3326", 27),
	scaleNum("0.4032", 27),
	scaleNum("0.4603", 27),
	scaleNum("0.5", 27)
]

const expiration = dayjs.utc(expiryDate).add(8, "hours").unix()
const expiration2 = dayjs.utc(expiryDate).add(1, "weeks").add(8, "hours").unix() // have another batch of options exire 1 week after the first
const abiCode = new AbiCoder()

describe("Lens", async () => {
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
		let opynParams = await deployOpyn(signers)
		controller = opynParams.controller
		addressBook = opynParams.addressBook
		oracle = opynParams.oracle
		newCalculator = opynParams.newCalculator
		newWhitelist = opynParams.newWhitelist
		const [sender] = signers

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
			optionRegistry,
			portfolioValuesFeed,
			authority
		)
		liquidityPool = lpParams.liquidityPool
		exchange = lpParams.exchange
		catalogue = lpParams.catalogue
		pricer = lpParams.pricer
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
	})
	describe("Setup add-on system features", async () => {
		it("SETUP: set sabrParams", async () => {
			const proposedSabrParams = {
				callAlpha: 250000,
				callBeta: 1_000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1_000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			}
			await volFeed.setSabrParameters(proposedSabrParams, expiration)
			const volFeedSabrParams = await volFeed.sabrParams(expiration)
			expect(proposedSabrParams.callAlpha).to.equal(volFeedSabrParams.callAlpha)
			expect(proposedSabrParams.callBeta).to.equal(volFeedSabrParams.callBeta)
			expect(proposedSabrParams.callRho).to.equal(volFeedSabrParams.callRho)
			expect(proposedSabrParams.callVolvol).to.equal(volFeedSabrParams.callVolvol)
			expect(proposedSabrParams.putAlpha).to.equal(volFeedSabrParams.putAlpha)
			expect(proposedSabrParams.putBeta).to.equal(volFeedSabrParams.putBeta)
			expect(proposedSabrParams.putRho).to.equal(volFeedSabrParams.putRho)
			expect(proposedSabrParams.putVolvol).to.equal(volFeedSabrParams.putVolvol)
			expect(proposedSabrParams.interestRate).to.equal(volFeedSabrParams.interestRate)
		})
		it("SETUP: set sabrParams", async () => {
			const proposedSabrParams = {
				callAlpha: 250000,
				callBeta: 1_000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1_000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			}
			await volFeed.setSabrParameters(proposedSabrParams, expiration + 86400)
		})
		it("SETUP: set sabrParams", async () => {
			const proposedSabrParams = {
				callAlpha: 250000,
				callBeta: 1_000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1_000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.002")
			}
			await volFeed.setSabrParameters(proposedSabrParams, expiration2)
			const volFeedSabrParams = await volFeed.sabrParams(expiration2)
			expect(proposedSabrParams.callAlpha).to.equal(volFeedSabrParams.callAlpha)
			expect(proposedSabrParams.callBeta).to.equal(volFeedSabrParams.callBeta)
			expect(proposedSabrParams.callRho).to.equal(volFeedSabrParams.callRho)
			expect(proposedSabrParams.callVolvol).to.equal(volFeedSabrParams.callVolvol)
			expect(proposedSabrParams.putAlpha).to.equal(volFeedSabrParams.putAlpha)
			expect(proposedSabrParams.putBeta).to.equal(volFeedSabrParams.putBeta)
			expect(proposedSabrParams.putRho).to.equal(volFeedSabrParams.putRho)
			expect(proposedSabrParams.putVolvol).to.equal(volFeedSabrParams.putVolvol)
			expect(proposedSabrParams.interestRate).to.equal(volFeedSabrParams.interestRate)
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
			await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
			const deposit = await liquidityPool.deposit(toUSDC(liquidityPoolUsdcDeposit))
			const receipt = await deposit.wait(1)
			const event = receipt?.events?.find(x => x.event == "Deposit")
			expect(event?.event).to.eq("Deposit")
		})
		it("pauses trading and executes epoch", async () => {
			await liquidityPool.pauseTradingAndRequest()
			await portfolioValuesFeed.fulfill(weth.address, usd.address)
			await liquidityPool.executeEpochCalculation()
			await liquidityPool.redeem(toWei("10000000"))
		})
		it("SETUP: sets the exchange as a hedging reactor", async function () {
			await liquidityPool.setHedgingReactorAddress(exchange.address)
			expect(await liquidityPool.hedgingReactors(0)).to.equal(exchange.address)
		})
		it("can compute portfolio delta", async function () {
			const delta = await liquidityPool.getPortfolioDelta()
			expect(delta).to.equal(0)
		})
		it("SETUP: deploy lens contract", async () => {
			const lensFactory = await ethers.getContractFactory("DHVLensMK1")
			lens = (await lensFactory.deploy(
				optionProtocol.address,
				catalogue.address,
				pricer.address,
				usd.address,
				weth.address,
				usd.address
			)) as DHVLensMK1
		})

		it("SETUP: deploy user lens contract", async () => {
			const lensFactory = await ethers.getContractFactory("UserPositionLensMK1")
			userLens = (await lensFactory.deploy(
				addressBook.address,
			)) as UserPositionLensMK1
		})
	})
	describe("Purchase a bunch of random options", async () => {
		it("SETUP: approve series", async () => {
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			await catalogue.issueNewSeries([
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: BigNumber.from(strikePrice),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration + 86400,
					isPut: CALL_FLAVOR,
					strike: BigNumber.from(strikePrice),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration2,
					isPut: CALL_FLAVOR,
					strike: BigNumber.from(strikePrice),
					isSellable: false,
					isBuyable: true
				},
				{
					expiration: expiration2,
					isPut: CALL_FLAVOR,
					strike: toWei("1750"),
					isSellable: false,
					isBuyable: false
				},
				{
					expiration: expiration2 + 86400,
					isPut: CALL_FLAVOR,
					strike: toWei("1750"),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: toWei("1750"),
					isSellable: true,
					isBuyable: true
				},
				{
					expiration: expiration,
					isPut: CALL_FLAVOR,
					strike: toWei("1650"),
					isSellable: true,
					isBuyable: true
				}
			])
		})
		it("buy option", async () => {
			const amount = toWei("5")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: expiration,
				strike: BigNumber.from(strikePrice),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			await usd.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 0,
							owner: ZERO_ADDRESS,
							secondAddress: ZERO_ADDRESS,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: 0,
							optionSeries: proposedSeries,
							indexOrAcceptablePremium: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries,
							indexOrAcceptablePremium: toWei("10"),
							data: "0x"
						}
					]
				}
			])
		})
		it("SUCCEEDS: Sender sets exchange as an operator", async () => {
			await controller.setOperator(exchange.address, true)
			expect(await controller.isOperator(senderAddress, exchange.address))
		})
		it("SUCCEEDS: LP Sells a ETH/USD call for premium with otoken created outside", async () => {
			const amount = toWei("5")
			const strikePrice = toWei("1750")
			const proposedSeries = {
				expiration: expiration,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				optionProtocol,
				volFeed,
				priceFeed,
				proposedSeries,
				amount,
				true,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			let quote = quoteResponse[0].sub(quoteResponse[2])
			const otokenFactory = (await ethers.getContractAt(
				"OtokenFactory",
				await addressBook.getOtokenFactory()
			)) as OtokenFactory
			const otoken = await otokenFactory.callStatic.createOtoken(
				proposedSeries.underlying,
				proposedSeries.strikeAsset,
				proposedSeries.collateral,
				proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
				proposedSeries.expiration,
				proposedSeries.isPut
			)
			await otokenFactory.createOtoken(
				proposedSeries.underlying,
				proposedSeries.strikeAsset,
				proposedSeries.collateral,
				proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
				proposedSeries.expiration,
				proposedSeries.isPut
			)
			const marginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: proposedSeries.expiration,
						strike: proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: proposedSeries.isPut,
						strikeAsset: proposedSeries.strikeAsset,
						underlying: proposedSeries.underlying,
						collateral: proposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							indexOrAcceptablePremium: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: proposedSeries.collateral,
							vaultId: vaultId,
							amount: marginRequirement,
							optionSeries: emptySeries,
							indexOrAcceptablePremium: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: vaultId,
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							indexOrAcceptablePremium: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries,
							indexOrAcceptablePremium: 0,
							data: "0x"
						}
					]
				}
			])
		})
		it("SUCCEEDS: LP Sells a ETH/USD call for premium with otoken created outside", async () => {
			const amount = toWei("5")
			const strikePrice = toWei("1650")
			const proposedSeries = {
				expiration: expiration,
				strike: strikePrice,
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			let quoteResponse = await pricer.quoteOptionPrice(proposedSeries, amount, true, 0)
			await compareQuotes(
				quoteResponse,
				liquidityPool,
				optionProtocol,
				volFeed,
				priceFeed,
				proposedSeries,
				amount,
				true,
				exchange,
				optionRegistry,
				usd,
				pricer,
				toWei("0")
			)
			let quote = quoteResponse[0].sub(quoteResponse[2])
			const otokenFactory = (await ethers.getContractAt(
				"OtokenFactory",
				await addressBook.getOtokenFactory()
			)) as OtokenFactory
			const otoken = await otokenFactory.callStatic.createOtoken(
				proposedSeries.underlying,
				proposedSeries.strikeAsset,
				proposedSeries.collateral,
				proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
				proposedSeries.expiration,
				proposedSeries.isPut
			)
			await otokenFactory.createOtoken(
				proposedSeries.underlying,
				proposedSeries.strikeAsset,
				proposedSeries.collateral,
				proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
				proposedSeries.expiration,
				proposedSeries.isPut
			)
			const marginRequirement = await (
				await optionRegistry.getCollateral(
					{
						expiration: proposedSeries.expiration,
						strike: proposedSeries.strike.div(ethers.utils.parseUnits("1", 10)),
						isPut: proposedSeries.isPut,
						strikeAsset: proposedSeries.strikeAsset,
						underlying: proposedSeries.underlying,
						collateral: proposedSeries.collateral
					},
					amount
				)
			).add(toUSDC("100"))
			await usd.approve(MARGIN_POOL[chainId], marginRequirement)
			const vaultId = await (await controller.getAccountVaultCounter(senderAddress)).add(1)
			await exchange.operate([
				{
					operation: 0,
					operationQueue: [
						{
							actionType: 0,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: vaultId,
							amount: 0,
							optionSeries: emptySeries,
							indexOrAcceptablePremium: 0,
							data: abiCode.encode(["uint256"], [1])
						},
						{
							actionType: 5,
							owner: senderAddress,
							secondAddress: senderAddress,
							asset: proposedSeries.collateral,
							vaultId: vaultId,
							amount: marginRequirement,
							optionSeries: emptySeries,
							indexOrAcceptablePremium: 0,
							data: ZERO_ADDRESS
						},
						{
							actionType: 1,
							owner: senderAddress,
							secondAddress: exchange.address,
							asset: otoken,
							vaultId: vaultId,
							amount: amount.div(ethers.utils.parseUnits("1", 10)),
							optionSeries: emptySeries,
							indexOrAcceptablePremium: 0,
							data: ZERO_ADDRESS
						}
					]
				},
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 2,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries,
							indexOrAcceptablePremium: 0,
							data: "0x"
						}
					]
				}
			])
		})
		it("buy option", async () => {
			const amount = toWei("5")
			const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
			const strikePrice = priceQuote.add(toWei(strike))
			const proposedSeries = {
				expiration: expiration + 86400,
				strike: BigNumber.from(strikePrice),
				isPut: CALL_FLAVOR,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			await usd.approve(exchange.address, amount)
			await exchange.operate([
				{
					operation: 1,
					operationQueue: [
						{
							actionType: 0,
							owner: ZERO_ADDRESS,
							secondAddress: ZERO_ADDRESS,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: 0,
							optionSeries: proposedSeries,
							indexOrAcceptablePremium: 0,
							data: "0x"
						},
						{
							actionType: 1,
							owner: ZERO_ADDRESS,
							secondAddress: senderAddress,
							asset: ZERO_ADDRESS,
							vaultId: 0,
							amount: amount,
							optionSeries: proposedSeries,
							indexOrAcceptablePremium: toWei("10"),
							data: "0x"
						}
					]
				}
			])
		})
		describe("Hit the user Lens", async () => {
			it("ping the lens contract", async () => {
				const lensVals = await userLens.getVaultsForUser(senderAddress)
				console.log({lensVals})
			})
		})
		describe("Hit the Lens", async () => {
			it("ping the lens contract", async () => {
				const lensVals = await lens.getOptionChain()
				// console.log({lensVals})
				// console.log("c0")
				// console.log(lensVals.optionExpirationDrills[0].callOptionDrill)
				// console.log("p0")
				// console.log(lensVals.optionExpirationDrills[0].putOptionDrill)
				// console.log("c1")
				// console.log(lensVals.optionExpirationDrills[1].callOptionDrill)
				// console.log("c2")
				// console.log(lensVals.optionExpirationDrills[2].callOptionDrill)
				// console.log("c3")
				// console.log(lensVals.optionExpirationDrills[3].callOptionDrill)
			})
			it("ping the lens contract", async () => {
				const lensVals = await lens.getExpirations()
				for (let i = 0; i < lensVals.length; i++) {
					const con = await lens.getOptionExpirationDrill(lensVals[i])
					// console.log(con)
				}
			})
		})
		describe("Settles and redeems usd otoken", async () => {
			it("fastforward", async () => {
				optionToken = oTokenUSDCXC
				const totalCollateralAllocated = await liquidityPool.collateralAllocated()
				const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
				const strikePrice = toWei("1000").div(oTokenDecimalShift18)
				const settlePrice = strikePrice.add(toWei("80").div(oTokenDecimalShift18))
				// set the option expiry price, make sure the option has now expired
				await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration + 86400, settlePrice)
			})
		})
		describe("Hit the Lens", async () => {
			it("ping the lens contract", async () => {
				const lensVals = await lens.getOptionChain()
				// console.log({lensVals})
			})
		})

		describe("Hit the user Lens", async () => {
			it("ping the lens contract", async () => {
				const lensVals = await userLens.getVaultsForUser(senderAddress)
				console.log({lensVals})
			})
			it("ping the lens contract other func", async () => {
				const lensValsI = await userLens.getVaultsForUser(senderAddress)
				const lensVals = await userLens.getVaultsForUserAndOtoken(senderAddress, lensValsI[1].otoken)
				console.log({lensVals})
				console.log(await userLens.getVaultsForUserAndOtoken(senderAddress, senderAddress))
			})
		})

	})
})
