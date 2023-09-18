import hre, { ethers } from "hardhat"
import { expect } from "chai"
import { AlphaPortfolioValuesFeed } from "../../types/AlphaPortfolioValuesFeed"

const authorityAddress = "0x74948DAf8Beb3d14ddca66d205bE3bc58Df39aC9"
const optionProtocolAddress = "0x4e920e9A901069d9b211646B6E191d81BA40E5FB"
const blackScholesAddress = "0x85C100Eb32C3e2F6EA0444E553f3A9bCE468cb8C"

const maxNetDhvExposure = 200e18

export async function deployNewVolFeed() {
	const volatilityFeedFactory = await ethers.getContractFactory("VolatilityFeed")
	const volatilityFeed = (await volatilityFeedFactory.deploy(
		authorityAddress
	)) as AlphaPortfolioValuesFeed
	console.log("portfolio values feed deployed")

	const portfolioValuesFeedFactory = await ethers.getContractFactory("AlphaPortfolioValuesFeed", {
		libraries: {
			BlackScholes: blackScholesAddress
		}
	})
	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		authorityAddress,
		maxNetDhvExposure,
		optionProtocolAddress
	)) as AlphaPortfolioValuesFeed
	console.log("alpha portfolio values feed deployed")

	try {
		await hre.run("verify:verify", {
			address: portfolioValuesFeed.address,
			constructorArguments: [authorityAddress, maxNetDhvExposure, optionProtocolAddress]
		})

		console.log("portfolio values feed verified")
	} catch (err: any) {
		console.log(err)
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
