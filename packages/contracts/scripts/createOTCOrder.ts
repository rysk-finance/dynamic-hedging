import "@nomiclabs/hardhat-ethers"
import { BigNumber } from "ethers"
import hre from "hardhat"
import { arbitrumRinkeby } from "../contracts.json"
import { toWei } from "../utils/conversion-helper"
import { abi as optionHandlerABI } from "../artifacts/contracts/AlphaOptionHandler.sol/AlphaOptionHandler.json"

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

		const option = {
			expiration: "1663315200",
			// Need to update to give a value in the orderBounds defined on optionHandler.
			strike: BigNumber.from("2500").mul(RYSK_DECIMAL),
			isPut: false,
			underlying: arbitrumRinkeby.WETH,
			strikeAsset: arbitrumRinkeby.USDC,
			collateral: arbitrumRinkeby.USDC
		}

		const orderAmount = 2.33

		const pricePerOptionInUsdc = 7.45

		const orderTransaction = await alphaOptionHandler.createOrder(
			option, // series
			BigNumber.from((orderAmount * RYSK_EXP).toString()), // amount
			BigNumber.from((pricePerOptionInUsdc * RYSK_EXP).toString()), // price
			BigNumber.from(1800), // expiry
			"0xAD5B468F6Fb897461E388396877fD5E3c5114539",
			false, // is_buyback
			[toWei("100"), toWei("100")]
		)

		console.log(orderTransaction)
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
