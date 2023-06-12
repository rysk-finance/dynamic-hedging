import hre, { ethers } from "hardhat"
import { DHVLensMK1 } from "../../types/DHVLensMK1"

// update these addresses to connect to the appropriate set of contracts

const usdcAddress = "0x408c5755b5c7a0a28D851558eA3636CfC5b5b19d"
const wethAddress = "0x3b3a1dE07439eeb04492Fa64A889eE25A130CDd3"
const catalogueAddress = "0xde458dD32651F27A8895D4a92B7798Cdc4EbF2f0"
const pricerAddress = "0xc939df369C0Fc240C975A6dEEEE77d87bCFaC259"
const optionProtocolAddress = "0x81267CBE2d605b7Ae2328462C1EAF51a1Ab57fFd"

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
