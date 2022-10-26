import { BigNumber, Signer, utils, BigNumberish, Contract } from "ethers"
import { expect } from "chai"
import fs from "fs"
import { truncate } from "@ragetrade/sdk"
import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import path from "path"
import LiquidityPoolSol from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import {
	WETH,
	ERC20Interface,
	MintableERC20,
	OptionRegistry,
	PriceFeed,
	VolatilityFeed,
	OptionHandler,
	Protocol,
	LiquidityPool,
	MockPortfolioValuesFeed,
	Accounting,
	BlackScholes,
	NormalDist,
	PerpHedgingReactor,
	Oracle
} from "../../types"

/* To use for other chains:
		- Change addresses below to deployed contracts on new chain
		- Swap out Mock portfolio values feed factory for real one
		- Check liquidity pool deploy params
*/

const addressPath = path.join(__dirname, "..", "..", "..", "contracts.json")

//	Arbitrum rinkeby specific contract addresses. Change for other networks

const chainlinkOracleAddress = "0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08"
const gammaOracleAddress = "0x34B39BE930E33241dDE56771833f1FCDAE904589"
const opynControllerProxyAddress = "0x4f4997F374CA0b7c186a2e810EA457A4d0419f2A"
const opynAddressBookAddress = "0x275729e6070974dAe4dF534C9900305d8BE07391"
const opynNewCalculatorAddress = "0xBd0e0beeBa90A9E4879a69de0Db13D5E22d4AC5d"
const oTokenFactoryAddress = "0xb06F6759aEbdeBf84f67B1420CddcC20e27e1E03"
const marginPoolAddress = "0xFfE2F86401f1CEFd69BAF2DB6fdB95326649A7d0"

// rage trade addresses for Arbitrum Goerli
const clearingHouseAddress = "0x7047343e3eF25505263116212EE74430A2A12257"
const vETHAddress = "0xC85c06FCF9355876DF51a90C2c0290ECa913A04f"
const usdcAddress = "0x6775842ae82bf2f0f987b10526768ad89d79536e"
const wethAddress = "0x53320bE2A35649E9B2a0f244f9E9474929d3B699"

const linkTokenAddress = "0xd14838a68e8afbade5efb411d5871ea0011afd28"

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
// 90 days in seconds
const maxExpiry = 86400 * 90

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
		contractAddresses = { localhost: {}, arbitrumGoerli: {} }
	}

	// @ts-ignore
	contractAddresses["arbitrumGoerli"]["OpynController"] = opynControllerProxyAddress
	contractAddresses["arbitrumGoerli"]["OpynAddressBook"] = opynAddressBookAddress
	contractAddresses["arbitrumGoerli"]["OpynOracle"] = gammaOracleAddress
	contractAddresses["arbitrumGoerli"]["OpynNewCalculator"] = opynNewCalculatorAddress
	contractAddresses["arbitrumGoerli"]["OpynOptionRegistry"] = optionRegistry.address
	contractAddresses["arbitrumGoerli"]["priceFeed"] = priceFeed.address
	contractAddresses["arbitrumGoerli"]["volFeed"] = volFeed.address
	contractAddresses["arbitrumGoerli"]["optionProtocol"] = optionProtocol.address
	contractAddresses["arbitrumGoerli"]["liquidityPool"] = liquidityPool.address
	contractAddresses["arbitrumGoerli"]["authority"] = authority.address
	contractAddresses["arbitrumGoerli"]["portfolioValuesFeed"] = portfolioValuesFeed.address
	contractAddresses["arbitrumGoerli"]["optionHandler"] = handler.address
	contractAddresses["arbitrumGoerli"]["opynInteractions"] = interactions.address
	contractAddresses["arbitrumGoerli"]["normDist"] = normDist.address
	contractAddresses["arbitrumGoerli"]["BlackScholes"] = blackScholes.address
	contractAddresses["arbitrumGoerli"]["accounting"] = accounting.address
	contractAddresses["arbitrumGoerli"]["uniswapV3HedgingReactor"] = uniswapV3HedgingReactor.address
	contractAddresses["arbitrumGoerli"]["perpHedgingReactor"] = perpHedgingReactor.address
	contractAddresses["arbitrumGoerli"]["optionsCompute"] = optionsCompute.address

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
		console.log(err)
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
		console.log(err)
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
		console.log(err)
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
	pvFeed: MockPortfolioValuesFeed,
	authority: string,
	priceFeed: PriceFeed,
	blackScholes: BlackScholes
) {
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
	await pvFeed.setKeeper(liquidityPool.address, true)
	await liquidityPool.setMaxTimeDeviationThreshold(maxTimeDeviationThreshold)
	await liquidityPool.setMaxPriceDeviationThreshold(maxPriceDeviationThreshold)
	await pvFeed.setAddressStringMapping(wethAddress, wethAddress)
	await pvFeed.setAddressStringMapping(usdcAddress, usdcAddress)
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
				500,
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
