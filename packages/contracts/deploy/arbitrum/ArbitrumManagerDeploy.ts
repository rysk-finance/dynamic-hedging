import { Signer } from "ethers"
import hre, { ethers } from "hardhat"


//	Arbitrum mainnet specific contract addresses. Change for other networks
const authorityAddress = "0x0c83E447dc7f4045b8717d5321056D4e9E86dCD2"
const liquidityPoolAddress = "0xC10B976C671Ce9bFf0723611F01422ACbAe100A5"
const optionHandlerAddress = "0xA802795269588bf33739816f76B53fD6cd099b27"

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log("Deploying contracts with the account:", deployer.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())
	// deploy system
	let deployParams = await deployManager(deployer, authorityAddress, liquidityPoolAddress, optionHandlerAddress)
	console.log("system deployed")
        const manager = deployParams.manager
}

// --------- DEPLOY RYSK SYSTEM ----------------

export async function deployManager(deployer: Signer, authorityAddress: String, liquidityPoolAddress: String, optionHandlerAddress: String) {
	const managerFactory = await ethers.getContractFactory("Manager")
	const manager = await managerFactory.deploy(authorityAddress, liquidityPoolAddress, optionHandlerAddress)
	console.log("manager deployed")
	try {
		await hre.run("verify:verify", {
			address: manager.address,
			constructorArguments: [authorityAddress, liquidityPoolAddress, optionHandlerAddress]
		})
		console.log("manager verified")
	} catch (err: any) {
		console.log(err)
		if (err.message.includes("Reason: Already Verified")) {
			console.log("Manager contract already verified")
		}
	}
	return {
        manager
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})

