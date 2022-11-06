import hre, { ethers, network } from "hardhat"
import { Signer, BigNumber, BigNumberish } from "ethers"
import { expect } from "chai"
import { truncate } from "@ragetrade/sdk"
import { toUSDC, toWei } from "../utils/conversion-helper"
import { MintableERC20 } from "../types/MintableERC20"
import { PerpHedgingReactor } from "../types/PerpHedgingReactor"
import dotenv from "dotenv"
dotenv.config()
//@ts-ignore

import { OracleMock } from "../types/OracleMock"
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER } from "./constants"
import { PriceFeed } from "../types/PriceFeed"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import { priceToSqrtPriceX96, sqrtPriceX96ToPrice, sqrtPriceX96ToTick } from "../utils/price-tick"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { ERC20, LiquidityPool } from "../types"

let signers: Signer[]
let usdcWhale: Signer
let liquidityPool: LiquidityPool
const liquidityPoolAddress: string = "0xC10B976C671Ce9bFf0723611F01422ACbAe100A5"
const usdcAddress: string = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
let usdc: ERC20
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
let collateralId: string
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

// edit depending on the chain id to be tested on
const chainId = 42161
const USDC_SCALE = "1000000000000"
const e18 = "1000000000000000000"

describe("GMX Hedging Reactor", () => {
	before(async function () {
		await network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						jsonRpcUrl: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA}`,
						chainId: 42161,
						blockNumber: 29712933
					}
				}
			]
		})
	})

	it("obtains Rysk contracts", async () => {
		signers = await ethers.getSigners()
		const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress)

		expect(liquidityPool).to.have.property("setHedgingReactorAddress")
		expect(liquidityPool).to.have.property("rebalancePortfolioDelta")
		usdc = (await ethers.getContractAt("contracts/tokens/ERC20.sol:ERC20", usdcAddress)) as ERC20
		const liquidityPoolBalance = await usdc.balanceOf(liquidityPoolAddress)
		console.log({ liquidityPoolBalance })
	})
})
