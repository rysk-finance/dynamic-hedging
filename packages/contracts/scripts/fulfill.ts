import "@nomiclabs/hardhat-ethers"
import { BigNumber, ethers } from "ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumRinkeby } from "../contracts.json"

async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}

		const priceFeed = await hre.ethers.getContractAt("PriceFeed", arbitrumRinkeby.priceFeed)

		const pvFeed = await hre.ethers.getContractAt(
			"PortfolioValuesFeed",
			arbitrumRinkeby.portfolioValuesFeed
		)

		const price = await priceFeed.getNormalizedRate(arbitrumRinkeby.WETH, arbitrumRinkeby.USDC)

		const pvTransaction = await pvFeed.fulfill(
			ethers.utils.formatBytes32String("1"),
			arbitrumRinkeby.WETH,
			arbitrumRinkeby.USDC,
			BigNumber.from("0"),
			BigNumber.from("0"),
			BigNumber.from("0"),
			BigNumber.from("0"),
			BigNumber.from("0"),
			price
		)

		await pvTransaction.wait()

		console.log("fulfilled")
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
