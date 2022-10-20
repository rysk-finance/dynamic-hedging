import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import { expect } from "chai"
import { utils } from "ethers"
import { MintableERC20 } from "../../types/MintableERC20"
import { PerpHedgingReactor } from "../../types/PerpHedgingReactor"
import { truncate } from "@ragetrade/sdk"

// update these addresses to connect to the appropriate set of contracts

const usdcAddress = "0x33a010E74A354bd784a62cca3A4047C1A84Ceeab"
const wethAddress = "0xFCfbfcC11d12bCf816415794E5dc1BBcc5304e01"
const clearingHouseAddress = "0xe3B8eF0C2Ed6d8318F0b1b50A072e0cB508CDB04"
const liquidityPoolAddress = "0x022601eB546e007562A6dD4AE4840544E6B85c9B"
const authorityAddress = "0x96AC14eE2CeEE2328f13B095A52613319d678Dd1"
const priceFeedAddress = "0x27F70AC0453254B3CaA0A0400dB78387c474FAdD"
const pvFeedAddress = "0x4D2f15471F0d60474d7B1953a27f2c9d642B91C1"
const optionProtocolAddress = "0xf44a3def943c781543A7bC3Dd4127Ec435c1fd39"

export async function deployNewHedgingReactor() {
	// const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress)
	// await liquidityPool.removeHedgingReactorAddress(1, true)

	const perpHedgingReactorFactory = await ethers.getContractFactory("PerpHedgingReactor")
	const perpHedgingReactor = (await perpHedgingReactorFactory.deploy(
		clearingHouseAddress,
		usdcAddress,
		wethAddress,
		liquidityPoolAddress,
		2277115137,
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
				2277115137,
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
