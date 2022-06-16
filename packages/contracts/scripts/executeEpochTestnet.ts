import "@nomiclabs/hardhat-ethers"
import { BigNumber, utils } from "ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumRinkeby, localhost } from "../contracts.json"
import { PriceFeed } from "../types/PriceFeed"

async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}

		const lpContract = await hre.ethers.getContractAt("LiquidityPool", arbitrumRinkeby.liquidityPool)

		const initialEpoch = await lpContract.epoch()
		console.log(`Current epoch is ${initialEpoch}`)

		await lpContract.pauseTradingAndRequest()

		const priceFeed = (await hre.ethers.getContractAt(
			"PriceFeed",
			arbitrumRinkeby.priceFeed
		)) as PriceFeed
		const pvFeed = await hre.ethers.getContractAt(
			"PortfolioValuesFeed",
			arbitrumRinkeby.portfolioValuesFeed
		)
		const price = await priceFeed.getNormalizedRate(arbitrumRinkeby.WETH, arbitrumRinkeby.USDC)
		console.log({ price })
		await pvFeed.fulfill(
			utils.formatBytes32String("1"),
			arbitrumRinkeby.WETH,
			arbitrumRinkeby.USDC,
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			BigNumber.from(0),
			price
		)

		await lpContract.executeEpochCalculation()

		const newEpoch = await lpContract.epoch()
		console.log(`New epoch is ${newEpoch}`)
	} catch (err) {
		console.log(err)
	}
}

main()
	.then(() => process.exit())
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
