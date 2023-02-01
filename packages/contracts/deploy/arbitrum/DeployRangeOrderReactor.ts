import { deployments, getNamedAccounts, ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { getAddresses } from "../utils/rangeOrderReactorAddress"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	console.log(`Deploying Uniswap Range Order Reactor to ${hre.network.name}. Hit ctrl + c to abort`)

	const addresses = getAddresses(hre.network.name)
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()

	const deployResult = await deploy("UniswapV3RangeOrderReactor", {
		from: deployer,
		args: [
			addresses.UniswapV3Factory,
			addresses.collateralAsset,
			addresses.underlyingAsset,
			addresses.liquidityPool,
			addresses.poolFee,
			addresses.priceFeed,
			addresses.authority
		],
		log: true
	})

	console.log(`UniswapRangeOrderReactor deployed to: ${deployResult.address}`)

	// verify contract
	try {
		await hre.run("verify:verify", {
			address: deployResult.address,
			constructorArguments: [
				addresses.UniswapV3Factory,
				addresses.collateralAsset,
				addresses.underlyingAsset,
				addresses.liquidityPool,
				addresses.poolFee,
				addresses.priceFeed,
				addresses.authority
			]
		})
	} catch (verificationError) {
		console.log({ verificationError })
	}
}

export default func

func.tags = ["UniswapRangeOrderReactorV1"]

if (require.main === module) {
	//@ts-ignore
	func(hre)
}
