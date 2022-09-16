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

		const vfFeed = await hre.ethers.getContractAt(
			"VolatilityFeed",
			arbitrumRinkeby.volFeed
		)
        // these should be configured properly
        const proposedSabrParams = {
            callAlpha: 250000,
            callBeta: 1_000000,
            callRho: -300000,
            callVolvol: 1_500000,
            putAlpha: 250000,
            putBeta: 1_000000,
            putRho: -300000,
            putVolvol: 1_500000
        }
        // this should be configured properly
        const expiration = 1663920000
		const vfTransaction = await vfFeed.setSabrParameters(proposedSabrParams, expiration)
		console.log("sabr parameters set")
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
