import "@nomiclabs/hardhat-ethers"
import { BigNumber } from "ethers"
import hre from "hardhat"
import { arbitrumRinkeby } from "../contracts.json"
import { toWei } from "../utils/conversion-helper"
import { abi as optionHandlerABI } from "../artifacts/contracts/AlphaOptionHandler.sol/AlphaOptionHandler.json"
import { abi as optionRegistryABI } from "../artifacts/contracts/OptionRegistry.sol/OptionRegistry.json"
import { delay } from "./utils"

const RYSK_DECIMAL = BigNumber.from("1000000000000000000")
const RYSK_EXP = 1e18

async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}
		// Not using this method to instance contract because seems to
		// generated an outdated inferface.
		// const alphaOptionHandler = await hre.ethers.getContractAt(
		// 	"OptionHandler",
		// 	arbitrumRinkeby.optionHandler
		// )
		const signers = await hre.ethers.getSigners()
		const alphaOptionHandler = new hre.ethers.Contract(
			arbitrumRinkeby.optionHandler,
			optionHandlerABI,
			signers[0]
		)

		const EXPIRY = new Date("2022-10-28T08:00:00Z")

		const option = {
			expiration: EXPIRY.getTime() / 1000,
			// Need to update to give a value in the orderBounds defined on optionHandler.
			strike: BigNumber.from("1600").mul(RYSK_DECIMAL),
			isPut: false,
			underlying: arbitrumRinkeby.WETH,
			strikeAsset: arbitrumRinkeby.USDC,
			collateral: arbitrumRinkeby.USDC
		}

		const orderAmount = 10
		const pricePerOptionInUsdc = 42

		alphaOptionHandler.on("OrderCreated", orderId => {
			console.log(`Created order ID: ${orderId}`)
			process.exit()
		})

		const orderTransaction = await alphaOptionHandler.createOrder(
			{ ...option, strike: option.strike }, // series
			BigNumber.from((orderAmount * RYSK_EXP).toString()), // amount
			BigNumber.from((pricePerOptionInUsdc * RYSK_EXP).toString()), // price
			BigNumber.from(1800), // expiry
			"", // add address here
			false, // is_buyback
			[toWei("100"), toWei("100")]
		)

		await delay(() => {
			console.log(orderTransaction)
			console.log("Could not get orderID. Cheeck the transaction above for more details.")
			process.exit()
		}, 30000)
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
