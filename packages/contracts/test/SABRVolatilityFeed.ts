import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"
import { CHAINLINK_WETH_PRICER, ADDRESS_BOOK } from "./constants"
import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { deployOpyn } from "../utils/opyn-deployer"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import {
	AlphaPortfolioValuesFeed,
	BeyondPricer,
	LiquidityPool,
	MintableERC20,
	MockChainlinkAggregator,
	OptionCatalogue,
	OptionExchange,
	OptionRegistry,
	Oracle,
	PriceFeed,
	Protocol,
	VolatilityFeed,
	ERC20,
	WETH
} from "../types"
import { tFormatEth, toWei } from "../utils/conversion-helper"
import { increaseTo, setupTestOracle } from "./helpers"

dayjs.extend(utc)

let usd: MintableERC20
let weth: WETH
let signers: Signer[]
let volFeed: VolatilityFeed
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract

let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let senderAddress: string
let receiverAddress: string
let liquidityPool: LiquidityPool
let portfolioValuesFeed: AlphaPortfolioValuesFeed
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let exchange: OptionExchange
let pricer: BeyondPricer
let catalogue: OptionCatalogue
let authority: string

// get the expiration to use
let start = dayjs.utc().add(8, "hours").unix()
let expiration = dayjs.utc().add(30, "days").add(8, "hours").unix()
// edit depending on the chain id to be tested on
const chainId = 1

describe("Volatility Feed", async () => {
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
		oracle = opynParams.oracle
		const [sender] = signers

		// get the oracle
		const res = await setupTestOracle(await sender.getAddress())
		oracle = res[0] as Oracle
		opynAggregator = res[1] as MockChainlinkAggregator
		let deployParams = await deploySystem(signers, opynAggregator)
		weth = deployParams.weth
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
			weth,
			optionRegistry,
			portfolioValuesFeed,
			volFeed,
			authority
		)
		liquidityPool = lpParams.liquidityPool
		exchange = lpParams.exchange
		pricer = lpParams.pricer
		catalogue = lpParams.catalogue

		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
	})
	before(async function () {
		signers = await ethers.getSigners()
		const erc20Factory = await ethers.getContractFactory(
			"contracts/tokens/MintableERC20.sol:MintableERC20"
		)

		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)
		const authorityFactory = await hre.ethers.getContractFactory("Authority")

		const senderAddress = await signers[0].getAddress()
		const authority = await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)

		await priceFeed.addPriceFeed(weth.address, usd.address, ethUSDAggregator.address)
		const feedAddress = await priceFeed.priceFeeds(weth.address, usd.address)
		expect(feedAddress).to.eq(ethUSDAggregator.address)

		await increaseTo(start)
	})
	describe("VolatilityFeed: setup", async () => {
		it("SETUP: set price quote", async () => {
			const rate = "119887500000"
			await ethUSDAggregator.mock.latestRoundData.returns(
				"55340232221128660932",
				rate,
				BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
				BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
				"55340232221128660932"
			)
			const quote = await priceFeed.getRate(weth.address, usd.address)
			expect(quote).to.eq(rate)
		})
		it("SETUP: set sabrParams", async () => {
			const proposedSabrParams = {
				callAlpha: 250000,
				callBeta: 1000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			}
			await exchange.pause()
			await volFeed.setSabrParameters(proposedSabrParams, expiration)
			await exchange.unpause()
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
			const expiries = await volFeed.getExpiries()
			expect(expiries.length).to.equal(2)
		})
		it("SETUP: set sabrParams", async () => {
			const proposedSabrParams = {
				callAlpha: 250000,
				callBeta: 1000000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 1000000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			}
			await exchange.pause()
			await volFeed.setSabrParameters(proposedSabrParams, expiration)
			await exchange.unpause()
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
			const expiries = await volFeed.getExpiries()
			expect(expiries.length).to.equal(2)
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
			const expiry = expiration + 10
			await exchange.pause()
			await volFeed.setSabrParameters(proposedSabrParams, expiry)
			await exchange.unpause()
			const volFeedSabrParams = await volFeed.sabrParams(expiry)
			expect(proposedSabrParams.callAlpha).to.equal(volFeedSabrParams.callAlpha)
			expect(proposedSabrParams.callBeta).to.equal(volFeedSabrParams.callBeta)
			expect(proposedSabrParams.callRho).to.equal(volFeedSabrParams.callRho)
			expect(proposedSabrParams.callVolvol).to.equal(volFeedSabrParams.callVolvol)
			expect(proposedSabrParams.putAlpha).to.equal(volFeedSabrParams.putAlpha)
			expect(proposedSabrParams.putBeta).to.equal(volFeedSabrParams.putBeta)
			expect(proposedSabrParams.putRho).to.equal(volFeedSabrParams.putRho)
			expect(proposedSabrParams.putVolvol).to.equal(volFeedSabrParams.putVolvol)
			expect(proposedSabrParams.interestRate).to.equal(volFeedSabrParams.interestRate)
			const expiries = await volFeed.getExpiries()
			expect(expiries.length).to.equal(3)
		})
	})
	describe("VolatilityFeed: get implied volatility", async () => {
		it("SUCCEEDS: get implied volatility for different strikes", async () => {
			const underlyingPrice = toWei("100")
			const strikePrices = [60, 80, 100, 120, 140, 160]
			const ivs = [0.4638, 0.3363, 0.2518, 0.2601, 0.3087, 0.356]
			for (let i = 0; i < strikePrices.length; i++) {
				const iv = await volFeed.getImpliedVolatility(
					false,
					underlyingPrice,
					toWei(strikePrices[i].toString()),
					expiration
				)
				expect(tFormatEth(iv) - ivs[i]).to.be.within(-0.0025, 0.0025)
			}
		})
		it("REVERTS: when strike is zero", async () => {
			const underlyingPrice = toWei("100")
			const strikePrice = 0
			await expect(
				volFeed.getImpliedVolatility(false, underlyingPrice, toWei(strikePrice.toString()), expiration)
			).to.be.revertedWithCustomError(volFeed, "IVNotFound")
		})
		it("REVERTS: when price is zero", async () => {
			const underlyingPrice = toWei("0")
			const strikePrice = 160
			await expect(
				volFeed.getImpliedVolatility(false, underlyingPrice, toWei(strikePrice.toString()), expiration)
			).to.be.revertedWithCustomError(volFeed, "IVNotFound")
		})
	})
	describe("VolatilityFeed: setters", async () => {
		it("SUCCEEDS: set keeper", async () => {
			let receiver = await signers[1].getAddress()
			await volFeed.setKeeper(receiver, true)
			expect(await volFeed.keeper(receiver)).to.be.true
		})
		it("REVERTS: cannot set keeper if not governor", async () => {
			let receiver = await signers[1].getAddress()
			await expect(
				volFeed.connect(signers[1]).setKeeper(receiver, true)
			).to.be.revertedWithCustomError(volFeed, "UNAUTHORIZED")
		})
		it("SUCCEEDS: set sabrParams", async () => {
			await exchange.pause()
			await volFeed.connect(signers[1]).setSabrParameters(
				{
					callAlpha: 1,
					callBeta: 1,
					callRho: 1,
					callVolvol: 1,
					putAlpha: 1,
					putBeta: 1,
					putRho: 1,
					putVolvol: 1,
					interestRate: utils.parseEther("-0.001")
				},
				10
			)
			await exchange.unpause()
			expect((await volFeed.sabrParams(10)).callAlpha).to.equal(1)
			expect((await volFeed.sabrParams(10)).callAlpha).to.equal(1)
		})
		it("REVERTS: cannot set invalid sabrParams", async () => {
			await exchange.pause()
			await expect(
				volFeed.setSabrParameters(
					{
						callAlpha: 0,
						callBeta: 1,
						callRho: 1,
						callVolvol: 1,
						putAlpha: 1,
						putBeta: 1,
						putRho: 1,
						putVolvol: 1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "AlphaError")
			// This test may not run because 'callAlpha' is an out of bounds value, which confirms the purpose of the parameter.
			try {
				await expect(
					volFeed.setSabrParameters(
						{
							callAlpha: (2 ** 31).toString(), // max value is 2 ** 31 - 1
							callBeta: 1,
							callRho: 1,
							callVolvol: 1,
							putAlpha: 1,
							putBeta: 1,
							putRho: 1,
							putVolvol: 1,
							interestRate: utils.parseEther("-0.001")
						},
						10
					)
				).to.be.reverted
			} catch (e) {
				expect(e.reason).to.equal("value out-of-bounds")
			}
			// Test may not run because out of bounds value is being passed in.
			try {
				await expect(
					volFeed.setSabrParameters(
						{
							callAlpha: 1,
							callBeta: 1,
							callRho: 1,
							callVolvol: 1,
							putAlpha: 2 ** 31, // max value is 2 ** 31 - 1
							putBeta: 1,
							putRho: 1,
							putVolvol: 1,
							interestRate: utils.parseEther("-0.001")
						},
						10
					)
				).to.be.reverted
			} catch (e) {
				expect(e.reason).to.equal("value out-of-bounds")
			}
			await expect(
				volFeed.setSabrParameters(
					{
						callAlpha: 1,
						callBeta: 1,
						callRho: 1,
						callVolvol: -2,
						putAlpha: 1,
						putBeta: 1,
						putRho: 1,
						putVolvol: 1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "VolvolError")
			await expect(
				volFeed.setSabrParameters(
					{
						callAlpha: 1,
						callBeta: 1,
						callRho: 1,
						callVolvol: 1,
						putAlpha: 1,
						putBeta: 1_100000,
						putRho: 1,
						putVolvol: 1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "BetaError")
			await expect(
				volFeed.setSabrParameters(
					{
						callAlpha: 1,
						callBeta: 1,
						callRho: 1,
						callVolvol: 1,
						putAlpha: 1,
						putBeta: 0,
						putRho: 1,
						putVolvol: 1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "BetaError")
			await expect(
				volFeed.setSabrParameters(
					{
						callAlpha: 1,
						callBeta: 1,
						callRho: 1,
						callVolvol: 0,
						putAlpha: 1,
						putBeta: 1,
						putRho: 1,
						putVolvol: 1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "VolvolError")
			await expect(
				volFeed.setSabrParameters(
					{
						callAlpha: 1,
						callBeta: 1,
						callRho: 1,
						callVolvol: 1,
						putAlpha: 1,
						putBeta: 1,
						putRho: 1,
						putVolvol: -1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "VolvolError")
			await expect(
				volFeed.setSabrParameters(
					{
						callAlpha: 1,
						callBeta: 1,
						callRho: -1_000000,
						callVolvol: 1,
						putAlpha: 1,
						putBeta: 1,
						putRho: 1,
						putVolvol: 1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "RhoError")
			await expect(
				volFeed.setSabrParameters(
					{
						callAlpha: 1,
						callBeta: 1,
						callRho: 1,
						callVolvol: 1,
						putAlpha: 1,
						putBeta: 1,
						putRho: 1_000001,
						putVolvol: 1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "RhoError")
		})
		it("REVERTS: cannot set sabrParams if not keeper", async () => {
			await expect(
				volFeed.connect(signers[2]).setSabrParameters(
					{
						callAlpha: 1,
						callBeta: 1,
						callRho: 1,
						callVolvol: 1,
						putAlpha: 1,
						putBeta: 1,
						putRho: 1,
						putVolvol: 1,
						interestRate: utils.parseEther("-0.001")
					},
					10
				)
			).to.be.revertedWithCustomError(volFeed, "NotKeeper")
		})
	})
	describe("Set beta != 1", async () => {
		it("SUCCEEDS: set sabrParams", async () => {
			const proposedSabrParams = {
				callAlpha: 250000,
				callBeta: 800000,
				callRho: -300000,
				callVolvol: 1_500000,
				putAlpha: 250000,
				putBeta: 800000,
				putRho: -300000,
				putVolvol: 1_500000,
				interestRate: utils.parseEther("-0.001")
			}
			await volFeed.setSabrParameters(proposedSabrParams, expiration)
			await exchange.unpause()
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
		it("SUCCEEDS: get implied volatility for different strikes", async () => {
			const underlyingPrice = toWei("100")
			const strikePrices = [60, 80, 100, 120, 140, 160]
			const ivs = [0.31462, 0.19636, 0.10078, 0.13845, 0.19229, 0.23648]
			for (let i = 0; i < strikePrices.length; i++) {
				const iv = await volFeed.getImpliedVolatility(
					false,
					underlyingPrice,
					toWei(strikePrices[i].toString()),
					expiration
				)
				expect(tFormatEth(iv) - ivs[i]).to.be.within(-0.0011, 0.0011)
			}
		})
	})
})
