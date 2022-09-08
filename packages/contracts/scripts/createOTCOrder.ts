import "@nomiclabs/hardhat-ethers"
import { BigNumber } from "ethers"
import hre from "hardhat"
import { arbitrumRinkeby } from "../contracts.json"
import { toWei } from "../utils/conversion-helper"
import { abi as optionHandlerABI } from "../artifacts/contracts/AlphaOptionHandler.sol/AlphaOptionHandler.json"
import { abi as optionRegistryABI } from "../artifacts/contracts/OptionRegistry.sol/OptionRegistry.json"

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
		const optionRegistry = new hre.ethers.Contract(
			arbitrumRinkeby.OpynOptionRegistry,
			optionRegistryABI,
			signers[0]
		)

		const option = {
			expiration: "1663315200",
			// Need to update to give a value in the orderBounds defined on optionHandler.
			strike: BigNumber.from("2009").mul(RYSK_DECIMAL),
			isPut: false,
			underlying: arbitrumRinkeby.WETH,
			strikeAsset: arbitrumRinkeby.USDC,
			collateral: arbitrumRinkeby.USDC
		}

		const orderAmount = 1.5

		const pricePerOptionInUsdc = 350

		const orderTransaction = await alphaOptionHandler.createOrder(
			{ ...option, strike: option.strike }, // series
			BigNumber.from((orderAmount * RYSK_EXP).toString()), // amount
			BigNumber.from((pricePerOptionInUsdc * RYSK_EXP).toString()), // price
			BigNumber.from(1800), // expiry
			"0x939f39468b34E985d5Faa8d044569cfeC9E6CA69",
			true, // is_buyback
			[toWei("100"), toWei("100")]
		)

		console.log(orderTransaction)

		console.log(await optionRegistry.getSeries({ ...option, strike: option.strike.div(1e10) }))

		// const test = {
		// 	expiration: BigNumber.from("1663315200"),
		// 	strike: BigNumber.from("200000000000"),
		// 	isPut: false,
		// 	underlying: "0xFCfbfcC11d12bCf816415794E5dc1BBcc5304e01",
		// 	strikeAsset: "0x33a010E74A354bd784a62cca3A4047C1A84Ceeab",
		// 	collateral: "0x33a010E74A354bd784a62cca3A4047C1A84Ceeab"
		// }

		// const option = await optionRegistry.getSeriesInfo("0x360faed7158f2de569f6426e1dc87525f9e13a69")

		// console.log(option)

		// const address = await optionRegistry.getSeries(test)
		// console.log(address)

		// const tx = await alphaOptionHandler.executeOrder(58)
		// console.log(tx)
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
