import hre, { ethers } from "hardhat"
import { DHVLensMK1 } from "../../types/DHVLensMK1"

// update these addresses to connect to the appropriate set of contracts

const usdcAddress = "0x6775842ae82bf2f0f987b10526768ad89d79536e"
const wethAddress = "0x53320bE2A35649E9B2a0f244f9E9474929d3B699"
const catalogueAddress = "0xFE767C13EB75686817E4be774fAEEaBE93346887"
const pricerAddress = "0x1b8ffC43aA54e63CDDc0B5df23fb3A128D41A0b1"
const optionProtocolAddress = "0x20E97A4fd0633eDa3112392CC0D8BD62a846011f"

export async function deployLens() {
	const lensFactory = await ethers.getContractFactory("DHVLensMK1")
	const lens = (await lensFactory.deploy(
		optionProtocolAddress,
		catalogueAddress,
		pricerAddress,
		usdcAddress,
		wethAddress,
		usdcAddress
	)) as DHVLensMK1

	console.log("lens contract deployed")

	try {
		await hre.run("verify:verify", {
			address: lens.address,
			constructorArguments: [
				optionProtocolAddress,
				catalogueAddress,
				pricerAddress,
				usdcAddress,
				wethAddress,
				usdcAddress
			]
		})
		console.log("lens verified")
	} catch (err: any) {
		console.log(err)
		console.log("lens contract already verified")
	}
}

deployLens()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
