import hre, { ethers } from "hardhat"
import { expect } from "chai"
import { VolatilityFeed } from "../../types/VolatilityFeed"

// deploys a SABR vol feed contract

const authorityAddress = "0x0c83E447dc7f4045b8717d5321056D4e9E86dCD2"
const optionProtocolAddress = "0x08674f64DaC31f36828B63A4468A3AC3C68Db5B2"

export async function deployNewVolFeed() {
	const volatilityFeedFactory = await ethers.getContractFactory("VolatilityFeed")
	const volatilityFeed = (await volatilityFeedFactory.deploy(authorityAddress)) as VolatilityFeed
	console.log("portfolio values feed deployed")

	try {
		await hre.run("verify:verify", {
			address: volatilityFeed.address,
			constructorArguments: [authorityAddress]
		})

		console.log("volatility feed feed verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("volFeed contract already verified")
		}
	}

	console.log("address:", volatilityFeed.address)

	const optionProtocol = await ethers.getContractAt(
		"contracts/Protocol.sol:Protocol",
		optionProtocolAddress
	)
	await optionProtocol.changeVolatilityFeed(volatilityFeed.address, { gasLimit: 100000000 })

	expect(await optionProtocol.volatilityFeed()).to.eq(volatilityFeed.address)
	console.log({ newVolatilityFeed: volatilityFeed.address })
}

deployNewVolFeed()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
