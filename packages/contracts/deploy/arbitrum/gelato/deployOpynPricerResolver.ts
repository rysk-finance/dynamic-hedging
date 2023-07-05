import hre, { ethers } from "hardhat"

const addressBookAddress = "0xCa19F26c52b11186B4b1e76a662a14DA5149EA5a"

const main = async () => {
	const [deployer] = await ethers.getSigners()
	console.log("Deploying contracts with the account:", deployer.address)

	const resolverFactory = await ethers.getContractFactory("OpynPricerResolver")
	const resolver = await resolverFactory.deploy(addressBookAddress)

	try {
		await hre.run("verify:verify", {
			address: resolver.address,
			constructorArguments: [addressBookAddress]
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
