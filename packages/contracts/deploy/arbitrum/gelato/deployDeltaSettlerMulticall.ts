import hre, { ethers } from "hardhat"

const executorAddress = "0x40466D74cC36E70273f8127D035E51E5684160ef"
const optionRegistryAddress = "0x8Bc23878981a207860bA4B185fD065f4fd3c7725"
const controllerAddress = "0xC820739fEdF9A28bE29f73c29E167f0c14F1FE2a"
const liquidityPoolAddress = "0x217749d9017cB87712654422a1F5856AAA147b80"

const main = async () => {
	const [deployer] = await ethers.getSigners()
	console.log("Deploying contracts with the account:", deployer.address)

	const multicallFactory = await ethers.getContractFactory("DeltaSettlerMulticall")
	const multicall = await multicallFactory.deploy(
		executorAddress,
		optionRegistryAddress,
		controllerAddress,
		liquidityPoolAddress
	)

	try {
		await hre.run("verify:verify", {
			address: multicall.address,
			constructorArguments: [
				executorAddress,
				optionRegistryAddress,
				controllerAddress,
				liquidityPoolAddress
			]
		})
		console.log("multicall verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("multicall contract already verified")
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
