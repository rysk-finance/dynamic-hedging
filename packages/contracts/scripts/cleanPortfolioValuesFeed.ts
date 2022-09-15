import "@nomiclabs/hardhat-ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumRinkeby } from "../contracts.json"

async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}

		const pvFeed = await hre.ethers.getContractAt(
			"AlphaPortfolioValuesFeed",
			arbitrumRinkeby.portfolioValuesFeed
		)

		const pvTransaction = await pvFeed.syncLooper()

		await pvTransaction.wait()

		console.log("old expiries removed")
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
