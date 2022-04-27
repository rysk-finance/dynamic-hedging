import { BigNumberish, Contract, Signer, utils } from "ethers"
import fs from "fs"
import { deployments, ethers, getNamedAccounts, network } from "hardhat"
import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import path from "path"
import {
	ADDRESS_BOOK,
	GAMMA_CONTROLLER,
	GAMMA_ORACLE_NEW,
	MARGIN_POOL,
	OTOKEN_FACTORY
} from "../../test/constants"
import { toWei, scaleNum } from "../../utils/conversion-helper"
import LiquidityPoolSol from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"

import { USDC_ADDRESS, WETH_ADDRESS, CONTROLLER_OWNER } from "../../test/constants"
import { deployOpyn } from "../../utils/opyn-deployer"
import { OptionRegistry } from "../../types/OptionRegistry"
import { PriceFeed } from "../../types/PriceFeed"
import { Protocol } from "../../types/Protocol"
import { Volatility } from "../../types/Volatility"
import { MintableERC20 } from "../../types/MintableERC20"
import { WETH } from "../../types/WETH"
import { LiquidityPool } from "../../types/LiquidityPool"

const chainId = 1

const addressPath = path.join(__dirname, "..", "..", "contracts.json")

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deploy, execute, read, log } = deployments
	const { deployer } = await getNamedAccounts()
	const signers: Signer[] = await ethers.getSigners()

	// Deploy Opyn Contracts
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

	let opynParams = await deployOpyn(signers, productSpotShockValue, timeToExpiry, expiryToValue)

	const opynController = opynParams.controller
	const opynAddressBook = opynParams.addressBook
	const opynOracle = opynParams.oracle
	const opynNewCalculator = opynParams.newCalculator

	const [sender] = signers
	const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
	const senderAddress = await signers[0].getAddress()

	// deploy libraries
	const constantsFactory = await hre.ethers.getContractFactory("Constants")
	const interactionsFactory = await hre.ethers.getContractFactory("OpynInteractions")
	const constants = await constantsFactory.deploy()
	const interactions = await interactionsFactory.deploy()
	// deploy options registry
	const optionRegistryFactory = await hre.ethers.getContractFactory("OptionRegistry", {
		libraries: {
			OpynInteractions: interactions.address
		}
	})

	const _optionRegistry = (await optionRegistryFactory.deploy(
		USDC_ADDRESS[chainId],
		OTOKEN_FACTORY[chainId],
		GAMMA_CONTROLLER[chainId],
		MARGIN_POOL[chainId],
		senderAddress,
		ADDRESS_BOOK[chainId]
	)) as OptionRegistry

	let optionRegistry = _optionRegistry

	const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
	const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
	let priceFeed = _priceFeed

	// deploy option protocol and link to registry/price feed
	const protocolFactory = await ethers.getContractFactory("contracts/OptionsProtocol.sol:Protocol")
	const optionProtocol = (await protocolFactory.deploy(
		optionRegistry.address,
		priceFeed.address
	)) as Protocol

	// deploy liquidity pool
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

	const normDistFactory = await ethers.getContractFactory("NormalDist", {
		libraries: {}
	})
	const normDist = await normDistFactory.deploy()
	const volFactory = await ethers.getContractFactory("Volatility", {
		libraries: {}
	})
	const volatility = (await volFactory.deploy()) as Volatility
	const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
		libraries: {
			NormalDist: normDist.address
		}
	})
	const blackScholesDeploy = await blackScholesFactory.deploy()

	const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
		libraries: {
			BlackScholes: blackScholesDeploy.address
		}
	})

	let usd = (await ethers.getContractAt(
		"contracts/tokens/ERC20.sol:ERC20",
		USDC_ADDRESS[chainId]
	)) as MintableERC20

	let weth = (await ethers.getContractAt(
		"contracts/interfaces/WETH.sol:WETH",
		WETH_ADDRESS[chainId]
	)) as WETH

	const rfr: string = "0.03"
	const minCallStrikePrice = utils.parseEther("500")
	const maxCallStrikePrice = utils.parseEther("10000")
	const minPutStrikePrice = utils.parseEther("500")
	const maxPutStrikePrice = utils.parseEther("10000")
	// one week in seconds
	const minExpiry = 86400 * 7
	// 365 days in seconds
	const maxExpiry = 86400 * 365

	const lp = (await liquidityPoolFactory.deploy(
		optionProtocol.address,
		usd.address,
		weth.address,
		usd.address,
		toWei(rfr),
		coefs,
		coefs,
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
		await signers[0].getAddress()
	)) as LiquidityPool

	const lpAddress = lp.address
	let liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
	optionRegistry.setLiquidityPool(liquidityPool.address)

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
	contractAddresses["localhost"]["OpynOptionRegistry"] = _optionRegistry.address
	contractAddresses["localhost"]["priceFeed"] = priceFeed.address
	contractAddresses["localhost"]["optionProtocol"] = optionProtocol.address
	contractAddresses["localhost"]["liquidityPool"] = liquidityPool.address

	fs.writeFileSync(addressPath, JSON.stringify(contractAddresses, null, 4))
}

func.tags = ["localhost"]
export default func
