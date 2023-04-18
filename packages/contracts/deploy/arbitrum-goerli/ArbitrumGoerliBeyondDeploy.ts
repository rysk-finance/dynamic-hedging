import { BigNumber, Signer, utils, Contract } from "ethers"
import { expect } from "chai"
import fs from "fs"
import { truncate } from "@ragetrade/sdk"
import { toWei } from "../../utils/conversion-helper"
import hre, { ethers } from "hardhat"
import path from "path"
import {
	WETH,
	ERC20Interface,
	MintableERC20,
	OptionRegistry,
	PriceFeed,
	VolatilityFeed,
	AlphaOptionHandler,
	Protocol,
	LiquidityPool,
	AlphaPortfolioValuesFeed,
	Accounting,
	BlackScholes,
	NormalDist,
	PerpHedgingReactor,
	BeyondPricer,
	OptionCatalogue,
	OptionExchange,
	OpynInteractions,
	Manager,
	OptionsCompute,
	PermissionedMintableERC20
} from "../../types"

const addressPath = path.join(__dirname, "..", "..", "..", "contracts.json")

//	Arbitrum Goerli specific contract addresses. Change for other networks
const usdcAddress = "0x6775842ae82bf2f0f987b10526768ad89d79536e"
const wethAddress = "0x53320bE2A35649E9B2a0f244f9E9474929d3B699"
const chainlinkOracleAddress = "0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08"
const gammaOracleAddress = "0x35578F5A49E1f1Cf34ed780B46A0BdABA23D4C0b"
const opynControllerProxyAddress = "0x11a602a5F5D823c103bb8b7184e22391Aae5F4C2"
const opynAddressBookAddress = "0xd6e67bF0b1Cdb34C37f31A2652812CB30746a94A"
const opynNewCalculatorAddress = "0xcD270e755C2653e806e16dD3f78E16C89B7a1c9e"
const oTokenFactoryAddress = "0x7595F9c5B93f1478dC0836BdFCb87fF3A8970B10"
const marginPoolAddress = "0x0E0Ad3eA82EFAeAFb4476f5E8225b4746B88FD9f"
const sequencerUptimeAddress = "0x4da69F028a5790fCCAfe81a75C0D24f46ceCDd69"

// rage trade addresses for Arbitrum Goerli
const clearingHouseAddress = "0x7047343e3eF25505263116212EE74430A2A12257"
const vETHAddress = "0xC85c06FCF9355876DF51a90C2c0290ECa913A04f"

// uniswap v3 addresses (SAME FOR ALL CHAINS)
const uniswapV3SwapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

const rfr: string = "0"
const minCallStrikePrice = utils.parseEther("500")
const maxCallStrikePrice = utils.parseEther("5000")
const minPutStrikePrice = utils.parseEther("500")
const maxPutStrikePrice = utils.parseEther("5000")
const bidAskSpread = toWei("0.02")
const maxNetDhvExposure = toWei("50000")

const slippageGradient = toWei("0.0001")
const deltaBandWidth = toWei("5")
const callSlippageGradientMultipliers = [
	toWei("1"),
	toWei("1.1"),
	toWei("1.2"),
	toWei("1.3"),
	toWei("1.4"),
	toWei("1.5"),
	toWei("1.6"),
	toWei("1.7"),
	toWei("1.8"),
	toWei("1.9"),
	toWei("2"),
	toWei("2.1"),
	toWei("2.2"),
	toWei("2.3"),
	toWei("2.4"),
	toWei("2.5"),
	toWei("2.6"),
	toWei("2.7"),
	toWei("2.8"),
	toWei("2.9")
]
const putSlippageGradientMultipliers = [
	toWei("1"),
	toWei("1.1"),
	toWei("1.2"),
	toWei("1.3"),
	toWei("1.4"),
	toWei("1.5"),
	toWei("1.6"),
	toWei("1.7"),
	toWei("1.8"),
	toWei("1.9"),
	toWei("2"),
	toWei("2.1"),
	toWei("2.2"),
	toWei("2.3"),
	toWei("2.4"),
	toWei("2.5"),
	toWei("2.6"),
	toWei("2.7"),
	toWei("2.8"),
	toWei("2.9")
]
const collateralLendingRate = 100000
const deltaBorrowRates = {
	sellLong: 150000,
	sellShort: -100000,
	buyLong: 150000,
	buyShort: -100000
}

const liquidityPoolTokenName = "Rysk DHV ETH/USDC"
const liquidityPoolTokenTicker = "ryUSDC-ETH"

// one week in seconds
const minExpiry = 86400 * 1
// 90 days in seconds
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
	const optionsCompute = deployParams.optionsCompute

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
		interactions,
		optionsCompute
	)
	const liquidityPool = lpParams.liquidityPool
	const handler = lpParams.handler
	const accounting = lpParams.accounting
	const uniswapV3HedgingReactor = lpParams.uniswapV3HedgingReactor
	const perpHedgingReactor = lpParams.perpHedgingReactor
	const catalogue = lpParams.catalogue
	const pricer = lpParams.pricer
	const exchange = lpParams.exchange
	const manager = lpParams.manager
	console.log("liquidity pool deployed")

	await authority.pushManager(manager.address)
	await manager.pullManager()

	// let contractAddresses

	// try {
	// 	// @ts-ignore
	// 	contractAddresses = JSON.parse(fs.readFileSync(addressPath))
	// } catch {
	// 	contractAddresses = { localhost: {}, arbitrum: {} }
	// }

	// // @ts-ignore
	// contractAddresses["arbitrum"]["OpynController"] = opynControllerProxyAddress
	// contractAddresses["arbitrum"]["OpynAddressBook"] = opynAddressBookAddress
	// contractAddresses["arbitrum"]["OpynOracle"] = gammaOracleAddress
	// contractAddresses["arbitrum"]["OpynNewCalculator"] = opynNewCalculatorAddress
	// contractAddresses["arbitrum"]["OpynOptionRegistry"] = optionRegistry.address
	// contractAddresses["arbitrum"]["priceFeed"] = priceFeed.address
	// contractAddresses["arbitrum"]["volFeed"] = volFeed.address
	// contractAddresses["arbitrum"]["optionProtocol"] = optionProtocol.address
	// contractAddresses["arbitrum"]["liquidityPool"] = liquidityPool.address
	// contractAddresses["arbitrum"]["authority"] = authority.address
	// contractAddresses["arbitrum"]["portfolioValuesFeed"] = portfolioValuesFeed.address
	// contractAddresses["arbitrum"]["alphaOptionHandler"] = handler.address
	// contractAddresses["arbitrum"]["opynInteractions"] = interactions.address
	// contractAddresses["arbitrum"]["normDist"] = normDist.address
	// contractAddresses["arbitrum"]["BlackScholes"] = blackScholes.address
	// contractAddresses["arbitrum"]["accounting"] = accounting.address
	// contractAddresses["arbitrum"]["uniswapV3HedgingReactor"] = uniswapV3HedgingReactor.address
	// contractAddresses["arbitrum"]["perpHedgingReactor"] = perpHedgingReactor.address
	// contractAddresses["arbitrum"]["optionsCompute"] = optionsCompute.address
	// contractAddresses["arbitrum"]["optionCatalogue"] = catalogue.address
	// contractAddresses["arbitrum"]["optionExchange"] = exchange.address
	// contractAddresses["arbitrum"]["beyondPricer"] = pricer.address

	// fs.writeFileSync(addressPath, JSON.stringify(contractAddresses, null, 4))

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
		perpHedgingReactor: perpHedgingReactor.address,
		optionCatalogue: catalogue.address,
		optionExchange: exchange.address,
		beyondPricer: pricer.address,
		manager: manager.address
	})
	// console.log(contractAddresses)
}

// --------- DEPLOY RYSK SYSTEM ----------------

export async function deploySystem(deployer: Signer, chainlinkOracleAddress: string) {
	const deployerAddress = await deployer.getAddress()
	// deploy libraries
	const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
	const interactions = await interactionsFactory.deploy()
	// try {
	// 	await hre.run("verify:verify", {
	// 		address: interactions.address,
	// 		constructorArguments: []
	// 	})
	// 	console.log("opynInterections verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }
	const authorityFactory = await ethers.getContractFactory("Authority")
	const authority = await authorityFactory.deploy(deployerAddress, deployerAddress, deployerAddress)
	console.log("authority deployed")
	// try {
	// 	await hre.run("verify:verify", {
	// 		address: authority.address,
	// 		constructorArguments: [deployerAddress, deployerAddress, deployerAddress]
	// 	})
	// 	console.log("authority verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

	const normDistFactory = await ethers.getContractFactory(
		"contracts/libraries/NormalDist.sol:NormalDist",
		{
			libraries: {}
		}
	)
	const normDist = (await normDistFactory.deploy()) as NormalDist
	console.log("normal dist deployed")

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: normDist.address,
	// 		constructorArguments: []
	// 	})
	// 	console.log("normDist verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

	const optionsCompFactory = await ethers.getContractFactory("OptionsCompute", {
		libraries: {}
	})
	const optionsCompute = await optionsCompFactory.deploy()
	console.log("options compute deployed")

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: optionsCompute.address,
	// 		constructorArguments: []
	// 	})
	// 	console.log("optionsCompute verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

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

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: blackScholes.address,
	// 		constructorArguments: []
	// 	})
	// 	console.log("blackScholes verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

	// get weth and usdc contracts

	const wethFactory = await ethers.getContractFactory("PermissionedMintableERC20")
	const weth = (await wethFactory.deploy(
		"Wrapped Ether",
		"WETH",
		"18",
		authority.address
	)) as PermissionedMintableERC20

	console.log("WETH deployed")

	try {
		await hre.run("verify:verify", {
			address: weth.address,
			constructorArguments: ["Wrapped Ether", "WETH", "18", authority.address]
		})
		console.log("weth verified")
	} catch (err: any) {
		console.log(err)
	}

	const usdcFactory = await ethers.getContractFactory("PermissionedMintableERC20")
	const usd = (await usdcFactory.deploy(
		"USDC",
		"USDC",
		"6",
		authority.address
	)) as PermissionedMintableERC20
	console.log("USDC deployed")

	try {
		await hre.run("verify:verify", {
			address: usd.address,
			constructorArguments: ["USDC", "USDC", "6", authority.address]
		})
		console.log("usdc verified")
	} catch (err: any) {
		console.log(err)
	}

	// const weth = (await ethers.getContractAt(
	// 	"contracts/interfaces/WETH.sol:WETH",
	// 	wethAddress
	// )) as WETH
	// const wethERC20 = (await ethers.getContractAt("ERC20Interface", wethAddress)) as ERC20Interface
	// const usd = (await ethers.getContractAt(
	// 	"contracts/tokens/ERC20.sol:ERC20",
	// 	usdcAddress
	// )) as MintableERC20

	const priceFeedFactory = await ethers.getContractFactory("contracts/PriceFeed.sol:PriceFeed")
	const priceFeed = (await priceFeedFactory.deploy(
		authority.address,
		sequencerUptimeAddress
	)) as PriceFeed
	console.log("priceFeed deployed")

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: priceFeed.address,
	// 		constructorArguments: [authority.address, sequencerUptimeAddress]
	// 	})
	// 	console.log("priceFeed verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

	await priceFeed.addPriceFeed(weth.address, usd.address, chainlinkOracleAddress)

	const volFeedFactory = await ethers.getContractFactory("VolatilityFeed")
	const volFeed = (await volFeedFactory.deploy(authority.address)) as VolatilityFeed
	console.log("volFeed deployed")

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: volFeed.address,
	// 		constructorArguments: [authority.address]
	// 	})
	// } catch (err: any) {
	// 	console.log(err)
	// }

	console.log("volFeed verified")

	const portfolioValuesFeedFactory = await ethers.getContractFactory("AlphaPortfolioValuesFeed", {
		libraries: {
			BlackScholes: blackScholes.address
		}
	})
	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		authority.address,
		maxNetDhvExposure
	)) as AlphaPortfolioValuesFeed
	console.log("alpha portfolio values feed deployed")

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: portfolioValuesFeed.address,
	// 		constructorArguments: [authority.address, toWei("50000")]
	// 	})

	// 	console.log("portfolio values feed verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

	// deploy options registry
	const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
		libraries: {
			OpynInteractions: interactions.address,
			OptionsCompute: optionsCompute.address
		}
	})
	const optionRegistry = (await optionRegistryFactory.deploy(
		usd.address,
		deployerAddress,
		opynAddressBookAddress,
		authority.address,
		{ gasLimit: BigNumber.from("500000000") }
	)) as OptionRegistry
	console.log("option registry deployed")

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: optionRegistry.address,
	// 		constructorArguments: [usd.address, deployerAddress, opynAddressBookAddress, authority.address]
	// 	})
	// 	console.log("optionRegistry verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

	const protocolFactory = await ethers.getContractFactory("contracts/Protocol.sol:Protocol")
	const optionProtocol = (await protocolFactory.deploy(
		optionRegistry.address,
		priceFeed.address,
		volFeed.address,
		portfolioValuesFeed.address,
		authority.address
	)) as Protocol
	console.log("protocol deployed")
	// try {
	// 	await hre.run("verify:verify", {
	// 		address: optionProtocol.address,
	// 		constructorArguments: [
	// 			optionRegistry.address,
	// 			priceFeed.address,
	// 			volFeed.address,
	// 			portfolioValuesFeed.address,
	// 			authority.address
	// 		]
	// 	})
	// 	console.log("optionProtocol verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

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
		blackScholes: blackScholes,
		normDist: normDist,
		optionsCompute: optionsCompute
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
	interactions: OpynInteractions,
	optionsCompute: OptionsCompute
) {
	const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
		libraries: {
			OptionsCompute: optionsCompute.address
		}
	})

	const liquidityPool = (await liquidityPoolFactory.deploy(
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

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: liquidityPool.address,
	// 		constructorArguments: [
	// 			optionProtocol.address,
	// 			usd.address,
	// 			weth.address,
	// 			usd.address,
	// 			toWei(rfr),
	// 			liquidityPoolTokenName,
	// 			liquidityPoolTokenTicker,
	// 			{
	// 				minCallStrikePrice,
	// 				maxCallStrikePrice,
	// 				minPutStrikePrice,
	// 				maxPutStrikePrice,
	// 				minExpiry: minExpiry,
	// 				maxExpiry: maxExpiry
	// 			},
	// 			authority
	// 		]
	// 	})
	// 	console.log("liquidityPool verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }
	await optionRegistry.setLiquidityPool(liquidityPool.address)
	console.log("registry lp set")

	await liquidityPool.setMaxTimeDeviationThreshold(60000)
	await liquidityPool.setMaxPriceDeviationThreshold(toWei("0.3"))
	await pvFeed.setLiquidityPool(liquidityPool.address)
	await pvFeed.setProtocol(optionProtocol.address)
	await pvFeed.setKeeper(liquidityPool.address, true)
	console.log("pv feed lp set")

	await pvFeed.fulfill(weth.address, usd.address)
	console.log("pv feed fulfilled")

	const accountingFactory = await ethers.getContractFactory("Accounting")
	const accounting = (await accountingFactory.deploy(liquidityPool.address)) as Accounting
	console.log("Accounting deployed")

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: accounting.address,
	// 		constructorArguments: [liquidityPool.address]
	// 	})
	// 	console.log("Accounting verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

	const updateAccountingTx = await optionProtocol.changeAccounting(accounting.address)
	await updateAccountingTx.wait()

	const PricerFactory = await ethers.getContractFactory("BeyondPricer", {
		libraries: {
			BlackScholes: blackScholes.address
		}
	})
	const pricer = (await PricerFactory.deploy(
		authority,
		optionProtocol.address,
		liquidityPool.address,
		opynAddressBookAddress,
		slippageGradient,
		deltaBandWidth,
		callSlippageGradientMultipliers,
		putSlippageGradientMultipliers,
		collateralLendingRate,
		deltaBorrowRates
	)) as BeyondPricer

	console.log("pricer deployed")

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: pricer.address,
	// 		constructorArguments: [
	// 			authority,
	// 			optionProtocol.address,
	// 			liquidityPool.address,
	// 			opynAddressBookAddress,
	// 			slippageGradient,
	// 			deltaBandWidth,
	// 			callSlippageGradientMultipliers,
	// 			putSlippageGradientMultipliers,
	// 			collateralLendingRate,
	// 			deltaBorrowRates
	// 		]
	// 	})
	// 	console.log("pricer verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }

	const catalogueFactory = await ethers.getContractFactory("OptionCatalogue", {
		libraries: {
			OptionsCompute: optionsCompute.address
		}
	})
	const catalogue = (await catalogueFactory.deploy(authority, usd.address)) as OptionCatalogue

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: catalogue.address,
	// 		constructorArguments: [authority, usd.address]
	// 	})
	// 	console.log("catalogue verified")
	// } catch (err: any) {
	// 	console.log(err)
	// }
	// console.log("catalogue deployed")

	const exchangeFactory = await ethers.getContractFactory("OptionExchange", {
		libraries: {
			OpynInteractions: interactions.address,
			OptionsCompute: optionsCompute.address
		}
	})
	console.log("factory received")
	const exchange = (await exchangeFactory.deploy(
		authority,
		optionProtocol.address,
		liquidityPool.address,
		pricer.address,
		opynAddressBookAddress,
		uniswapV3SwapRouter,
		liquidityPool.address,
		catalogue.address,
		{ gasLimit: BigNumber.from("500000000") }
	)) as OptionExchange
	console.log("exchange deployed")
	try {
		await hre.run("verify:verify", {
			address: exchange.address,
			constructorArguments: [
				authority,
				optionProtocol.address,
				liquidityPool.address,
				pricer.address,
				opynAddressBookAddress,
				uniswapV3SwapRouter,
				liquidityPool.address,
				catalogue.address
			]
		})
		console.log("exchange verified")
	} catch (err: any) {
		console.log(err)
	}
	console.log("exchange deployed")

	await liquidityPool.changeHandler(exchange.address, true)
	await liquidityPool.setHedgingReactorAddress(exchange.address)

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
		console.log(err)
	}

	await liquidityPool.changeHandler(handler.address, true)
	await pvFeed.setKeeper(handler.address, true)
	await pvFeed.setKeeper(exchange.address, true)
	await pvFeed.setKeeper(liquidityPool.address, true)
	await pvFeed.setHandler(handler.address, true)
	await pvFeed.setHandler(exchange.address, true)
	console.log("lp handler set")

	// deploy proxy manager contract

	const managerFactory = await ethers.getContractFactory("Manager")
	const manager = await managerFactory.deploy(
		authority,
		liquidityPool.address,
		handler.address,
		catalogue.address,
		exchange.address,
		pricer.address
	)
	console.log("manager deployed")
	try {
		await hre.run("verify:verify", {
			address: manager.address,
			constructorArguments: [
				authority,
				liquidityPool.address,
				handler.address,
				catalogue.address,
				exchange.address,
				pricer.address
			]
		})
		console.log("manager verified")
	} catch (err: any) {
		console.log(err)
		if (err.message.includes("Reason: Already Verified")) {
			console.log("Manager contract already verified")
		}
	}

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
		console.log(err)
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
		console.log(err)
	}

	await liquidityPool.setHedgingReactorAddress(uniswapV3HedgingReactor.address)
	await liquidityPool.setHedgingReactorAddress(perpHedgingReactor.address)
	console.log("hedging reactors added to liquidity pool")

	return {
		liquidityPool: liquidityPool,
		handler: handler,
		accounting,
		uniswapV3HedgingReactor,
		perpHedgingReactor,
		catalogue,
		exchange,
		pricer,
		manager
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
