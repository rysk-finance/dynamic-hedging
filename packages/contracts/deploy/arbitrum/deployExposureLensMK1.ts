import hre, { ethers } from "hardhat"
import { ExposureLensMK1 } from "../../types/ExposureLensMK1"

// update these addresses to connect to the appropriate set of contracts

const protocolAddress = "0x4e920e9A901069d9b211646B6E191d81BA40E5FB"
export async function deployLens() {
	const lensFactory = await ethers.getContractFactory("ExposureLensMK1")
	const lens = (await lensFactory.deploy(
		protocolAddress
	)) as ExposureLensMK1

	console.log("exposure lens contract deployed")

	try {
		await hre.run("verify:verify", {
			address: lens.address,
			constructorArguments: [
				protocolAddress
			]
		})
		console.log("exposure lens verified")
	} catch (err: any) {
		console.log(err)
		console.log("exposure lens contract already verified")
	}
}

deployLens()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
