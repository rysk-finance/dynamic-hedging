import { BigNumber, Signer, utils } from "ethers"
import fs from "fs"
import { ethers, network } from "hardhat"
import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import path from "path"
import { CHAINLINK_WETH_PRICER } from "../../test/constants"
import { setupTestOracle } from "../../test/helpers"
import { MockChainlinkAggregator } from "../../types/MockChainlinkAggregator"
import { Oracle } from "../../types/Oracle"
import { scaleNum } from "../../utils/conversion-helper"
import { deployLiquidityPool, deploySystem } from "../../utils/generic-system-deployer"
import { deployOpyn } from "../../utils/opyn-deployer"

const chainId = 1

const addressPath = path.join(__dirname, "..", "..", "contracts.json")

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// reset hardat and impersonate account for ownership
	await hre.network.provider.request({
		method: "hardhat_reset",
		params: [
			{
				forking: {
					chainId: 1,
					jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`
				}
			}
		]
	})

	await network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [CHAINLINK_WETH_PRICER[chainId]]
	})

	let signers: Signer[] = await ethers.getSigners()
	const [sender] = signers

	// Set params for Opyn Contracts
	const productSpotShockValue = scaleNum("0.6", 27)
	const day = 60 * 60 * 24
	const timeToExpiry = [day * 7, day * 14, day * 28, day * 42, day * 56]

	const expiryToValue = [
		scaleNum("0.1678", 27),
		scaleNum("0.237", 27),
		scaleNum("0.3326", 27),
		scaleNum("0.4032", 27),
		scaleNum("0.4603", 27)
	]

	// deploy opyn contract
	let opynParams = await deployOpyn(signers, productSpotShockValue, timeToExpiry, expiryToValue)
	const opynController = opynParams.controller
	const opynAddressBook = opynParams.addressBook
	const opynOracle = opynParams.oracle
	const opynNewCalculator = opynParams.newCalculator

	// deploy oracle
	const res = await setupTestOracle(await sender.getAddress())
	const oracle = res[0] as Oracle
	const opynAggregator = res[1] as MockChainlinkAggregator

	// deploy system
	let deployParams = await deploySystem(signers, oracle, opynAggregator)
	const wethERC20 = deployParams.wethERC20
	const usd = deployParams.usd
	const optionRegistry = deployParams.optionRegistry
	const priceFeed = deployParams.priceFeed
	const volFeed = deployParams.volFeed
	const portfolioValuesFeed = deployParams.portfolioValuesFeed
	const optionProtocol = deployParams.optionProtocol
	const authority = deployParams.authority

	const rfr: string = "0.03"
	const minCallStrikePrice = utils.parseEther("500")
	const maxCallStrikePrice = utils.parseEther("10000")
	const minPutStrikePrice = utils.parseEther("500")
	const maxPutStrikePrice = utils.parseEther("10000")
	// one week in seconds
	const minExpiry = 86400 * 7
	// 365 days in seconds
	const maxExpiry = 86400 * 365

	let lpParams = await deployLiquidityPool(
		signers,
		optionProtocol,
		usd,
		wethERC20,
		rfr,
		minCallStrikePrice,
		minPutStrikePrice,
		maxCallStrikePrice,
		maxPutStrikePrice,
		minExpiry,
		maxExpiry,
		optionRegistry,
		portfolioValuesFeed,
		authority.address
	)
	const liquidityPool = lpParams.liquidityPool
	const handler = lpParams.handler

	liquidityPool.setMaxTimeDeviationThreshold(1000000000000000)

	let contractAddresses

	try {
		// @ts-ignore
		contractAddresses = JSON.parse(fs.readFileSync(addressPath))
	} catch {
		console.log("Cannot find contract addresses")
		process.exit()
	}

	// @ts-ignore
	contractAddresses["localhost"]["OpynController"] = opynController.address
	contractAddresses["localhost"]["OpynAddressBook"] = opynAddressBook.address
	contractAddresses["localhost"]["OpynOracle"] = opynOracle.address
	contractAddresses["localhost"]["OpynNewCalculator"] = opynNewCalculator.address
	contractAddresses["localhost"]["OpynOptionRegistry"] = optionRegistry.address
	contractAddresses["localhost"]["priceFeed"] = priceFeed.address
	contractAddresses["localhost"]["volFeed"] = volFeed.address
	contractAddresses["localhost"]["optionProtocol"] = optionProtocol.address
	contractAddresses["localhost"]["liquidityPool"] = liquidityPool.address
	contractAddresses["localhost"]["authority"] = authority.address
	contractAddresses["localhost"]["optionHandler"] = handler.address

	fs.writeFileSync(addressPath, JSON.stringify(contractAddresses, null, 4))
}

func.tags = ["localhost"]
export default func
function ZERO_ADDRESS(arg0: string, arg1: string, arg2: BigNumber, ZERO_ADDRESS: any): any {
	throw new Error("Function not implemented.")
}
