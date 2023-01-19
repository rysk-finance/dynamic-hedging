import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import { expect } from "chai"
import { BigNumber, Signer } from "ethers"
import hre, { ethers } from "hardhat"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { MintableERC20, MockChainlinkSequencerFeed, PriceFeed, WETH } from "../types"
import { ZERO_ADDRESS } from "../utils/conversion-helper"
import { USDC_ADDRESS, WETH_ADDRESS } from "./constants"

let usd: MintableERC20
let weth: WETH
let signers: Signer[]
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let sequencerUptimeFeed: MockChainlinkSequencerFeed

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
		usd = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDC_ADDRESS[chainId]
		)) as MintableERC20
		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)
		const authorityFactory = await hre.ethers.getContractFactory("Authority")
		const senderAddress = await signers[0].getAddress()
		const authority = await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)
		const priceFeedFactory = await ethers.getContractFactory("contracts/PriceFeed.sol:PriceFeed")
		const sequencerUptimeFeedFactory = await ethers.getContractFactory("MockChainlinkSequencerFeed")
		sequencerUptimeFeed = (await sequencerUptimeFeedFactory.deploy()) as MockChainlinkSequencerFeed
		const _priceFeed = (await priceFeedFactory.deploy(
			authority.address,
			sequencerUptimeFeed.address
		)) as PriceFeed
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
		await ethUSDAggregator.mock.decimals.returns("18")
		const quote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		expect(quote).to.eq(rate)
	})
	it("Should revert for a non-existent price quote", async () => {
		await expect(priceFeed.getRate(ZERO_ADDRESS, usd.address)).to.be.revertedWith(
			"Price feed does not exist"
		)
	})
	it("Should revert for a non-existent normalised price quote", async () => {
		await expect(priceFeed.getNormalizedRate(ZERO_ADDRESS, usd.address)).to.be.revertedWith(
			"Price feed does not exist"
		)
	})
	it("should revert when the Arbitrum Sequencer is down", async () => {
		// set answer to 1 meaning sequencer is down
		await sequencerUptimeFeed.setAnswer(1)

		await expect(priceFeed.getNormalizedRate(weth.address, usd.address)).to.be.revertedWith(
			"SequencerDown()"
		)
	})
	it("should revert when the sequencer is back online but has not completed its grace period", async () => {
		// set answer to 0 meaning sequencer is up
		await sequencerUptimeFeed.setAnswer(0)
		const blockNumber = await ethers.provider.getBlockNumber()
		const blockTime = await (await ethers.provider.getBlock(blockNumber)).timestamp
		await sequencerUptimeFeed.setStartedAt(blockTime)

		// fast forward 29 mins
		await ethers.provider.send("evm_increaseTime", [1740])
		await ethers.provider.send("evm_mine")

		await expect(priceFeed.getNormalizedRate(weth.address, usd.address)).to.be.revertedWith(
			"GracePeriodNotOver()"
		)
	})
	it("should return a price once grade period is over", async () => {
		// fast forward 2 more mins
		await ethers.provider.send("evm_increaseTime", [120])
		await ethers.provider.send("evm_mine")

		const quote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		rate = "567000000000000000000"

		expect(quote).to.eq(rate)
	})
})
