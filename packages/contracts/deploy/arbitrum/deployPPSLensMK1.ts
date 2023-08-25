
import { deployments, getNamedAccounts, ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { getAddresses } from "../utils/lensAddress"
import { PPSLensMK1 } from "../../types/PPSLensMK1"


// update these addresses to connect to the appropriate set of contracts

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const addresses = getAddresses(hre.network.name)
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()
	const normDistFactory = await ethers.getContractFactory(
		"contracts/libraries/NormalDist.sol:NormalDist",
		{
			libraries: {}
		}
	)
	const normDist = await normDistFactory.deploy()
	const blackScholesFactory = await ethers.getContractFactory(
		"contracts/libraries/BlackScholes.sol:BlackScholes",
		{
			libraries: {
				NormalDist: normDist.address
			}
		}
	)
	const blackScholesDeploy = await blackScholesFactory.deploy()
	const lensFactory = await ethers.getContractFactory("PPSLensMK1",
	{libraries: {BlackScholes: blackScholesDeploy.address}}
	)
	const deployResult = (await lensFactory.deploy(
		addresses.protocol,
		addresses.usdc,
		addresses.weth,
		addresses.usdc,
		addresses.liquidityPool
	)) as PPSLensMK1
	console.log(`PPSMK1 deployed to: ${deployResult.address}`)

	try {
		await hre.run("verify:verify", {
			address: deployResult.address,
			constructorArguments: [
				addresses.protocol,
				addresses.usdc,
				addresses.weth,
				addresses.usdc,
				addresses.liquidityPool
			]
		})
		console.log("pps lens verified")
	} catch (err: any) {
		console.log(err)
		console.log("pps lens contract already verified")
	}
}

export default func

func.tags = ["PPSLensMK1"]

if (require.main === module) {
	//@ts-ignore
	func(hre)
}
