// File to add liquidity and sell a handful of options to bootstrap some initial state in the protocol
// Only use on testnet

// run this script as-is to deposit liquidity and sell options
// only call sellOptions to use existing liquidity (bottom of file)

import { ethers } from "hardhat"
import { BigNumber, utils } from "ethers"
import moment from "moment"
import dotenv from "dotenv"
import { toWei, toUSDC } from "../../utils/conversion-helper"
import { calculateOptionQuoteLocally } from "../../test/helpers"
import { LiquidityPool } from "../../types/LiquidityPool"
import { OptionRegistry } from "../../types/OptionRegistry"
import { MintableERC20 } from "../../types/MintableERC20"
import { PriceFeed } from "../../types/PriceFeed"
dotenv.config()

// arbitrum rinkeby addresses
const liquidityPoolAddress = "0xA7f49544f51f46E3bA2099A3aCad70502b8bc125"
const optionRegistryAddress = "0xA6005cAcF024404d4335751d4dE8c23ff6EC5214"
const usdcAddress = "0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737"
const pvFeedAddress = "0x540932Ac16341384E273bDf888806F001003560B"
const priceFeedAddress = "0xDbBF84a29515C783Ea183f92120be7Aa9120fA23"
const wethAddress = "0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
const handlerAddress = "0xC50bC3833C744dC115c71D3754f2BB0dc1F392eD"

const deployer = new ethers.Wallet(
	process.env.DEPLOYER_PRIVATE_KEY as string,
	new ethers.providers.InfuraProvider("arbitrum-rinkeby")
)

const deposit = async () => {
	const depositAmount = toUSDC("1000000")
	const balance = await deployer.getBalance()
	const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress, deployer)
	const usdc = await ethers.getContractAt("MockERC20", usdcAddress, deployer)
	console.log({ balance: ethers.utils.formatEther(balance) })
	await usdc.approve(liquidityPool.address, depositAmount)

	await liquidityPool.deposit(depositAmount, {
		gasLimit: BigNumber.from("1000000000")
	})

	await liquidityPool.pauseTradingAndRequest()

	await liquidityPool.executeEpochCalculation()

	await liquidityPool.redeem(toWei("1000000000000000"))
}

const sellOptions = async (strikePrice: number, weeksUntilExpiry: number, isPut: boolean) => {
	console.log({ balance: await deployer.getBalance() })
	const optionHandler = await ethers.getContractAt("OptionHandler", handlerAddress, deployer)
	const usdc = (await ethers.getContractAt("MockERC20", usdcAddress, deployer)) as MintableERC20
	const liquidityPool = (await ethers.getContractAt(
		"LiquidityPool",
		liquidityPoolAddress,
		deployer
	)) as LiquidityPool
	const priceFeed = (await ethers.getContractAt(
		"PriceFeed",
		priceFeedAddress,
		deployer
	)) as PriceFeed

	const amount = toWei("1")
	const todayDate = moment().format("YYYY-MM-DD")
	const expiration = moment.utc(todayDate).add(weeksUntilExpiry, "w").add(8, "h").valueOf() / 1000
	const strikePriceFormatted = toWei(strikePrice.toString())

	const balance = await usdc.balanceOf(liquidityPoolAddress)
	console.log({ balance, expiration, strikePrice, usdcAddress, wethAddress, amount })
	const id = await optionHandler.underlyingAsset()
	console.log({ id })
	const optionSeries = {
		expiration: expiration,
		strike: strikePriceFormatted,
		isPut,
		strikeAsset: usdcAddress,
		underlying: wethAddress,
		collateral: usdcAddress
	}
	const pvFeed = await ethers.getContractAt("PortfolioValuesFeed", pvFeedAddress, deployer)
	const price = await priceFeed.getNormalizedRate(wethAddress, usdcAddress)
	console.log({ price })
	await pvFeed.fulfill(
		utils.formatBytes32String("1"),
		wethAddress,
		usdcAddress,
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		price
	)

	const [quote] = await liquidityPool.quotePriceWithUtilizationGreeks(optionSeries, amount, false)
	console.log({ quote })
	await usdc.approve(optionHandler.address, quote)
	const tx = await optionHandler.issueAndWriteOption(optionSeries, amount)
	await tx.wait()
}

// Deposit liquidity into pool then sell an option series
deposit().then(() => {
	sellOptions(1500, 3, true)
})

// sell an option series without depositing more
// sellOptions(1500, 3, true)
