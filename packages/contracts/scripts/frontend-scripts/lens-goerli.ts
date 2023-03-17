
import hre, { ethers } from "hardhat"
import { DHVLensMK1 } from "../../types/DHVLensMK1"


export async function runLens() {
	const lens = await ethers.getContractAt(
		"DHVLensMK1",
		"0x65A42f9b4dCa884E1A4E40678F8165111efbC254"
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
