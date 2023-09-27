import hre, { ethers } from "hardhat"

const multicallAddress = "0xac344596a241A3D801db62C98f3B93b768eE7dB5"
const pvFeedAddress = "0xc7abaec336098cd0dcd98b67cb14d3b18e1c68a8"

const main = async () => {
	const [deployer] = await ethers.getSigners()
	console.log("Deploying contracts with the account:", deployer.address)

	const resolverFactory = await ethers.getContractFactory("DeltaSettlerResolver")
	const resolver = await resolverFactory.deploy(multicallAddress, pvFeedAddress)

	try {
		await hre.run("verify:verify", {
			address: resolver.address,
			constructorArguments: [multicallAddress, pvFeedAddress]
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
