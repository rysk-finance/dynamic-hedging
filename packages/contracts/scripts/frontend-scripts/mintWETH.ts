import "@nomiclabs/hardhat-ethers"
import hre from "hardhat"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { arbitrumGoerli } from "../../contracts.json"
import { toWei } from "../../utils/conversion-helper"


async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}

		const weth = await hre.ethers.getContractAt(
			"MintableERC20",
			"0x53320bE2A35649E9B2a0f244f9E9474929d3B699"
		)

		const pvTransaction = await weth.mint( "0xAD5B468F6Fb897461E388396877fD5E3c5114539", toWei("1000000000"))

		await pvTransaction.wait()

		console.log("weth minted")
	} catch (err) {
		console.log(err)
	}
}

main()
	.then(() => process.exit())
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
