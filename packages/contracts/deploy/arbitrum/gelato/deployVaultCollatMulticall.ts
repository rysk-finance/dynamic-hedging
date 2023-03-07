import hre, { ethers } from "hardhat"

const executorAddress = "0xA67D0C1180E0e183f482304A9b5436A3478F0674" // rysk deployer mainnet
const optionRegistryAddress = "0x04706DE6cE851a284b569EBaE2e258225D952368"

const main = async () => {
	const [deployer] = await ethers.getSigners()
	console.log("Deploying contracts with the account:", deployer.address)

	const multicallFactory = await ethers.getContractFactory("VaultCollateralMulticall")
	const multicall = await multicallFactory.deploy(executorAddress, optionRegistryAddress)

	try {
		await hre.run("verify:verify", {
			address: multicall.address,
			constructorArguments: [executorAddress, optionRegistryAddress]
		})
		console.log("normDist verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("normDist contract already verified")
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
