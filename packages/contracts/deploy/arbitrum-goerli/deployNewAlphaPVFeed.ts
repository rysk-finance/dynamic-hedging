import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import { expect } from "chai"
import { utils } from "ethers"
import { AlphaPortfolioValuesFeed } from "../../types/AlphaPortfolioValuesFeed"

// deploys an alpha PV feed contract

const wethAddress = "0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
const usdcAddress = "0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737"
const blackScholesAddress = "0x8f4E5f0D5D8907c6A08527895B777BBc6b0bac48"
const authorityAddress = "0x96AC14eE2CeEE2328f13B095A52613319d678Dd1"
const handlerAddress = "0x1c4dB5B6028EE95ad4E07cf83F3AcC797f478125"
const optionProtocolAddress = "0xf44a3def943c781543A7bC3Dd4127Ec435c1fd39"
const liquidityPoolAddress = "0x022601eB546e007562A6dD4AE4840544E6B85c9B"

export async function deployNewAlphaPVFeed() {
	const portfolioValuesFeed = await ethers.getContractAt(
		"AlphaPortfolioValuesFeed",
		"0x4D2f15471F0d60474d7B1953a27f2c9d642B91C1"
	)
	// const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
	// 	authorityAddress
	// )) as AlphaPortfolioValuesFeed
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

	// const optionProtocol = await ethers.getContractAt(
	// 	"contracts/Protocol.sol:Protocol",
	// 	optionProtocolAddress
	// )
	// await optionProtocol.changePortfolioValuesFeed(portfolioValuesFeed.address)
	// await portfolioValuesFeed.setLiquidityPool(liquidityPoolAddress)
	// await portfolioValuesFeed.setProtocol(optionProtocol.address)
	// await portfolioValuesFeed.setKeeper(liquidityPoolAddress, true)
	// await portfolioValuesFeed.fulfill(wethAddress, usdcAddress)
	// await portfolioValuesFeed.setHandler(handlerAddress, true)
	// await portfolioValuesFeed.setKeeper(handlerAddress, true)

	// expect(await optionProtocol.portfolioValuesFeed()).to.eq(portfolioValuesFeed.address)
	// console.log({ newPortfolioValuesFeed: portfolioValuesFeed.address })
}

deployNewAlphaPVFeed()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
