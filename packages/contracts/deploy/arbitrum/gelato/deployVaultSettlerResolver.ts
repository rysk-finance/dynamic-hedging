import hre, { ethers } from "hardhat"

const main = async () => {
	const [deployer] = await ethers.getSigners()
	console.log("Deploying contracts with the account:", deployer.address)

	const resolverFactory = await ethers.getContractFactory("DeltaSettlerResolver")
	const resolver = await resolverFactory.deploy()

	try {
		await hre.run("verify:verify", {
			address: resolver.address,
			constructorArguments: []
		})

		console.log("resolver verified")
	} catch (err: any) {
		if (err.message.includes("Reason: Already Verified")) {
			console.log("resolver contract already verified")
		}
		console.log(err)
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
