import { BigNumber, Signer, utils, BigNumberish, Contract } from "ethers"
import { expect } from "chai"

import fs from "fs"
import { toWei } from "../../utils/conversion-helper"
import { ethers, network } from "hardhat"
import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import path from "path"
import { CHAINLINK_WETH_PRICER } from "../../test/constants"
import { setupTestOracle } from "../../test/helpers"
import { MockChainlinkAggregator } from "../../types/MockChainlinkAggregator"
import { Oracle } from "../../types/Oracle"
import { scaleNum } from "../../utils/conversion-helper"
import { deployOpyn } from "../../utils/opyn-deployer"
import { WETH } from "../../types/WETH"
import { ERC20Interface } from "../../types/ERC20Interface"
import { MintableERC20 } from "../../types/MintableERC20"
import { OptionRegistry } from "../../types/OptionRegistry"
import { PriceFeed } from "../../types/PriceFeed"
import { VolatilityFeed } from "../../types/VolatilityFeed"
import { OptionHandler } from "../../types/OptionHandler"
import { Protocol } from "../../types/Protocol"
import { Volatility } from "../../types/Volatility"
import { LiquidityPool } from "../../types/LiquidityPool"
import LiquidityPoolSol from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { MockPortfolioValuesFeed } from "../../types/MockPortfolioValuesFeed"

const chainId = 4214611
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const addressPath = path.join(__dirname, "..", "..", "..", "contracts.json")

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log("Deploying contracts with the account:", deployer.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())

	// // deploy opyn contract
	// let opynParams = await deployOpyn(signers, productSpotShockValue, timeToExpiry, expiryToValue)
	// const opynController = opynParams.controller
	// const opynAddressBook = opynParams.addressBook
	// const opynOracle = opynParams.oracle
	// const opynNewCalculator = opynParams.newCalculator

	// // deploy oracle
	// const res = await setupTestOracle(await deployer.getAddress())
	// const oracle = res[0] as Oracle
	// const opynAggregator = res[1] as MockChainlinkAggregator

	const oracle = (await ethers.getContractAt(
		"Oracle",
		"0xe4d64aed5e76bCcE2C255f3c819f4C3817D42f19"
	)) as Oracle

	// deploy system
	let deployParams = await deploySystem(
		deployer,
		oracle,
		"0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8"
	)
	console.log("system deployed")
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
		deployer,
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
	console.log("liquidity pool deployed")

	liquidityPool.setMaxTimeDeviationThreshold(1000000000000000)

	let contractAddresses

	try {
		// @ts-ignore
		contractAddresses = JSON.parse(fs.readFileSync(addressPath))
	} catch {
		contractAddresses = { localhost: {}, arbitrumRinkeby: {} }
	}

	// @ts-ignore
	contractAddresses["arbitrumRinkeby"]["OpynController"] =
		"0x2acb561509a082bf2c58ce86cd30df6c2c2017f6"
	contractAddresses["arbitrumRinkeby"]["OpynAddressBook"] =
		"0x2d3E178FFd961BD8C0b035C926F9f2363a436DdC"
	contractAddresses["arbitrumRinkeby"]["OpynOracle"] = "0xe4d64aed5e76bCcE2C255f3c819f4C3817D42f19"
	contractAddresses["arbitrumRinkeby"]["OpynNewCalculator"] =
		"0xa91B46bDDB891fED2cEE626FB03E2929702951A6"
	contractAddresses["arbitrumRinkeby"]["OpynOptionRegistry"] = optionRegistry.address
	contractAddresses["arbitrumRinkeby"]["priceFeed"] = priceFeed.address
	contractAddresses["arbitrumRinkeby"]["volFeed"] = volFeed.address
	contractAddresses["arbitrumRinkeby"]["optionProtocol"] = optionProtocol.address
	contractAddresses["arbitrumRinkeby"]["liquidityPool"] = liquidityPool.address
	contractAddresses["arbitrumRinkeby"]["authority"] = authority.address
	contractAddresses["arbitrumRinkeby"]["portfolioValuesFeed"] = portfolioValuesFeed.address
	contractAddresses["arbitrumRinkeby"]["optionHandler"] = handler.address

	fs.writeFileSync(addressPath, JSON.stringify(contractAddresses, null, 4))

	console.log({
		OpynController: "0x2acb561509a082bf2c58ce86cd30df6c2c2017f6",
		OpynAddressBook: "0x2d3E178FFd961BD8C0b035C926F9f2363a436DdC",
		OpynOracle: "0xe4d64aed5e76bCcE2C255f3c819f4C3817D42f19",
		OpynNewCalculator: "0xa91B46bDDB891fED2cEE626FB03E2929702951A6",
		OpynOptionRegistry: optionRegistry.address,
		priceFeed: priceFeed.address,
		volFeed: volFeed.address,
		optionProtocol: optionProtocol.address,
		liquidityPool: liquidityPool.address,
		authority: authority.address,
		pvFeed: portfolioValuesFeed.address,
		optionHandler: handler.address
	})
	console.log(contractAddresses)
}

export async function deploySystem(
	deployer: Signer,
	oracle: Oracle,
	chainlinkOracleAddress: string
) {
	const deployerAddress = await deployer.getAddress()
	// deploy libraries
	const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
	const interactions = await interactionsFactory.deploy()
	const authorityFactory = await ethers.getContractFactory("Authority")
	const authority = await authorityFactory.deploy(deployerAddress, deployerAddress, deployerAddress)
	console.log("authority deployed")
	console.log("Account balance:", (await deployer.getBalance()).toString())

	// get and transfer weth
	const weth = (await ethers.getContractAt(
		"contracts/interfaces/WETH.sol:WETH",
		"0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
	)) as WETH
	const wethERC20 = (await ethers.getContractAt(
		"ERC20Interface",
		"0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
	)) as ERC20Interface
	const usd = (await ethers.getContractAt(
		"contracts/tokens/ERC20.sol:ERC20",
		"0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737"
	)) as MintableERC20

	const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
	const _priceFeed = (await priceFeedFactory.deploy(authority.address)) as PriceFeed
	console.log("priceFeed deployed")
	const priceFeed = _priceFeed
	await priceFeed.addPriceFeed(weth.address, usd.address, chainlinkOracleAddress)

	const volFeedFactory = await ethers.getContractFactory("VolatilityFeed")
	const volFeed = (await volFeedFactory.deploy(authority.address)) as VolatilityFeed
	console.log("volFeed deployed")
	type int7 = [
		BigNumberish,
		BigNumberish,
		BigNumberish,
		BigNumberish,
		BigNumberish,
		BigNumberish,
		BigNumberish
	]
	type number7 = [number, number, number, number, number, number, number]
	const coefInts: number7 = [
		1.42180236,
		0,
		-0.08626792,
		0.07873822,
		0.00650549,
		0.02160918,
		-0.1393287
	]
	//@ts-ignore
	const coefs: int7 = coefInts.map(x => toWei(x.toString()))
	await volFeed.setVolatilitySkew(coefs, true)
	await volFeed.setVolatilitySkew(coefs, false)
	console.log("vol feed skews set")
	const portfolioValuesFeedFactory = await ethers.getContractFactory("MockPortfolioValuesFeed")
	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		deployerAddress,
		utils.formatBytes32String("jobId"),
		toWei("1"),
		"0x615fBe6372676474d9e6933d310469c9b68e9726",
		authority.address
	)) as MockPortfolioValuesFeed
	console.log("mock portfolio values feed deployed")

	// deploy options registry
	const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
		libraries: {
			OpynInteractions: interactions.address
		}
	})
	console.log(deployerAddress, authority.address)
	const _optionRegistry = (await optionRegistryFactory.deploy(
		"0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737", // usdc
		"0xcBcC61d56bb2cD6076E2268Ea788F51309FA253B", // oToken Factory
		"0x2acb561509a082bf2c58ce86cd30df6c2c2017f6", // controller
		"0xDD91EB7C3822552D89a5Cb8D4166B1EB19A36Ff2", // margin pool
		deployerAddress,
		"0x2d3E178FFd961BD8C0b035C926F9f2363a436DdC", // address book
		authority.address,
		{ gasLimit: BigNumber.from("500000000") }
	)) as OptionRegistry
	console.log("option registry deployed")

	const optionRegistry = _optionRegistry
	// // deployed separately
	// const optionRegistry = (await ethers.getContractAt(
	// 	"OptionRegistry",
	// 	"0xA1f3D01BC3F5A074D3f092538bf2B6c52E47A16d" // option registry deployed address
	// )) as OptionRegistry
	const protocolFactory = await ethers.getContractFactory("contracts/Protocol.sol:Protocol")
	const optionProtocol = (await protocolFactory.deploy(
		optionRegistry.address,
		priceFeed.address,
		volFeed.address,
		portfolioValuesFeed.address,
		authority.address
	)) as Protocol
	console.log("protocol deployed")
	expect(await optionProtocol.optionRegistry()).to.equal(optionRegistry.address)

	return {
		weth: weth,
		wethERC20: wethERC20,
		usd: usd,
		optionRegistry: optionRegistry,
		priceFeed: priceFeed,
		volFeed: volFeed,
		portfolioValuesFeed: portfolioValuesFeed,
		optionProtocol: optionProtocol,
		authority: authority
	}
}

export async function deployLiquidityPool(
	deployer: Signer,
	optionProtocol: Protocol,
	usd: MintableERC20,
	weth: ERC20Interface,
	rfr: string,
	minCallStrikePrice: any,
	minPutStrikePrice: any,
	maxCallStrikePrice: any,
	maxPutStrikePrice: any,
	minExpiry: any,
	maxExpiry: any,
	optionRegistry: OptionRegistry,
	pvFeed: MockPortfolioValuesFeed,
	authority: string
) {
	const normDistFactory = await ethers.getContractFactory("NormalDist", {
		libraries: {}
	})
	const normDist = await normDistFactory.deploy()
	console.log("normal dist deployed")

	const volFactory = await ethers.getContractFactory("Volatility", {
		libraries: {}
	})
	const volatility = (await volFactory.deploy()) as Volatility
	console.log("volatility deployed")
	const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
		libraries: {
			NormalDist: normDist.address
		}
	})
	const blackScholesDeploy = await blackScholesFactory.deploy()
	console.log("BS deployed")
	const optionsCompFactory = await await ethers.getContractFactory("OptionsCompute", {
		libraries: {}
	})
	const optionsCompute = await optionsCompFactory.deploy()
	console.log("options compute deployed")
	const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
		libraries: {
			BlackScholes: blackScholesDeploy.address,
			OptionsCompute: optionsCompute.address
		}
	})
	console.log(
		optionProtocol.address,
		usd.address,
		weth.address,
		usd.address,
		toWei(rfr),
		"ETH/USDC",
		"EDP",
		{
			minCallStrikePrice,
			maxCallStrikePrice,
			minPutStrikePrice,
			maxPutStrikePrice,
			minExpiry: minExpiry,
			maxExpiry: maxExpiry
		},
		//@ts-ignore
		authority
	)
	const lp = (await liquidityPoolFactory.deploy(
		optionProtocol.address,
		usd.address,
		weth.address,
		usd.address,
		toWei(rfr),
		"ETH/USDC",
		"EDP",
		{
			minCallStrikePrice,
			maxCallStrikePrice,
			minPutStrikePrice,
			maxPutStrikePrice,
			minExpiry: minExpiry,
			maxExpiry: maxExpiry
		},
		//@ts-ignore
		authority,
		{ gasLimit: BigNumber.from("500000000") }
	)) as LiquidityPool
	// const lp = (await ethers.getContractAt(
	// 	"LiquidityPool",
	// 	"0x37f9c980e3155e7b8894bf6d7ef93752a7e357c4" // deployed LP address on arb rinkeby
	// )) as LiquidityPool
	console.log("lp deployed")

	const lpAddress = lp.address
	const liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, deployer) as LiquidityPool
	await optionRegistry.setLiquidityPool(liquidityPool.address)
	console.log("registry lp set")

	await liquidityPool.setMaxTimeDeviationThreshold(600)
	await liquidityPool.setMaxPriceDeviationThreshold(toWei("1"))
	await liquidityPool.setBidAskSpread(toWei("0.05"))
	await pvFeed.setAddressStringMapping(
		"0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7", // weth address
		"0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
	)
	await pvFeed.setAddressStringMapping(
		"0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737", // usdc address
		"0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737"
	)
	await pvFeed.setLiquidityPool(liquidityPool.address)
	console.log("pv feed lp set")

	await pvFeed.fulfill(
		utils.formatBytes32String("1"),
		weth.address,
		usd.address,
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0)
	)
	console.log("pv feed fulfilled")

	const handlerFactory = await ethers.getContractFactory("OptionHandler")
	const handler = (await handlerFactory.deploy(
		authority,
		optionProtocol.address,
		liquidityPool.address
	)) as OptionHandler
	console.log("option handler deployed")

	await liquidityPool.changeHandler(handler.address, true)
	console.log("lp handler set")

	return {
		volatility: volatility,
		liquidityPool: liquidityPool,
		handler: handler
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})

// func.tags = ["localhost"]
// export default func
// function ZERO_ADDRESS(arg0: string, arg1: string, arg2: BigNumber, ZERO_ADDRESS: any): any {
// 	throw new Error("Function not implemented.")
// }
