import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import { expect } from "chai"
import { utils } from "ethers"
import { PortfolioValuesFeed } from "../../types/PortfolioValuesFeed"

// deploys a non-alpha PV feed contract

const linkTokenAddress = "0x615fBe6372676474d9e6933d310469c9b68e9726"
const wethAddress = "0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
const usdcAddress = "0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737"

export async function deployNewPVFeed(
	oracleAddress: string,
	authorityAddress: string,
	optionProtocolAddress: string,
	liquidityPoolAddress: string
) {
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

deployNewPVFeed(
	"0xF91105B81Dfb795482A8A26E6AB880108a906C5E",
	"0xBadb002418B5A84362db7877e5E8b35b738f8c84",
	"0xe52f05b164791c0a963b1729D54b0A4970e56378",
	"0x502b02DD4bAdb4F2d104418DCb033606AC948e30"
)
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
