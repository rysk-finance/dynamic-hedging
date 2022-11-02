import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import { expect } from "chai"
import { utils } from "ethers"
import { PortfolioValuesFeed } from "../../types/PortfolioValuesFeed"

// deploys a non-alpha PV feed contract

const linkTokenAddress = "0x615fBe6372676474d9e6933d310469c9b68e9726"
const wethAddress = "0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
const usdcAddress = "0x6775842ae82bf2f0f987b10526768ad89d79536e"
const oracleAddress = "0x0"
const authorityAddress = "0x0"
const optionProtocolAddress = "0x0"
const liquidityPoolAddress = "0x0"

export async function deployNewPVFeed() {
	const portfolioValuesFeedFactory = await ethers.getContractFactory("PortfolioValuesFeed")
	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		oracleAddress,
		utils.formatBytes32String("jobId"),
		toWei("1"),
		linkTokenAddress,
		authorityAddress
	)) as PortfolioValuesFeed
	console.log("portfolio values feed deployed")

	try {
		await hre.run("verify:verify", {
			address: portfolioValuesFeed.address,
			constructorArguments: [
				oracleAddress,
				utils.formatBytes32String("jobId"),
				toWei("1"),
				linkTokenAddress,
				authorityAddress
			]
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
	await portfolioValuesFeed.setAddressStringMapping(wethAddress, wethAddress)
	await portfolioValuesFeed.setAddressStringMapping(usdcAddress, usdcAddress)
	await portfolioValuesFeed.setLiquidityPool(liquidityPoolAddress)
	await portfolioValuesFeed.setKeeper(liquidityPoolAddress, true)

	expect(await optionProtocol.portfolioValuesFeed()).to.eq(portfolioValuesFeed.address)
	console.log({ newPortfolioValuesFeed: portfolioValuesFeed.address })
}

deployNewPVFeed()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
