import { BigNumber, Signer, utils, Contract } from "ethers"
import { expect } from "chai"
import fs from "fs"
import { truncate } from "@ragetrade/sdk"
import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import path from "path"
import { WETH } from "../../types/WETH"
import { ERC20Interface } from "../../types/ERC20Interface"
import { MintableERC20 } from "../../types/MintableERC20"
import { OptionRegistry } from "../../types/OptionRegistry"
import { PriceFeed } from "../../types/PriceFeed"
import { VolatilityFeed } from "../../types/VolatilityFeed"
import { AlphaOptionHandler } from "../../types/AlphaOptionHandler"
import { Protocol } from "../../types/Protocol"
import { LiquidityPool } from "../../types/LiquidityPool"
import LiquidityPoolSol from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { AlphaPortfolioValuesFeed } from "../../types/AlphaPortfolioValuesFeed"
import { Accounting } from "../../types/Accounting"
import { BlackScholes } from "../../types/BlackScholes"
import { NormalDist } from "../../types/NormalDist"
import { PerpHedgingReactor } from "../../types/PerpHedgingReactor"

const addressPath = path.join(__dirname, "..", "..", "..", "contracts.json")

//	Arbitrum mainnet specific contract addresses. Change for other networks
const chainlinkOracleAddress = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"
const gammaOracleAddress = "0xBA1880CFFE38DD13771CB03De896460baf7dA1E7"
const opynControllerProxyAddress = "0x594bD4eC29F7900AE29549c140Ac53b5240d4019"
const opynAddressBookAddress = "0xCa19F26c52b11186B4b1e76a662a14DA5149EA5a"
const opynNewCalculatorAddress = "0x749a3624ad2a001F935E3319743f53Ecc7466358"
const oTokenFactoryAddress = "0xBa1952eCdbA02de66fCf73f29068e8cf072644ec"
const marginPoolAddress = "0xb9F33349db1d0711d95c1198AcbA9511B8269626"
const multisig = "0xFBdE2e477Ed031f54ed5Ad52f35eE43CD82cF2A6"

const usdcAddress = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"

// rage trade addresses for Arbitrum
const clearingHouseAddress = "0x4521916972A76D5BFA65Fb539Cf7a0C2592050Ac"
const vETHAddress = "0x7ab08069a6ee445703116E4E09049E88a237af5E"

// uniswap v3 addresses (SAME FOR ALL CHAINS)
const uniswapV3SwapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

const rfr: string = "0"
const minCallStrikePrice = utils.parseEther("500")
const maxCallStrikePrice = utils.parseEther("5000")
const minPutStrikePrice = utils.parseEther("500")
const maxPutStrikePrice = utils.parseEther("5000")
const bidAskSpread = toWei("0.05")
const maxTimeDeviationThreshold = 600
const maxPriceDeviationThreshold = toWei("1")

const liquidityPoolTokenName = "Rysk DHV ETH/USDC"
const liquidityPoolTokenTicker = "ryUSDC-ETH"

// one week in seconds
const minExpiry = 86400 * 7
// 365 days in seconds
const maxExpiry = 86400 * 90

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log("Deploying contracts with the account:", deployer.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())

	// deploy system
	let deployParams = await deploySystem(deployer, chainlinkOracleAddress)
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
	const blackScholes = deployParams.blackScholes
	const normDist = deployParams.normDist

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
		priceFeed,
		blackScholes,
		normDist
	)
	const liquidityPool = lpParams.liquidityPool
	const handler = lpParams.handler
	const optionsCompute = lpParams.optionsCompute
	const accounting = lpParams.accounting
	const uniswapV3HedgingReactor = lpParams.uniswapV3HedgingReactor
	const perpHedgingReactor = lpParams.perpHedgingReactor
	console.log("liquidity pool deployed")

	let contractAddresses

	try {
		// @ts-ignore
		contractAddresses = JSON.parse(fs.readFileSync(addressPath))
	} catch {
		contractAddresses = { localhost: {}, arbitrum: {} }
	}

	// @ts-ignore
	contractAddresses["arbitrum"]["OpynController"] = opynControllerProxyAddress
	contractAddresses["arbitrum"]["OpynAddressBook"] = opynAddressBookAddress
	contractAddresses["arbitrum"]["OpynOracle"] = gammaOracleAddress
	contractAddresses["arbitrum"]["OpynNewCalculator"] = opynNewCalculatorAddress
	contractAddresses["arbitrum"]["OpynOptionRegistry"] = optionRegistry.address
	contractAddresses["arbitrum"]["priceFeed"] = priceFeed.address
	contractAddresses["arbitrum"]["volFeed"] = volFeed.address
	contractAddresses["arbitrum"]["optionProtocol"] = optionProtocol.address
	contractAddresses["arbitrum"]["liquidityPool"] = liquidityPool.address
	contractAddresses["arbitrum"]["authority"] = authority.address
	contractAddresses["arbitrum"]["portfolioValuesFeed"] = portfolioValuesFeed.address
	contractAddresses["arbitrum"]["optionHandler"] = handler.address
	contractAddresses["arbitrum"]["opynInteractions"] = interactions.address
	contractAddresses["arbitrum"]["normDist"] = normDist.address
	contractAddresses["arbitrum"]["BlackScholes"] = blackScholes.address
	contractAddresses["arbitrum"]["accounting"] = accounting.address
	contractAddresses["arbitrum"]["uniswapV3HedgingReactor"] = uniswapV3HedgingReactor.address
	contractAddresses["arbitrum"]["perpHedgingReactor"] = perpHedgingReactor.address

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
		blackScholes: blackScholes.address,
		optionsCompute: optionsCompute.address,
		accounting: accounting.address,
		uniswapV3HedgingReactor: uniswapV3HedgingReactor.address,
		perpHedgingReactor: perpHedgingReactor.address
	})
	console.log(contractAddresses)
}

// --------- DEPLOY RYSK SYSTEM ----------------

export async function deploySystem(deployer: Signer, chainlinkOracleAddress: string) {
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
	const authority = await authorityFactory.deploy(multisig, multisig, multisig)
	console.log("authority deployed")
	try {
		await hre.run("verify:verify", {
			address: authority.address,
			constructorArguments: [multisig, multisig, multisig]
		})
		console.log("authority verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("Authority contract already verified")
		}
	}

	const normDistFactory = await ethers.getContractFactory(
		"contracts/libraries/NormalDist.sol:NormalDist",
		{
			libraries: {}
		}
	)
	const normDist = (await normDistFactory.deploy()) as NormalDist
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

	const blackScholesFactory = await ethers.getContractFactory(
		"contracts/libraries/BlackScholes.sol:BlackScholes",
		{
			libraries: {
				NormalDist: normDist.address
			}
		}
	)
	const blackScholes = (await blackScholesFactory.deploy()) as BlackScholes
	console.log("BS deployed")

	try {
		await hre.run("verify:verify", {
			address: blackScholes.address,
			constructorArguments: []
		})
		console.log("blackScholes verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("blackScholes contract already verified")
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

	/* ********* Alpha contract - ********* */
	const portfolioValuesFeedFactory = await ethers.getContractFactory("AlphaPortfolioValuesFeed", {
		libraries: {
			BlackScholes: blackScholes.address
		}
	})
	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		authority.address
	)) as AlphaPortfolioValuesFeed
	console.log("alpha portfolio values feed deployed")

	try {
		await hre.run("verify:verify", {
			address: portfolioValuesFeed.address,
			constructorArguments: [authority.address]
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
		opynInteractions: interactions,
		blackScholes,
		normDist
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
	pvFeed: AlphaPortfolioValuesFeed,
	authority: string,
	priceFeed: PriceFeed,
	blackScholes: BlackScholes,
	normDist: NormalDist
) {
	const optionsCompFactory = await ethers.getContractFactory("OptionsCompute", {
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
			BlackScholes: blackScholes.address,
			OptionsCompute: optionsCompute.address
		}
	})

	const lp = (await liquidityPoolFactory.deploy(
		optionProtocol.address,
		usd.address,
		weth.address,
		usd.address,
		toWei(rfr),
		liquidityPoolTokenName,
		liquidityPoolTokenTicker,
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
				liquidityPoolTokenName,
				liquidityPoolTokenTicker,
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

	await liquidityPool.setBidAskSpread(bidAskSpread)
	await pvFeed.setLiquidityPool(liquidityPool.address)
	await pvFeed.setProtocol(optionProtocol.address)
	await pvFeed.setKeeper(liquidityPool.address, true)
	console.log("pv feed lp set")

	await pvFeed.fulfill(weth.address, usd.address)
	console.log("pv feed fulfilled")

	const accountingFactory = await ethers.getContractFactory("Accounting")
	const accounting = (await accountingFactory.deploy(liquidityPool.address)) as Accounting
	console.log("Accounting deployed")

	try {
		await hre.run("verify:verify", {
			address: accounting.address,
			constructorArguments: [liquidityPool.address, usd.address, weth.address, usd.address]
		})
		console.log("Accounting verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("Accounting contract already verified")
		}
	}

	const updateAccountingTx = await optionProtocol.changeAccounting(accounting.address)
	await updateAccountingTx.wait()

	const handlerFactory = await ethers.getContractFactory("AlphaOptionHandler")
	const handler = (await handlerFactory.deploy(
		authority,
		optionProtocol.address,
		liquidityPool.address
	)) as AlphaOptionHandler
	console.log("option handler deployed")

	try {
		await hre.run("verify:verify", {
			address: handler.address,
			constructorArguments: [authority, optionProtocol.address, liquidityPool.address]
		})
		console.log("optionHandler verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("optionHandler contract already verified")
		}
	}

	await pvFeed.setHandler(handler.address, true)
	await pvFeed.setKeeper(handler.address, true)
	await liquidityPool.changeHandler(handler.address, true)
	console.log("lp handler set")

	// deploy rage trade perpetual hedging reactor

	const perpHedgingReactorFactory = await ethers.getContractFactory("PerpHedgingReactor")
	const perpHedgingReactor = (await perpHedgingReactorFactory.deploy(
		clearingHouseAddress,
		usd.address,
		weth.address,
		liquidityPool.address,
		truncate(vETHAddress),
		truncate(usdcAddress),
		priceFeed.address,
		authority
	)) as PerpHedgingReactor

	console.log("perp hedging reactor deployed")

	try {
		await hre.run("verify:verify", {
			address: perpHedgingReactor.address,
			constructorArguments: [
				clearingHouseAddress,
				usd.address,
				weth.address,
				liquidityPool.address,
				truncate(vETHAddress),
				truncate(usdcAddress),
				priceFeed.address,
				authority
			]
		})
		console.log("perp hedging reactor verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("perp hedging reactor contract already verified")
		}
	}
	await usd.approve(perpHedgingReactor.address, 1)
	await perpHedgingReactor.initialiseReactor()
	console.log("Perp hedging reactor initialised")

	// deploy uniswap hedging reactor
	const uniswapV3HedgingReactorFactory = await ethers.getContractFactory("UniswapV3HedgingReactor")
	const uniswapV3HedgingReactor = await uniswapV3HedgingReactorFactory.deploy(
		uniswapV3SwapRouter,
		usd.address,
		weth.address,
		liquidityPool.address,
		3000,
		priceFeed.address,
		authority
	)
	console.log("Uniswap v3 hedging reactor deployed")
	try {
		await hre.run("verify:verify", {
			address: uniswapV3HedgingReactor.address,
			constructorArguments: [
				uniswapV3SwapRouter,
				usd.address,
				weth.address,
				liquidityPool.address,
				3000,
				priceFeed.address,
				authority
			]
		})
		console.log("Uniswap v3 hedging reactor verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("Uniswap v3 hedging reactor contract already verified")
		}
	}

	await liquidityPool.setHedgingReactorAddress(uniswapV3HedgingReactor.address)
	await liquidityPool.setHedgingReactorAddress(perpHedgingReactor.address)
	console.log("hedging reactors added to liquidity pool")

	return {
		normDist,
		blackScholes,
		optionsCompute,
		liquidityPool: liquidityPool,
		handler: handler,
		accounting,
		uniswapV3HedgingReactor,
		perpHedgingReactor
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
