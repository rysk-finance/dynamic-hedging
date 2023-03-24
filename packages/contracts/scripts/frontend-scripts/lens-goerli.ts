
import hre, { ethers } from "hardhat"
import { DHVLensMK1 } from "../../types/DHVLensMK1"


export async function runLens() {
	const lens = await ethers.getContractAt(
		"DHVLensMK1",
		"0xd6cacC01BE01cB0a5dE6763697f9daf75A75d059"
	) as DHVLensMK1
	const expirations = await lens.getExpirations()
	for (let i = 0; i < expirations.length; i++) {
		const vals = await lens.getOptionExpirationDrill(expirations[i])
		console.log({vals})
	} 

}

runLens()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
