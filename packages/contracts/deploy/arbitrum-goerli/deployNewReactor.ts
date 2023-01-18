import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import { MintableERC20 } from "../../types/MintableERC20"
import { PerpHedgingReactor } from "../../types/PerpHedgingReactor"
import { truncate } from "@ragetrade/sdk"

// update these addresses to connect to the appropriate set of contracts

const usdcAddress = "0x6775842ae82bf2f0f987b10526768ad89d79536e"
const wethAddress = "0x53320bE2A35649E9B2a0f244f9E9474929d3B699"
const clearingHouseAddress = "0x7047343e3eF25505263116212EE74430A2A12257"
const liquidityPoolAddress = "0xa9FD112cC1192f59078c20f6F39D7B42563Ea716"
const authorityAddress = "0xd6DE605977A8540BEf4A08429DA0A2BfB09f14Be"
const priceFeedAddress = "0x74F1c3C4076EfeD74941F4974Db84E1a73a521F1"
const pvFeedAddress = "0x4D2f15471F0d60474d7B1953a27f2c9d642B91C1"
const optionProtocolAddress = "0x8964381a078e3b2C5F761d6141f8D210180b31b2"
const vETHAddress = "0xC85c06FCF9355876DF51a90C2c0290ECa913A04f"

export async function deployNewHedgingReactor() {
	const perpHedgingReactorFactory = await ethers.getContractFactory("PerpHedgingReactor")
	const perpHedgingReactor = (await perpHedgingReactorFactory.deploy(
		clearingHouseAddress,
		usdcAddress,
		wethAddress,
		liquidityPoolAddress,
		truncate(vETHAddress),
		truncate(usdcAddress),
		priceFeedAddress,
		authorityAddress
	)) as PerpHedgingReactor

	console.log("perp hedging reactor deployed")

	try {
		await hre.run("verify:verify", {
			address: perpHedgingReactor.address,
			constructorArguments: [
				clearingHouseAddress,
				usdcAddress,
				wethAddress,
				liquidityPoolAddress,
				truncate(vETHAddress),
				truncate(usdcAddress),
				priceFeedAddress,
				authorityAddress
			]
		})
		console.log("perp hedging reactor verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("perp hedging reactor contract already verified")
		}
	}

	const usd = (await ethers.getContractAt(
		"contracts/tokens/ERC20.sol:ERC20",
		usdcAddress
	)) as MintableERC20
	await usd.approve(perpHedgingReactor.address, toWei("1"))
	await perpHedgingReactor.initialiseReactor()
	console.log("Perp hedging reactor initialised")

	const optionProtocol = await ethers.getContractAt(
		"contracts/Protocol.sol:Protocol",
		optionProtocolAddress
	)

	const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress)

	await liquidityPool.setHedgingReactorAddress(perpHedgingReactor.address)
	console.log("hedging reactors added to liquidity pool")
	console.log({ newReactorAddress: perpHedgingReactor.address })
}

deployNewHedgingReactor()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
