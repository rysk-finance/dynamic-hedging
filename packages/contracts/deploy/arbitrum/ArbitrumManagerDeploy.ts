import hre, { ethers } from "hardhat"

//	Arbitrum mainnet specific contract addresses. Change for other networks
const authorityAddress = "0x74948DAf8Beb3d14ddca66d205bE3bc58Df39aC9"
const liquidityPoolAddress = "0x217749d9017cB87712654422a1F5856AAA147b80"
const optionHandlerAddress = "0xc63717c4436043781a63C8c64B02Ff774350e8F8"
const catalogueAddress = "0x44227Dc2a1d71FC07DC254Dfd42B1C44aFF12168"
const exchangeAddress = "0xC117bf3103bd09552F9a721F0B8Bce9843aaE1fa"
const beyondPricerAddress = "0xeA5Fb118862876f249Ff0b3e7fb25fEb38158def"

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log("Deploying contracts with the account:", deployer.address)

	console.log("Account balance:", (await deployer.getBalance()).toString())
	// deploy system
	let deployParams = await deployManager(
		authorityAddress,
		liquidityPoolAddress,
		optionHandlerAddress,
		catalogueAddress,
		exchangeAddress,
		beyondPricerAddress
	)
	console.log("system deployed")
	console.log("manager address: ", deployParams.manager.address)
}

// --------- DEPLOY RYSK SYSTEM ----------------

export async function deployManager(
	authorityAddress: String,
	liquidityPoolAddress: String,
	optionHandlerAddress: String,
	catalogueAddress: String,
	exchangeAddress: String,
	beyondPricerAddress: String
) {
	const managerFactory = await ethers.getContractFactory("Manager")
	const manager = await managerFactory.deploy(
		authorityAddress: String,
		liquidityPoolAddress,
		optionHandlerAddress,
		catalogueAddress,
		exchangeAddress,
		beyondPricerAddress
	)
	console.log("manager deployed")
	try {
		await hre.run("verify:verify", {
			address: manager.address,
			constructorArguments: [
				authorityAddress,
				liquidityPoolAddress,
				optionHandlerAddress,
				catalogueAddress,
				exchangeAddress,
				beyondPricerAddress
			]
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
