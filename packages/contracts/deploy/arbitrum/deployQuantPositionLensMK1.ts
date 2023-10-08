import hre, { ethers } from "hardhat"
import { QuantPositionLensMK1 } from "../../types/QuantPositionLensMK1"

// update these addresses to connect to the appropriate set of contracts

const protocolAddress = "0x4e920e9A901069d9b211646B6E191d81BA40E5FB"
const catalogueAddress = "0x44227Dc2a1d71FC07DC254Dfd42B1C44aFF12168"
const usdc = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
const weth = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"

export async function deployLens() {
	const lensFactory = await ethers.getContractFactory("QuantPositionLensMK1")
	const lens = (await lensFactory.deploy(
		protocolAddress,
		catalogueAddress,
		usdc,
		weth
	)) as QuantPositionLensMK1

	console.log("quant lens contract deployed")

	try {
		await hre.run("verify:verify", {
			address: lens.address,
			constructorArguments: [
				protocolAddress,
				catalogueAddress,
				usdc,
				weth
			]
		})
		console.log("quant lens verified")
	} catch (err: any) {
		console.log(err)
		console.log("quant lens contract already verified")
	}
}

deployLens()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
