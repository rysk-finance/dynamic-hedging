import hre, { ethers } from "hardhat"
import { UserPositionLensMK1 } from "../../types/UserPositionLensMK1"

// update these addresses to connect to the appropriate set of contracts

const addressBookAddress = "0xd6e67bF0b1Cdb34C37f31A2652812CB30746a94A"

export async function deployUserLens() {
	const lensFactory = await ethers.getContractFactory("UserPositionLensMK1")
	const lens = (await lensFactory.deploy(
		addressBookAddress
	)) as UserPositionLensMK1

	console.log("lens contract deployed")

	try {
		await hre.run("verify:verify", {
			address: lens.address,
			constructorArguments: [
				addressBookAddress
			]
		})
		console.log("lens verified")
	} catch (err: any) {
		console.log(err)
		console.log("lens contract already verified")
	}
}

deployUserLens()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
