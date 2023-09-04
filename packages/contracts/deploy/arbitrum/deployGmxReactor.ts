import hre, { ethers } from "hardhat"
import { GmxHedgingReactorWithSwap } from "../../types/GmxHedgingReactorWithSwap"

// update these addresses to connect to the appropriate set of contracts

const usdcBridgedAddress = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
const usdcNativeAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"

const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
const liquidityPoolAddress = "0x217749d9017cB87712654422a1F5856AAA147b80"
const authorityAddress = "0x74948DAf8Beb3d14ddca66d205bE3bc58Df39aC9"
const priceFeedAddress = "0x7f86AC0c38bbc3211c610abE3841847fe19590A4"

// gmx contracts on arbitrum mainnet
const positionRouterAddress = "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868"
const routerAddress = "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064"
const readerAddress = "0x22199a49A999c351eF7927602CFB187ec3cae489"
const vaultAddress = "0x489ee077994B6658eAfA855C308275EAd8097C4A"

export async function deployNewHedgingReactor() {
	const gmxHedgingReactorFactory = await ethers.getContractFactory("GmxHedgingReactorWithSwap")
	const gmxHedgingReactor = (await gmxHedgingReactorFactory.deploy(
		positionRouterAddress,
		routerAddress,
		readerAddress,
		vaultAddress,
		usdcNativeAddress,
		wethAddress,
		liquidityPoolAddress,
		priceFeedAddress,
		authorityAddress,
		"0xe592427a0aece92de3edee1f18e0157c05861564"
	)) as GmxHedgingReactorWithSwap

	console.log("gmx hedging reactor deployed")

	try {
		await hre.run("verify:verify", {
			address: gmxHedgingReactor.address,
			constructorArguments: [
				positionRouterAddress,
				routerAddress,
				readerAddress,
				vaultAddress,
				usdcNativeAddress,
				wethAddress,
				liquidityPoolAddress,
				priceFeedAddress,
				authorityAddress,
				"0xe592427a0aece92de3edee1f18e0157c05861564"
			]
		})
		console.log("gmx hedging reactor verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("perp hedging reactor contract already verified")
		}
	}

	// const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress)

	// await liquidityPool.setHedgingReactorAddress(gmxHedgingReactor.address)
	// console.log("new gmx hedging reactor added to liquidity pool")
	console.log({ newReactorAddress: gmxHedgingReactor.address })
}

deployNewHedgingReactor()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
