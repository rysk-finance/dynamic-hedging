import hre, { ethers } from "hardhat"
import { expect } from "chai"
import { AlphaPortfolioValuesFeed } from "../../types/AlphaPortfolioValuesFeed"

// deploys an alpha PV feed contract

const wethAddress = "0x53320bE2A35649E9B2a0f244f9E9474929d3B699"
const usdcAddress = "0x6775842ae82bf2f0f987b10526768ad89d79536e"
const authorityAddress = "0xd6DE605977A8540BEf4A08429DA0A2BfB09f14Be"
const handlerAddress = "0xe3a2206075700Be9f2ea6749436A16536d9DA72D"
const optionProtocolAddress = "0x8964381a078e3b2C5F761d6141f8D210180b31b2"
const liquidityPoolAddress = "0xa9FD112cC1192f59078c20f6F39D7B42563Ea716"

export async function deployNewAlphaPVFeed() {
	const portfolioValuesFeedFactory = await ethers.getContractFactory("AlphaPortfolioValuesFeed")

	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		authorityAddress
	)) as AlphaPortfolioValuesFeed
	console.log("alpha portfolio values feed deployed")

	try {
		await hre.run("verify:verify", {
			address: portfolioValuesFeed.address,
			constructorArguments: [authorityAddress]
		})

		console.log("portfolio values feed verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("pvFeed contract already verified")
		}
	}

	const optionProtocol = await ethers.getContractAt(
		"contracts/Protocol.sol:Protocol",
		optionProtocolAddress
	)
	await optionProtocol.changePortfolioValuesFeed(portfolioValuesFeed.address)
	await portfolioValuesFeed.setLiquidityPool(liquidityPoolAddress)
	await portfolioValuesFeed.setProtocol(optionProtocol.address)
	await portfolioValuesFeed.setKeeper(liquidityPoolAddress, true)
	await portfolioValuesFeed.fulfill(wethAddress, usdcAddress)
	await portfolioValuesFeed.setHandler(handlerAddress, true)
	await portfolioValuesFeed.setKeeper(handlerAddress, true)

	expect(await optionProtocol.portfolioValuesFeed()).to.eq(portfolioValuesFeed.address)
	console.log({ newPortfolioValuesFeed: portfolioValuesFeed.address })
}

deployNewAlphaPVFeed()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
