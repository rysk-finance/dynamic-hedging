// File to add liquidity and sell a handful of options to bootstrap some initial state in the protocol
// Only use on testnet

// run this script as-is to deposit liquidity and sell options
// only call sellOptions to use existing liquidity (bottom of file)

import { ethers } from "hardhat"
import { BigNumber, utils } from "ethers"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import dotenv from "dotenv"
import { toWei, toUSDC } from "../../utils/conversion-helper"
import { calculateOptionQuoteLocally } from "../../test/helpers"
import { LiquidityPool } from "../../types/LiquidityPool"
import { OptionRegistry } from "../../types/OptionRegistry"
import { MintableERC20 } from "../../types/MintableERC20"
import { PriceFeed } from "../../types/PriceFeed"

dayjs.extend(utc)
dotenv.config()

// arbitrum goerli alpha addresses
const liquidityPoolAddress = "0x2ceDe96cd46C9B751EeB868A57FEDeD060Dbe6Bf"
const usdcAddress = "0x6775842ae82bf2f0f987b10526768ad89d79536e"
const pvFeedAddress = "0xbFC1eDc5c07ada83e0244b37A784486633910cD7"
const priceFeedAddress = "0xDcA6c35228acb82363406CB2e7eee81B40c692aE"
const wethAddress = "0x53320bE2A35649E9B2a0f244f9E9474929d3B699"
const handlerAddress = "0x8a265fa22aa5AF86fa763dC2cF04661bf06A52E6"

const deployer = new ethers.Wallet(
	process.env.DEPLOYER_PRIVATE_KEY as string,
	new ethers.providers.InfuraProvider("arbitrum-goerli")
)

console.log({ deployer: deployer.address })

const deposit = async () => {
	const depositAmount = toUSDC("1000000")
	const balance = await deployer.getBalance()
	const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress, deployer)
	const usdc = await ethers.getContractAt("MintableERC20", usdcAddress, deployer)
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
	const usdc = (await ethers.getContractAt("MintableERC20", usdcAddress, deployer)) as MintableERC20
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
	const todayDate = dayjs().format("YYYY-MM-DD")
	const expiration = dayjs.utc(todayDate).add(weeksUntilExpiry, "weeks").add(8, "hours").unix()
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
	sellOptions(1100, 3, true)
})

// sell an option series without depositing more
// sellOptions(1500, 3, true)

// deposit()
