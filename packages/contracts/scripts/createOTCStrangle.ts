import "@nomiclabs/hardhat-ethers"
import { BigNumber, ethers } from "ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumRinkeby } from "../contracts.json"
import { toWei } from "../utils/conversion-helper"

const RYSK_DECIMAL = BigNumber.from("1000000000000000000")
const RYSK_EXP = 1e18

async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}

		const alphaOptionHandler = await hre.ethers.getContractAt(
			"AlphaOptionHandler",
			arbitrumRinkeby.alphaOptionHandler
		)


		const callOption = {
			expiration: "1663315200",
			// Need to update to give a value in the orderBounds defined on optionHandler.
			strike: BigNumber.from("1900").mul(RYSK_DECIMAL),
			isPut: false,
			underlying: arbitrumRinkeby.WETH,
			strikeAsset: arbitrumRinkeby.USDC,
			collateral: arbitrumRinkeby.USDC
		}

		const putOption = {
			expiration: "1663315200",
			// Need to update to give a value in the orderBounds defined on optionHandler.
			strike: BigNumber.from("1300").mul(RYSK_DECIMAL),
			isPut: true,
			underlying: arbitrumRinkeby.WETH,
			strikeAsset: arbitrumRinkeby.USDC,
			collateral: arbitrumRinkeby.USDC
		}

		const orderAmount = 2.50

		const callPricePerOptionInUsdc = 7.45
		const putPricePerOptionInUsdc = 12.55

		const orderTransaction = await alphaOptionHandler.createStrangle(
			callOption,
			putOption,
			BigNumber.from( (orderAmount * RYSK_EXP).toString() ),
			BigNumber.from( (orderAmount * RYSK_EXP).toString() ),
			BigNumber.from( (callPricePerOptionInUsdc * RYSK_EXP).toString() ),
			BigNumber.from( (putPricePerOptionInUsdc * RYSK_EXP).toString() ),
			BigNumber.from(1800),
			// Update to order reciever address.
			"0xAD5B468F6Fb897461E388396877fD5E3c5114539",
			[toWei("100"), toWei("100")],
			[toWei("100"), toWei("100")],
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
