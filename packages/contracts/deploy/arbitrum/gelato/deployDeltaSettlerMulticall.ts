import hre, { ethers } from "hardhat"

const authorityAddress = "0x74948DAf8Beb3d14ddca66d205bE3bc58Df39aC9"
const optionRegistryAddress = "0x8Bc23878981a207860bA4B185fD065f4fd3c7725"
const controllerAddress = "0x594bD4eC29F7900AE29549c140Ac53b5240d4019"
const liquidityPoolAddress = "0x217749d9017cB87712654422a1F5856AAA147b80"

const main = async () => {
	const [deployer] = await ethers.getSigners()
	console.log("Deploying contracts with the account:", deployer.address)

	const multicallFactory = await ethers.getContractFactory("DeltaSettlerMulticall")
	const multicall = await multicallFactory.deploy(
		authorityAddress,
		optionRegistryAddress,
		controllerAddress,
		liquidityPoolAddress
	)

	try {
		await hre.run("verify:verify", {
			address: multicall.address,
			constructorArguments: [
				authorityAddress,
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
