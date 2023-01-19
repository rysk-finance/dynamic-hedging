import "@nomiclabs/hardhat-ethers"
import { BigNumber, ethers } from "ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumRinkeby } from "../../contracts.json"
import { abi as optionHandlerABI } from "../../artifacts/contracts/AlphaOptionHandler.sol/AlphaOptionHandler.json"
import { toWei } from "../../utils/conversion-helper"

const ADDRESS = "0xed9d4593a9BD1aeDBA8C5F9013EF3323FEC5e4dC"

const RYSK_DECIMAL = BigNumber.from("1000000000000000000")
const RYSK_EXP = 1e18

type OrderBounds = {
	callMinDelta: BigNumber
	callMaxDelta: BigNumber
	putMinDelta: BigNumber
	putMaxDelta: BigNumber
	maxPriceRange: BigNumber
}

async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}

		// const optionHandler = await hre.ethers.getContractAt(
		// 	"OptionHandler",
		// 	arbitrumRinkeby.optionHandler
		// )

		const signers = await hre.ethers.getSigners()
		const alphaOptionHandler = new hre.ethers.Contract(
			arbitrumRinkeby.optionHandler,
			optionHandlerABI,
			signers[0]
		)

		const callOption = {
			expiration: "1665820800",
			// Need to update to give a value in the orderBounds defined on optionHandler.
			strike: BigNumber.from("1350").mul(RYSK_DECIMAL),
			isPut: false,
			underlying: arbitrumRinkeby.WETH,
			strikeAsset: arbitrumRinkeby.USDC,
			collateral: arbitrumRinkeby.USDC
		}

		const callQuote = BigNumber.from((25 * RYSK_EXP).toString())

		const putOption = {
			expiration: "1665820800",
			// Need to update to give a value in the orderBounds defined on optionHandler.
			strike: BigNumber.from("1350").mul(RYSK_DECIMAL),
			isPut: true,
			underlying: arbitrumRinkeby.WETH,
			strikeAsset: arbitrumRinkeby.USDC,
			collateral: arbitrumRinkeby.USDC
		}

		const putQuote = BigNumber.from((50 * RYSK_EXP).toString())

		const orderAmount = BigNumber.from((1 * RYSK_EXP).toString())

		const orderTransaction = await alphaOptionHandler.createStrangle(
			callOption,
			putOption,
			orderAmount,
			orderAmount,
			callQuote,
			putQuote,
			BigNumber.from(1800),
			// Update to order reciever address.
			"0xAD5B468F6Fb897461E388396877fD5E3c5114539",
			[toWei("100"), toWei("100")],
			[toWei("100"), toWei("100")],
			{gasPrice: ethers.utils.parseUnits('100', 'gwei'), gasLimit: 5000000}
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
