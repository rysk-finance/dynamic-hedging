import "@nomiclabs/hardhat-ethers"
import { BigNumber, ethers, utils } from "ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumRinkeby, localhost } from "../contracts.json"
import { PriceFeed } from "../types/PriceFeed"
import ERC20 from "../abis/erc20.json"
import { TransactionDescription } from "ethers/lib/utils"

const ADDRESS = "0xed9d4593a9BD1aeDBA8C5F9013EF3323FEC5e4dC"

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
			"OptionHandler",
			arbitrumRinkeby.optionHandler
		)

		const priceFeed = await hre.ethers.getContractAt("PriceFeed", arbitrumRinkeby.priceFeed)

		const pvFeed = await hre.ethers.getContractAt(
			"PortfolioValuesFeed",
			arbitrumRinkeby.portfolioValuesFeed
		)

		const liquidityPool = await hre.ethers.getContractAt(
			"LiquidityPool",
			arbitrumRinkeby.liquidityPool
		)

		const price = await priceFeed.getNormalizedRate(arbitrumRinkeby.WETH, arbitrumRinkeby.USDC)

		const pvTransaction = await pvFeed.fulfill(
			ethers.utils.formatBytes32String("1"),
			arbitrumRinkeby.WETH,
			arbitrumRinkeby.USDC,
			BigNumber.from("0"),
			BigNumber.from("0"),
			BigNumber.from("0"),
			BigNumber.from("0"),
			BigNumber.from("0"),
			price
		)

		await pvTransaction.wait()

		const orderBounds: OrderBounds = await optionHandler.customOrderBounds()

		const option = {
			expiration: "1661068800",
			// Need to update to give a value in the orderBounds defined on optionHandler.
			strike: BigNumber.from("2936").mul(RYSK_DECIMAL),
			isPut: false,
			underlying: arbitrumRinkeby.WETH,
			strikeAsset: arbitrumRinkeby.USDC,
			collateral: arbitrumRinkeby.USDC
		}

		const orderAmount = RYSK_DECIMAL.mul(2)

		const [quote, delta]: BigNumber[] = await liquidityPool.quotePriceWithUtilizationGreeks(
			option,
			orderAmount,
			false
		)

		if (delta.lt(orderBounds.callMinDelta) || delta.gt(orderBounds.callMaxDelta)) {
			console.log(`Option has invalid delta of ${ethers.utils.formatEther(delta)}`)
			process.exit()
		}

		console.log(delta, quote)

		const orderTransaction = await optionHandler.createOrder(
			option,
			orderAmount,
			quote,
			BigNumber.from(1800),
			// Update to order reciever address.
			"0x939f39468b34E985d5Faa8d044569cfeC9E6CA69"
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
