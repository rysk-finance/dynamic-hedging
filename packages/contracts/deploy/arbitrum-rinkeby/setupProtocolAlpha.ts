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

// arbitrum rinkeby alpha addresses
const liquidityPoolAddress = "0x022601eB546e007562A6dD4AE4840544E6B85c9B"
const usdcAddress = "0x33a010E74A354bd784a62cca3A4047C1A84Ceeab"
const pvFeedAddress = "0x4D2f15471F0d60474d7B1953a27f2c9d642B91C1"
const priceFeedAddress = "0x27F70AC0453254B3CaA0A0400dB78387c474FAdD"
const wethAddress = "0xFCfbfcC11d12bCf816415794E5dc1BBcc5304e01"
const handlerAddress = "0x1c4dB5B6028EE95ad4E07cf83F3AcC797f478125"

const deployer = new ethers.Wallet(
	process.env.DEPLOYER_PRIVATE_KEY as string,
	new ethers.providers.InfuraProvider("arbitrum-rinkeby")
)

console.log({ deployer: deployer.address })

const deposit = async () => {
	const depositAmount = toUSDC("1000000")
	const balance = await deployer.getBalance()
	const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress, deployer)
	const usdc = await ethers.getContractAt("MockERC20", usdcAddress, deployer)
	const priceFeed = (await ethers.getContractAt(
		"PriceFeed",
		priceFeedAddress,
		deployer
	)) as PriceFeed
	console.log({ balance: ethers.utils.formatEther(balance) })
	await usdc.approve(liquidityPool.address, depositAmount)

	const pvFeed = await ethers.getContractAt("AlphaPortfolioValuesFeed", pvFeedAddress, deployer)
	const price = await priceFeed.getNormalizedRate(wethAddress, usdcAddress)
	console.log({ price })
	await pvFeed.fulfill(wethAddress, usdcAddress)

	await liquidityPool.deposit(depositAmount, {
		gasLimit: BigNumber.from("100000000")
	})

	try {
		const pauseTx = await liquidityPool.pauseTradingAndRequest()
		await pauseTx.wait()
	} catch (err) {
		console.log(err)
	}
	const isTradingpaused = await liquidityPool.isTradingPaused()
	console.log({ isTradingpaused })
	const executeTx = await liquidityPool.executeEpochCalculation()
	await executeTx.wait()
	await liquidityPool.redeem(toWei("1000000000000000"))
}

const sellOptions = async (strikePrice: number, weeksUntilExpiry: number, isPut: boolean) => {
	console.log({ balance: await deployer.getBalance() })
	const optionHandler = await ethers.getContractAt("AlphaOptionHandler", handlerAddress, deployer)
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
	console.log({ optionSeries })
	// const pvFeed = await ethers.getContractAt("PortfolioValuesFeed", pvFeedAddress, deployer)
	// const price = await priceFeed.getNormalizedRate(wethAddress, usdcAddress)
	// console.log({ price })
	// await pvFeed.fulfill(
	// 	utils.formatBytes32String("1"),
	// 	wethAddress,
	// 	usdcAddress,
	// 	BigNumber.from(0),
	// 	BigNumber.from(0),
	// 	BigNumber.from(0),
	// 	BigNumber.from(0),
	// 	BigNumber.from(0),
	// 	price
	// )

	const [quote] = await liquidityPool.quotePriceWithUtilizationGreeks(optionSeries, amount, false)
	console.log({ quote })
	await usdc.approve(optionHandler.address, quote)
	const tx = await optionHandler.issueAndWriteOption(optionSeries, amount)
	await tx.wait()
}

// Deposit liquidity into pool then sell an option series
// deposit().then(() => {
// 	sellOptions(1500, 3, true)
// })

// sell an option series without depositing more
// sellOptions(1500, 3, true)

deposit()
