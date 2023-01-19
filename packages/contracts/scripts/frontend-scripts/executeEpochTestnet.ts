import "@nomiclabs/hardhat-ethers"
import { BigNumber, utils } from "ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumRinkeby, localhost } from "../../contracts.json"
import { PriceFeed } from "../../types/PriceFeed"

async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}

		const lpContract = await hre.ethers.getContractAt("LiquidityPool", arbitrumRinkeby.liquidityPool)

		const opynOptionRegistryContract = await hre.ethers.getContractAt(
			"OptionRegistry", 
			arbitrumRinkeby.OpynOptionRegistry
		)

		const initialDepositEpoch = await lpContract.depositEpoch()
		const initialWithdrawalEpoch = await lpContract.withdrawalEpoch()
		console.log(`Current depositEpoch is ${initialDepositEpoch}`)
		console.log(`Current withdrawalEpoch is ${initialWithdrawalEpoch}`)

		await lpContract.pauseTradingAndRequest()

		const priceFeed = (await hre.ethers.getContractAt(
			"PriceFeed",
			arbitrumRinkeby.priceFeed
		)) as PriceFeed
		const pvFeed = await hre.ethers.getContractAt(
			"AlphaPortfolioValuesFeed",
			arbitrumRinkeby.portfolioValuesFeed
		)
		const price = await priceFeed.getNormalizedRate(arbitrumRinkeby.WETH, arbitrumRinkeby.USDC)
		console.log({ price })
		
		const looper = await pvFeed.syncLooper()
		console.log(looper)
		
		await pvFeed.fulfill(arbitrumRinkeby.WETH, arbitrumRinkeby.USDC)

		const transaction = await lpContract.executeEpochCalculation()

		await transaction.wait()

		const newDepositEpoch = await lpContract.depositEpoch()
		const newWithdrawalEpoch = await lpContract.withdrawalEpoch()
		console.log(`New depositEpoch is ${newDepositEpoch}`)
		console.log(`New withdrawalEpoch is ${newWithdrawalEpoch}`)

	} catch(error) {
		console.log(error)
	}
		

	}

main()
	.then(() => process.exit())
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
