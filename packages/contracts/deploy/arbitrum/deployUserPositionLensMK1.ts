import hre, { ethers } from "hardhat"
import { UserPositionLensMK1 } from "../../types/UserPositionLensMK1"

// update these addresses to connect to the appropriate set of contracts

const opynAddressBookAddress = "0xCa19F26c52b11186B4b1e76a662a14DA5149EA5a"
export async function deployLens() {
	const lensFactory = await ethers.getContractFactory("UserPositionLensMK1")
	const lens = (await lensFactory.deploy(
		opynAddressBookAddress
	)) as UserPositionLensMK1

	console.log("user position lens contract deployed")

	try {
		await hre.run("verify:verify", {
			address: lens.address,
			constructorArguments: [
				opynAddressBookAddress
			]
		})
		console.log("user position lens verified")
	} catch (err: any) {
		console.log(err)
		console.log("user position lens contract already verified")
	}
}

deployLens()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
