
import { deployments, getNamedAccounts, ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { getAddresses } from "../utils/lensAddress"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	console.log(`Deploying DHVLensMK1 to ${hre.network.name}. Hit ctrl + c to abort`)

	const addresses = getAddresses(hre.network.name)
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()

	const deployResult = await deploy("DHVLensMK1", {
		from: deployer,
		args: [
			addresses.protocol,
			addresses.catalogue,
			addresses.pricer,
			addresses.usdc,
			addresses.weth,
			addresses.usdc,
			addresses.exchange
		],
		log: true
	})

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
				addresses.exchange
			]
		})
		console.log("DHV lens verified")
	} catch (verificationError) {
		console.log({verificationError})
	}
}

export default func

func.tags = ["DHVLensMK1"]

if (require.main === module) {
	//@ts-ignore
	func(hre)
}
