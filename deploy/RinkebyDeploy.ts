import { Signer, BigNumber } from "ethers"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction, DeployResult } from "hardhat-deploy/types"
import { ethers, deployments, getNamedAccounts } from "hardhat"
import { getContractFromDeploy } from "../utils/deploy"
import { PriceFeed } from "../types/PriceFeed"
import { OptionRegistryV0 } from "../types/OptionRegistryV0"
import { LiquidityPools } from "../types/LiquidityPools"

const ETH_USD_AGGREGATOR = "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e"
const USDC_ADDRESS = "0x4dbcdf9b62e891a7cec5a2568c3f4faf9e8abe2b"
const WETH9_ADDRESS = "0xc778417E063141139Fce010982780140Aa0cD5Ab"
const IMPLIED_VOL = "60"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deploy, execute, read, log } = deployments
	const { deployer } = await getNamedAccounts()
	const signers: Signer[] = await ethers.getSigners()
	const [signer] = signers
	const signerAddress = await signer.getAddress()

	let abdkMathDeploy: DeployResult = await deploy("ABDKMathQuad", {
		from: deployer,
		log: true
	})

	let PRBMathSD60x18Deploy: DeployResult = await deploy("PRBMathUint", {
		from: deployer,
		log: true
	})

	let PRBMathSD59x18Deploy: DeployResult = await deploy("PRBMathInt", {
		from: deployer,
		log: true
	})

	let normDistDeploy: DeployResult = await deploy("NormalDist", {
		from: deployer,
		log: true,
		libraries: {
			ABDKMathQuad: abdkMathDeploy.address
		}
	})

	let blackScholesDeploy: DeployResult = await deploy("BlackScholes", {
		from: deployer,
		log: true,
		libraries: {
			ABDKMathQuad: abdkMathDeploy.address,
			NormalDist: normDistDeploy.address
		}
	})

	let constantsDeploy: DeployResult = await deploy("Constants", {
		from: deployer,
		log: true
	})

	let optionRegistryDeploy: DeployResult = await deploy("OptionRegistryV0", {
		from: deployer,
		libraries: {
			Constants: constantsDeploy.address
		},
		args: [USDC_ADDRESS],
		log: true
	})

	let optionRegistry: OptionRegistryV0 = (getContractFromDeploy(
		optionRegistryDeploy,
		signer
	) as unknown) as OptionRegistryV0

	let pricefeedDeploy: DeployResult = await deploy("PriceFeed", {
		from: deployer,
		log: true
	})

	const priceFeed: PriceFeed = (getContractFromDeploy(
		pricefeedDeploy,
		signer
	) as unknown) as PriceFeed
	await priceFeed.addPriceFeed(WETH9_ADDRESS, USDC_ADDRESS, ETH_USD_AGGREGATOR)

	let indliquidityPoolsDeploy: DeployResult = await deploy("IndependentLiquidityPool", {
		from: deployer,
		log: true,
		libraries: {
			Constants: constantsDeploy.address,
			NormalDist: normDistDeploy.address,
			ABDKMathQuad: abdkMathDeploy.address,
			PRBMathUint: PRBMathSD60x18Deploy.address,
			PRBMathInt: PRBMathSD59x18Deploy.address,
			BlackScholes: blackScholesDeploy.address
		},
		args: [
			pricefeedDeploy.address,
			optionRegistryDeploy.address,
			USDC_ADDRESS,
			WETH9_ADDRESS,
			"3",
			IMPLIED_VOL,
			"WETH/USDC",
			"WEUSDC"
		]
	})
	await hre.run("verify:verify", {
		address: indliquidityPoolsDeploy.address,
		constructorArguments: [
			pricefeedDeploy.address,
			optionRegistryDeploy.address,
			USDC_ADDRESS,
			WETH9_ADDRESS,
			"3",
			IMPLIED_VOL,
			"WETH/USDC",
			"WEUSDC"
		],
		libraries: {
			Constants: constantsDeploy.address
		}
	})
}

func.tags = ["testnet"]
export default func
