import hre, { ethers } from "hardhat"

const multicallAddress = "0xA07C27805B17F4E5f6ab696A9Acf223B4aA78B60"
const pvFeedAddress = "0x7f9d820CFc109686F2ca096fFA93dd497b91C073"

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
