
import { deployments, getNamedAccounts, ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { getAddresses } from "../utils/lensAddress"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	console.log(`Deploying DHVLensMK1 to ${hre.network.name}. Hit ctrl + c to abort`)

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
	const lensFactory = await ethers.getContractFactory("DHVLensMK1",
		{ libraries: { BlackScholes: blackScholesDeploy.address } })
	const deployResult = (await lensFactory.deploy(
		addresses.protocol,
		addresses.catalogue,
		addresses.pricer,
		addresses.usdc,
		addresses.weth,
		addresses.usdc,
		addresses.exchange,
		addresses.liquidityPool
	)) as DHVLensMK1

	console.log(`DHVLensMK1 deployed to: ${deployResult.address}`)

	try {
		await hre.run("verify:verify", {
			address: deployResult.address,
			constructorArguments: [
				addresses.protocol,
				addresses.catalogue,
				addresses.pricer,
				addresses.usdc,
				addresses.weth,
				addresses.usdc,
				addresses.exchange,
				addresses.liquidityPool
			]
		})
		console.log("DHV lens verified")
	} catch (verificationError) {
		console.log({ verificationError })
	}
}

export default func

func.tags = ["DHVLensMK1"]

if (require.main === module) {
	//@ts-ignore
	func(hre)
}
