import "@nomiclabs/hardhat-ethers"
import { BigNumber, ethers, utils } from "ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumRinkeby, localhost } from "../contracts.json"
import { PriceFeed } from "../types/PriceFeed"
import ERC20 from "../abis/erc20.json"
import { TransactionDescription } from "ethers/lib/utils"
import { toWei } from "../utils/conversion-helper"
import { AlphaOptionHandler } from "../types/AlphaOptionHandler"

// const ADDRESS = "0xed9d4593a9BD1aeDBA8C5F9013EF3323FEC5e4dC"

const RYSK_DECIMAL = BigNumber.from("1000000000000000000")
const USDC_DECIMAL = BigNumber.from("1000000")

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

		const optionHandler = await hre.ethers.getContractAt(
			"AlphaOptionHandler",
			arbitrumRinkeby.optionHandler
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

		const orderAmount = RYSK_DECIMAL.mul(5)

		const pricePerOptionInUsdc = "25"

		const orderTransaction = await optionHandler.createOrder(
			option, // series
			orderAmount, // amount 
			BigNumber.from(pricePerOptionInUsdc).mul(RYSK_DECIMAL), // price
			BigNumber.from(1800), // expiry
			"0xAD5B468F6Fb897461E388396877fD5E3c5114539",
			false,
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
