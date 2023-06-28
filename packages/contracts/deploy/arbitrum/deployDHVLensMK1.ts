import hre, { ethers } from "hardhat"
import { DHVLensMK1 } from "../../types/DHVLensMK1"

// update these addresses to connect to the appropriate set of contracts

const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
const catalogueAddress = "0x44227Dc2a1d71FC07DC254Dfd42B1C44aFF12168"
const pricerAddress = "0xeA5Fb118862876f249Ff0b3e7fb25fEb38158def"
const optionProtocolAddress = "0x4e920e9A901069d9b211646B6E191d81BA40E5FB"

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

	console.log("DHV lens contract deployed")

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
		console.log("DHV lens verified")
	} catch (err: any) {
		console.log(err)
		console.log("DHV lens contract already verified")
	}
}

deployLens()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
