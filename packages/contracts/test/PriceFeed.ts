import hre, { ethers } from "hardhat"
import { Signer, BigNumber } from "ethers"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { expect } from "chai"
import { MintableERC20 } from "../types/MintableERC20"
import { PriceFeed } from "../types/PriceFeed"
import { WETH } from "../types/WETH"
import { USDC_ADDRESS, WETH_ADDRESS } from "./constants"
import { toWei } from "../utils/conversion-helper"
let usd: MintableERC20
let weth: WETH
let signers: Signer[]
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
// edit depending on the chain id to be tested on
const chainId = 1

describe("Price Feed", async () => {
	before(async function () {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						chainId: 1,
						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
						blockNumber: 12821000
					}
				}
			]
		})
	})
	it("Should deploy price feed", async () => {
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
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy(authority.address)) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(weth.address, usd.address, ethUSDAggregator.address)
		const feedAddress = await priceFeed.priceFeeds(weth.address, usd.address)
		expect(feedAddress).to.eq(ethUSDAggregator.address)
	})

	let rate: string
	it("Should return a price quote", async () => {
		// 567.70 - Chainlink uses 8 decimal places for this pair
		rate = "56770839675"
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

	it("Should return a normalized price quote", async () => {
		await ethUSDAggregator.mock.decimals.returns("8")
		const quote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		// get decimal to 18 places
		const expected = BigNumber.from(rate).mul(BigNumber.from(10 ** 10))
		expect(quote).to.eq(expected)
	})
	it("Should return a normalised price quote on e18 decimals", async () => {
		rate = "567000000000000000000"
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			rate,
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await ethUSDAggregator.mock.decimals.returns(
			"18"
		)
		const quote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		expect(quote).to.eq(rate)
	})
	it("Should revert for a non-existent price quote", async () => {
		await expect(priceFeed.getRate(ZERO_ADDRESS, usd.address)).to.be.revertedWith("Price feed does not exist")
	})
	it("Should revert for a non-existent normalised price quote", async () => {
		await expect(priceFeed.getNormalizedRate(ZERO_ADDRESS, usd.address)).to.be.revertedWith("Price feed does not exist")
	})
})
