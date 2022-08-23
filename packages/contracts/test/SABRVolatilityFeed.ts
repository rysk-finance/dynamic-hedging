import hre, { ethers } from "hardhat"
import { Signer, BigNumber } from "ethers"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { expect } from "chai"
import { MintableERC20 } from "../types/MintableERC20"
import { PriceFeed } from "../types/PriceFeed"
import { VolatilityFeed } from "../types/VolatilityFeed"
import { SABR } from "../types/SABR"
import { WETH } from "../types/WETH"
import { USDC_ADDRESS, WETH_ADDRESS } from "./constants"
import { toWei, tFormatEth } from "../utils/conversion-helper"
import moment from "moment"
import {
	increaseTo,
} from "./helpers"
let usd: MintableERC20
let weth: WETH
let signers: Signer[]
let volFeed: VolatilityFeed
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
// edit depending on the chain id to be tested on
const chainId = 1
// get the expiration to use
const expiryDate: string = "2022-04-05"
let start = moment.utc(expiryDate).add(8, "h").valueOf() / 1000
let expiration = moment.utc(expiryDate).add(30, "d").add(8, "h").valueOf() / 1000

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
        signers = await ethers.getSigners()
		weth = (await ethers.getContractAt(
			"contracts/interfaces/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		usd = (await ethers.getContractAt("contracts/tokens/ERC20.sol:ERC20", USDC_ADDRESS[chainId])) as MintableERC20
		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)
		const authorityFactory = await hre.ethers.getContractFactory("Authority")
		const senderAddress = await signers[0].getAddress()
		const authority = await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)
        // deploy price feed
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		priceFeed = (await priceFeedFactory.deploy(authority.address)) as PriceFeed
		await priceFeed.addPriceFeed(weth.address, usd.address, ethUSDAggregator.address)
		const feedAddress = await priceFeed.priceFeeds(weth.address, usd.address)
		expect(feedAddress).to.eq(ethUSDAggregator.address)
        // deploy vol feed
		// deploy libraries
		const sabrFactory = await hre.ethers.getContractFactory("SABR")
		const sabr = await sabrFactory.deploy()
        const volFeedFactory = await ethers.getContractFactory("VolatilityFeed", {
			libraries: {
				SABR: sabr.address
			}
		})
        volFeed = (await volFeedFactory.deploy(authority.address)) as VolatilityFeed
		await increaseTo(start)
	})
	describe("VolatilityFeed: setup", async () => {
		it("SETUP: set price quote", async () => {
			const rate = "10000000000"
			await ethUSDAggregator.mock.latestRoundData.returns(
				"55340232221128660932",
				rate,
				"1607534965",
				"1607535064",
				"55340232221128660932"
			)
			const quote = await priceFeed.getRate(weth.address, usd.address)
			expect(quote).to.eq(rate)
		})
		it("SETUP: set sabrParams", async () => {
			const proposedSabrParams = 
			{
				callAlpha:250000,
				callBeta:1_000000,
				callRho:-300000,
				callVolvol:1_500000,
				putAlpha:250000,
				putBeta:1_000000,
				putRho:300000,
				putVolvol:1_500000
			}
			await volFeed.setSabrParameters(
				proposedSabrParams, 
				expiration
			)
			const volFeedSabrParams = await volFeed.sabrParams(expiration)
			expect(proposedSabrParams.callAlpha).to.equal(volFeedSabrParams.callAlpha)
			expect(proposedSabrParams.callBeta).to.equal(volFeedSabrParams.callBeta)
			expect(proposedSabrParams.callRho).to.equal(volFeedSabrParams.callRho)
			expect(proposedSabrParams.callVolvol).to.equal(volFeedSabrParams.callVolvol)
			expect(proposedSabrParams.putAlpha).to.equal(volFeedSabrParams.putAlpha)
			expect(proposedSabrParams.putBeta).to.equal(volFeedSabrParams.putBeta)
			expect(proposedSabrParams.putRho).to.equal(volFeedSabrParams.putRho)
			expect(proposedSabrParams.putVolvol).to.equal(volFeedSabrParams.putVolvol)
        })
	})
	describe("VolatilityFeed: get implied volatility", async () => {
		it("SUCCEEDS: get implied volatility for different strikes", async () => {
			
			const underlyingPrice = toWei("100")
			const strikePrices = [60,80,100,120,140,160]
			const ivs = [0.4657, 0.3383, 0.2528, 0.2591, 0.3073, 0.3550]
			for (let i=0; i < strikePrices.length; i++) {
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
    describe("VolatilityFeed: setters", async () => {
        it("SUCCEEDS: set keeper", async () => {
			let receiver = await signers[1].getAddress()
			await volFeed.setKeeper(receiver, true)
			expect(await volFeed.keeper(receiver)).to.be.true
        })
        it("REVERTS: cannot set keeper if not governor", async () => {
			let receiver = await signers[1].getAddress()
            await expect(volFeed.connect(signers[1]).setKeeper(receiver, true)).to.be.revertedWith("UNAUTHORIZED")
        })
		it("SUCCEEDS: set sabrParams", async () => {
			await volFeed.connect(signers[1]).setSabrParameters(
				{
					callAlpha:1,
					callBeta:1,
					callRho:1,
					callVolvol:1,
					putAlpha:1,
					putBeta:1,
					putRho:1,
					putVolvol:1
				}, 
				10
				)
			expect((await volFeed.sabrParams(10)).callAlpha).to.equal(1)
			expect((await volFeed.sabrParams(10)).callAlpha).to.equal(1)
        })
        it("REVERTS: cannot set sabrParams if not keeper", async () => {
			await expect(volFeed.connect(signers[2]).setSabrParameters(
				{
					callAlpha:1,
					callBeta:1,
					callRho:1,
					callVolvol:1,
					putAlpha:1,
					putBeta:1,
					putRho:1,
					putVolvol:1
				}, 
				10
				)).to.be.revertedWith("NotKeeper()")
        })
    })
})
