import { BigNumber, BigNumberish, Contract, Signer, utils } from "ethers"
import fs from "fs"
import { deployments, ethers, getNamedAccounts, network } from "hardhat"
import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import path from "path"
import {
	ADDRESS_BOOK,
	CHAINLINK_WETH_PRICER,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY
} from "../../test/constants"
import { toWei, scaleNum } from "../../utils/conversion-helper"
import LiquidityPoolSol from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import OptionHandlerSol from "../../artifacts/contracts/OptionHandler.sol/OptionHandler.json"
import { deployLiquidityPool, deploySystem } from "../../utils/generic-system-deployer"

import { USDC_ADDRESS, WETH_ADDRESS, CONTROLLER_OWNER } from "../../test/constants"
import { deployOpyn } from "../../utils/opyn-deployer"
import { OptionRegistry } from "../../types/OptionRegistry"
import { PriceFeed } from "../../types/PriceFeed"
import { Protocol } from "../../types/Protocol"
import { Volatility } from "../../types/Volatility"
import { MintableERC20 } from "../../types/MintableERC20"
import { WETH } from "../../types/WETH"
import { LiquidityPool } from "../../types/LiquidityPool"
import { OptionHandler } from "../../types/OptionHandler"
import { VolatilityFeed } from "../../types/VolatilityFeed"
import { MockPortfolioValuesFeed } from "../../types/MockPortfolioValuesFeed"
import { MockChainlinkAggregator } from "../../types/MockChainlinkAggregator"
import { Oracle } from "../../types/Oracle"
import { setupTestOracle } from "../../test/helpers"

const chainId = 1

const addressPath = path.join(__dirname, "..", "..", "contracts.json")

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deploy, execute, read, log } = deployments
	const { deployer } = await getNamedAccounts()

	// reset hardat and impersonate account for ownership
	await hre.network.provider.request({
		method: "hardhat_reset",
		params: [
			{
				forking: {
					chainId: 1,
					jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
					blockNumber: 14290000
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
	const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
	const senderAddress = await signers[0].getAddress()

	const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

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

	// deploy libraries
	const constantsFactory = await hre.ethers.getContractFactory("Constants")
	const constants = await constantsFactory.deploy()

	// deploy oracle
	const res = await setupTestOracle(await sender.getAddress())
	const oracle = res[0] as Oracle
	const opynAggregator = res[1] as MockChainlinkAggregator

	// deploy system
	let deployParams = await deploySystem(signers, oracle, opynAggregator)
	const weth = deployParams.weth
	const wethERC20 = deployParams.wethERC20
	const usd = deployParams.usd
	const optionRegistry = deployParams.optionRegistry
	const priceFeed = deployParams.priceFeed
	const volFeed = deployParams.volFeed
	const portfolioValuesFeed = deployParams.portfolioValuesFeed
	const optionProtocol = deployParams.optionProtocol

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
		portfolioValuesFeed
	)
	const volatility = lpParams.volatility
	const liquidityPool = lpParams.liquidityPool
	const handler = lpParams.handler
	const receiverAddress = await signers[1].getAddress()

	let contractAddresses

	try {
		// @ts-ignore
		contractAddresses = JSON.parse(fs.readFileSync(addressPath))
	} catch {
		contractAddresses = { localhost: {} }
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

	fs.writeFileSync(addressPath, JSON.stringify(contractAddresses, null, 4))
}

func.tags = ["localhost"]
export default func
function ZERO_ADDRESS(arg0: string, arg1: string, arg2: BigNumber, ZERO_ADDRESS: any): any {
	throw new Error("Function not implemented.")
}
