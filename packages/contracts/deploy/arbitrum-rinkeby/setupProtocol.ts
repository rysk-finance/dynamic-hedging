// File to add liquidity and sell a handful of options to bootstrap some initial state in the protocol

import { ethers } from "hardhat"
import { BigNumber, utils } from "ethers"
import moment from "moment"

import {
	toWei,
	truncate,
	tFormatEth,
	call,
	put,
	genOptionTimeFromUnix,
	fromWei,
	percentDiff,
	toUSDC,
	fromOpyn,
	toOpyn,
	tFormatUSDC,
	scaleNum,
	fromWeiToUSDC
} from "../../utils/conversion-helper"
import dotenv from "dotenv"
dotenv.config()

const liquidityPoolAddress = "0x4880f5f81CA9d9bB574BA87ABac648C7281C1408"
const usdcAddress = "0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737"
const pvFeedAddress = "0xe8367fcC1785bF332d8dbBD1A9994a582dEA0BA3"
const priceFeedAddress = "0x7201F381Ec5E99333dc4D86d8B06068907181170"
const wethAddress = "0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
const handlerAddress = "0x2aFb284B14E47F34D695167078aE6094E9AF1D0F"
const deployer = new ethers.Wallet(
	process.env.DEPLOYER_PRIVATE_KEY as string,
	new ethers.providers.InfuraProvider("arbitrum-rinkeby")
)

const deposit = async () => {
	const balance = await deployer.getBalance()
	const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress, deployer)
	const usdc = await ethers.getContractAt("MockERC20", usdcAddress, deployer)
	const pvFeed = await ethers.getContractAt("MockPortfolioValuesFeed", pvFeedAddress, deployer)
	const priceFeed = await ethers.getContractAt("PriceFeed", priceFeedAddress, deployer)
	console.log({ balance: ethers.utils.formatEther(balance) })
	await usdc.approve(liquidityPool.address, toUSDC("1000000"))

	const tx = await liquidityPool.deposit(toUSDC("1000000"), {
		gasLimit: BigNumber.from("1000000000")
	})

	await liquidityPool.pauseTradingAndRequest()
	await pvFeed.fulfill(
		utils.formatBytes32String("2"),
		wethAddress,
		usdc.address,
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		toWei("1948")
	)
	await liquidityPool.executeEpochCalculation()

	await liquidityPool.redeem(toWei("1000000000000000"))
}

const sellOptions = async () => {
	const optionHandler = await ethers.getContractAt("OptionHandler", handlerAddress, deployer)
	const usdc = await ethers.getContractAt("MockERC20", usdcAddress, deployer)
	const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress, deployer)

	const amount = toWei("1")
	const todayDate = moment().format("YYYY-MM-DD")
	const expiration = moment.utc(todayDate).add(1, "w").add(8, "h").valueOf() / 1000
	const strikePrice = toWei("2300")

	const balance = await usdc.balanceOf(liquidityPoolAddress)
	console.log({ balance, expiration, strikePrice, usdcAddress, wethAddress, amount })
	const id = await optionHandler.underlyingAsset()
	console.log({ id })
	const optionSeries = {
		expiration: expiration,
		strike: strikePrice,
		isPut: false,
		strikeAsset: usdcAddress,
		underlying: wethAddress,
		collateral: usdcAddress
	}
	await usdc.approve(optionHandler.address, toUSDC("100000000000000"))
	const priceFeed = await ethers.getContractAt("PriceFeed", priceFeedAddress, deployer)
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

	const getValuesTx = await pvFeed.getPortfolioValues(wethAddress, usdcAddress)
	// const getValuesReceipt = await getValuesTx.wait()
	console.log({ getValuesTx })
	const tx = await optionHandler.issueAndWriteOption(optionSeries, amount)
	const receipt = await tx.wait()
}

// deposit()
sellOptions()
