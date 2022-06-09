import { BigNumber, Signer, utils, BigNumberish, Contract } from "ethers"
import { expect } from "chai"
import fs from "fs"
import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import path from "path"
import { Oracle } from "../../types/Oracle"
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

/* To use for other chains:
		- Change addresses below to deployed contracts on new chain
		- Swap out Mock portfolio values feed factory for real one
		- Check liquidity pool deploy params
*/

const addressPath = path.join(__dirname, "..", "..", "..", "contracts.json")

//	Arbitrum rinkeby specific contract addresses. Change for other networks
const chainlinkOracleAddress = "0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8"
const linkTokenAddress = "0x615fBe6372676474d9e6933d310469c9b68e9726"
const gammaOracleAddress = "0xe4d64aed5e76bCcE2C255f3c819f4C3817D42f19"
const opynControllerProxyAddress = "0x2acb561509a082bf2c58ce86cd30df6c2c2017f6"
const opynAddressBookAddress = "0x2d3E178FFd961BD8C0b035C926F9f2363a436DdC"
const opynNewCalculatorAddress = "0xa91B46bDDB891fED2cEE626FB03E2929702951A6"
const oTokenFactoryAddress = "0xcBcC61d56bb2cD6076E2268Ea788F51309FA253B"
const marginPoolAddress = "0xDD91EB7C3822552D89a5Cb8D4166B1EB19A36Ff2"
const wethAddress = "0xE32513090f05ED2eE5F3c5819C9Cce6d020Fefe7"
const usdcAddress = "0x3C6c9B6b41B9E0d82FeD45d9502edFFD5eD3D737"

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log("Deploying contracts with the account:", deployer.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())

	const gammaOracle = (await ethers.getContractAt("Oracle", gammaOracleAddress)) as Oracle

	// deploy system
	let deployParams = await deploySystem(deployer, gammaOracle, chainlinkOracleAddress)
	console.log("system deployed")
	const wethERC20 = deployParams.wethERC20
	const usd = deployParams.usd
	const optionRegistry = deployParams.optionRegistry
	const priceFeed = deployParams.priceFeed
	const volFeed = deployParams.volFeed
	const portfolioValuesFeed = deployParams.portfolioValuesFeed
	const optionProtocol = deployParams.optionProtocol
	const authority = deployParams.authority
	const interactions = deployParams.opynInteractions

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
		authority.address,
		priceFeed
	)
	const liquidityPool = lpParams.liquidityPool
	const handler = lpParams.handler
	const normDist = lpParams.normDist
	const BS = lpParams.blackScholesDeploy
	const optionsCompute = lpParams.optionsCompute
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
	contractAddresses["arbitrumRinkeby"]["OpynController"] = opynControllerProxyAddress
	contractAddresses["arbitrumRinkeby"]["OpynAddressBook"] = opynAddressBookAddress
	contractAddresses["arbitrumRinkeby"]["OpynOracle"] = gammaOracleAddress
	contractAddresses["arbitrumRinkeby"]["OpynNewCalculator"] = opynNewCalculatorAddress
	contractAddresses["arbitrumRinkeby"]["OpynOptionRegistry"] = optionRegistry.address
	contractAddresses["arbitrumRinkeby"]["priceFeed"] = priceFeed.address
	contractAddresses["arbitrumRinkeby"]["volFeed"] = volFeed.address
	contractAddresses["arbitrumRinkeby"]["optionProtocol"] = optionProtocol.address
	contractAddresses["arbitrumRinkeby"]["liquidityPool"] = liquidityPool.address
	contractAddresses["arbitrumRinkeby"]["authority"] = authority.address
	contractAddresses["arbitrumRinkeby"]["portfolioValuesFeed"] = portfolioValuesFeed.address
	contractAddresses["arbitrumRinkeby"]["optionHandler"] = handler.address
	contractAddresses["arbitrumRinkeby"]["opynInteractions"] = interactions.address
	contractAddresses["arbitrumRinkeby"]["normDist"] = normDist.address
	contractAddresses["arbitrumRinkeby"]["BlackScholes"] = BS.address
	contractAddresses["arbitrumRinkeby"]["optionsCompute"] = optionsCompute.address

	fs.writeFileSync(addressPath, JSON.stringify(contractAddresses, null, 4))

	console.log({
		OpynController: opynControllerProxyAddress,
		OpynAddressBook: opynAddressBookAddress,
		OpynOracle: gammaOracleAddress,
		OpynNewCalculator: opynNewCalculatorAddress,
		OpynOptionRegistry: optionRegistry.address,
		priceFeed: priceFeed.address,
		volFeed: volFeed.address,
		optionProtocol: optionProtocol.address,
		liquidityPool: liquidityPool.address,
		authority: authority.address,
		pvFeed: portfolioValuesFeed.address,
		optionHandler: handler.address,
		opynInteractions: interactions.address,
		normDist: normDist.address,
		blackScholes: BS.address,
		optionsCompute: optionsCompute.address
	})
	console.log(contractAddresses)
}

// --------- DEPLOY RYSK SYSTEM ----------------

export async function deploySystem(
	deployer: Signer,
	oracle: Oracle,
	chainlinkOracleAddress: string
) {
	const deployerAddress = await deployer.getAddress()
	// deploy libraries
	const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
	const interactions = await interactionsFactory.deploy()
	try {
		await hre.run("verify:verify", {
			address: interactions.address,
			constructorArguments: []
		})
		console.log("opynInterections verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("opynInteractions contract already verified")
		}
	}
	const authorityFactory = await ethers.getContractFactory("Authority")
	const authority = await authorityFactory.deploy(deployerAddress, deployerAddress, deployerAddress)
	console.log("authority deployed")
	try {
		await hre.run("verify:verify", {
			address: authority.address,
			constructorArguments: [deployerAddress, deployerAddress, deployerAddress]
		})
		console.log("authority verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("Authority contract already verified")
		}
	}
	// get weth and usdc contracts
	const weth = (await ethers.getContractAt(
		"contracts/interfaces/WETH.sol:WETH",
		wethAddress
	)) as WETH
	const wethERC20 = (await ethers.getContractAt("ERC20Interface", wethAddress)) as ERC20Interface
	const usd = (await ethers.getContractAt(
		"contracts/tokens/ERC20.sol:ERC20",
		usdcAddress
	)) as MintableERC20

	const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
	const priceFeed = (await priceFeedFactory.deploy(authority.address)) as PriceFeed
	console.log("priceFeed deployed")

	try {
		await hre.run("verify:verify", {
			address: priceFeed.address,
			constructorArguments: [authority.address]
		})
		console.log("priceFeed verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("priceFeed contract already verified")
		}
	}

	await priceFeed.addPriceFeed(weth.address, usd.address, chainlinkOracleAddress)

	const volFeedFactory = await ethers.getContractFactory("VolatilityFeed")
	const volFeed = (await volFeedFactory.deploy(authority.address)) as VolatilityFeed
	console.log("volFeed deployed")

	try {
		await hre.run("verify:verify", {
			address: volFeed.address,
			constructorArguments: [authority.address]
		})
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("volFeed contract already verified")
		}
	}

	console.log("volFeed verified")

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

	/* ********* Mock contract - swap for real on prod ********* */
	const portfolioValuesFeedFactory = await ethers.getContractFactory("MockPortfolioValuesFeed")
	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		deployerAddress,
		utils.formatBytes32String("jobId"),
		toWei("1"),
		linkTokenAddress,
		authority.address
	)) as MockPortfolioValuesFeed
	console.log("mock portfolio values feed deployed")

	try {
		await hre.run("verify:verify", {
			address: portfolioValuesFeed.address,
			constructorArguments: [
				deployerAddress,
				utils.formatBytes32String("jobId"),
				toWei("1"),
				linkTokenAddress,
				authority.address
			]
		})

		console.log("portfolio values feed verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("pvFeed contract already verified")
		}
	}

	// deploy options registry
	const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
		libraries: {
			OpynInteractions: interactions.address
		}
	})
	console.log(deployerAddress, authority.address)
	const optionRegistry = (await optionRegistryFactory.deploy(
		usd.address, // usdc
		oTokenFactoryAddress,
		opynControllerProxyAddress,
		marginPoolAddress,
		deployerAddress,
		opynAddressBookAddress,
		authority.address,
		{ gasLimit: BigNumber.from("500000000") }
	)) as OptionRegistry
	console.log("option registry deployed")

	try {
		await hre.run("verify:verify", {
			address: optionRegistry.address,
			constructorArguments: [
				usd.address, // usdc
				oTokenFactoryAddress,
				opynControllerProxyAddress,
				marginPoolAddress,
				deployerAddress,
				opynAddressBookAddress,
				authority.address
			]
		})
		console.log("optionRegistry verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("optionRegistry contract already verified")
		}
	}

	const protocolFactory = await ethers.getContractFactory("contracts/Protocol.sol:Protocol")
	const optionProtocol = (await protocolFactory.deploy(
		optionRegistry.address,
		priceFeed.address,
		volFeed.address,
		portfolioValuesFeed.address,
		authority.address
	)) as Protocol
	console.log("protocol deployed")
	try {
		await hre.run("verify:verify", {
			address: optionProtocol.address,
			constructorArguments: [
				optionRegistry.address,
				priceFeed.address,
				volFeed.address,
				portfolioValuesFeed.address,
				authority.address
			]
		})
		console.log("optionProtocol verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("optionProtocol contract already verified")
		}
	}

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
		authority: authority,
		opynInteractions: interactions
	}
}

// --------- DEPLOY LIQUIDITY POOL AND RELATED LIBRARIES ----------------

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
	authority: string,
	priceFeed: PriceFeed
) {
	const normDistFactory = await ethers.getContractFactory("NormalDist", {
		libraries: {}
	})
	const normDist = await normDistFactory.deploy()
	console.log("normal dist deployed")

	try {
		await hre.run("verify:verify", {
			address: normDist.address,
			constructorArguments: []
		})
		console.log("normDist verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("normDist contract already verified")
		}
	}

	const volFactory = await ethers.getContractFactory("Volatility", {
		libraries: {}
	})
	const volatility = (await volFactory.deploy()) as Volatility
	console.log("volatility deployed")

	try {
		await hre.run("verify:verify", {
			address: volatility.address,
			constructorArguments: []
		})
		console.log("volatility verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("volatility contract already verified")
		}
	}
	const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
		libraries: {
			NormalDist: normDist.address
		}
	})
	const blackScholesDeploy = await blackScholesFactory.deploy()
	console.log("BS deployed")

	try {
		await hre.run("verify:verify", {
			address: blackScholesDeploy.address,
			constructorArguments: []
		})
		console.log("blackScholes verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("blackScholes contract already verified")
		}
	}

	const optionsCompFactory = await await ethers.getContractFactory("OptionsCompute", {
		libraries: {}
	})
	const optionsCompute = await optionsCompFactory.deploy()
	console.log("options compute deployed")

	try {
		await hre.run("verify:verify", {
			address: optionsCompute.address,
			constructorArguments: []
		})
		console.log("optionsCompute verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("optionsCompute contract already verified")
		}
	}
	const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
		libraries: {
			BlackScholes: blackScholesDeploy.address,
			OptionsCompute: optionsCompute.address
		}
	})

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

	console.log("lp deployed")

	const lpAddress = lp.address
	const liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, deployer) as LiquidityPool

	try {
		await hre.run("verify:verify", {
			address: lpAddress,
			constructorArguments: [
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
				authority
			]
		})
		console.log("liquidityPool verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("liquidityPool contract already verified")
		}
	}
	await optionRegistry.setLiquidityPool(liquidityPool.address)
	console.log("registry lp set")

	await liquidityPool.setMaxTimeDeviationThreshold(600)
	await liquidityPool.setMaxPriceDeviationThreshold(toWei("1"))
	await liquidityPool.setBidAskSpread(toWei("0.05"))
	await pvFeed.setAddressStringMapping(wethAddress, wethAddress)
	await pvFeed.setAddressStringMapping(usdcAddress, usdcAddress)
	await pvFeed.setLiquidityPool(liquidityPool.address)
	console.log("pv feed lp set")

	const price = await priceFeed.getNormalizedRate(weth.address, usd.address)
	console.log({ price })
	await pvFeed.fulfill(
		utils.formatBytes32String("1"),
		weth.address,
		usd.address,
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		BigNumber.from(0),
		price
	)
	console.log("pv feed fulfilled")

	const handlerFactory = await ethers.getContractFactory("OptionHandler")
	const handler = (await handlerFactory.deploy(
		authority,
		optionProtocol.address,
		liquidityPool.address
	)) as OptionHandler
	console.log("option handler deployed")

	try {
		await hre.run("verify:verify", {
			address: handler.address,
			constructorArguments: [authority, optionProtocol.address, liquidityPool.address]
		})
		console.log("optionHander verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("optionHander contract already verified")
		}
	}

	await liquidityPool.changeHandler(handler.address, true)
	console.log("lp handler set")

	return {
		volatility: volatility,
		normDist,
		blackScholesDeploy,
		optionsCompute,
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
