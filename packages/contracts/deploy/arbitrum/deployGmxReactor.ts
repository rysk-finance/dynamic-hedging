import hre, { ethers } from "hardhat"
import { GmxHedgingReactor } from "../../types/GmxHedgingReactor"

// update these addresses to connect to the appropriate set of contracts

const usdcAddress = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
const liquidityPoolAddress = "0xC10B976C671Ce9bFf0723611F01422ACbAe100A5"
const authorityAddress = "0x0c83E447dc7f4045b8717d5321056D4e9E86dCD2"
const priceFeedAddress = "0xA5a095f2a2Beb2d53382293b0FfE0f520dDEC297"

// gmx contracts on arbitrum mainnet
const positionRouterAddress = "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868"
const routerAddress = "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064"
const readerAddress = "0x22199a49A999c351eF7927602CFB187ec3cae489"
const vaultAddress = "0x489ee077994B6658eAfA855C308275EAd8097C4A"

export async function deployNewHedgingReactor() {
	const gmxHedgingReactorFactory = await ethers.getContractFactory("GmxHedgingReactor")
	const gmxHedgingReactor = (await gmxHedgingReactorFactory.deploy(
		positionRouterAddress,
		routerAddress,
		readerAddress,
		vaultAddress,
		usdcAddress,
		wethAddress,
		liquidityPoolAddress,
		priceFeedAddress,
		authorityAddress
	)) as GmxHedgingReactor

	console.log("gmx hedging reactor deployed")

	try {
		await hre.run("verify:verify", {
			address: gmxHedgingReactor.address,
			constructorArguments: [
				positionRouterAddress,
				routerAddress,
				readerAddress,
				vaultAddress,
				usdcAddress,
				wethAddress,
				liquidityPoolAddress,
				priceFeedAddress,
				authorityAddress
			]
		})
		console.log("gmx hedging reactor verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("perp hedging reactor contract already verified")
		}
	}

	const liquidityPool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress)

	await liquidityPool.setHedgingReactorAddress(gmxHedgingReactor.address)
	console.log("new gmx hedging reactor added to liquidity pool")
	console.log({ newReactorAddress: gmxHedgingReactor.address })
}

deployNewHedgingReactor()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
