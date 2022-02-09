
import hre, { ethers } from "hardhat"
import {
	Signer,
	BigNumber
} from "ethers"
import {
	deployMockContract,
	MockContract
} from "@ethereum-waffle/mock-contract"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { expect } from "chai"
import { MintableERC20 } from "../types/MintableERC20"
import { PriceFeed } from "../types/PriceFeed"
import { WETH } from "../types/WETH"
import {
	USDC_ADDRESS,
	WETH_ADDRESS,
} from "./constants"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
// edit depending on the chain id to be tested on
const chainId = 1

let usd: MintableERC20
let weth: WETH

let signers: Signer[]

let priceFeed: PriceFeed
let ethUSDAggregator: MockContract

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
			"ERC20",
			USDC_ADDRESS[chainId]
		)) as MintableERC20
		//const Weth = await ethers.getContractFactory(
		//  'contracts/tokens/WETH.sol:WETH',
		// )
		//const wethContract = (await Weth.deploy()) as WETH
		//weth = wethContract
		ethUSDAggregator = await deployMockContract(
			signers[0],
			AggregatorV3Interface.abi
		)

		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(
			ZERO_ADDRESS,
			usd.address,
			ethUSDAggregator.address
		)
		await priceFeed.addPriceFeed(
			weth.address,
			usd.address,
			ethUSDAggregator.address
		)
		const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, usd.address)
		expect(feedAddress).to.eq(ethUSDAggregator.address)
	})

	let rate: string
	it("Should return a price quote", async () => {
		// 567.70 - Chainlink uses 8 decimal places for this pair
		rate = "56770839675"
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			rate,
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		const quote = await priceFeed.getRate(ZERO_ADDRESS, usd.address)
		expect(quote).to.eq(rate)
	})

	it("Should return a normalized price quote", async () => {
		await ethUSDAggregator.mock.decimals.returns("8")
		const quote = await priceFeed.getNormalizedRate(ZERO_ADDRESS, usd.address)
		// get decimal to 18 places
		const expected = BigNumber.from(rate).mul(BigNumber.from(10 ** 10))
		expect(quote).to.eq(expected)
	})
})
