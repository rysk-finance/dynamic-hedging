import "@nomiclabs/hardhat-ethers"
import hre, { ethers } from "hardhat"
import { BeyondPricer, BlackScholes, NormalDist, PriceFeed, Protocol } from "../types"
import { CALL_FLAVOR, scaleNum, toWei } from "../utils/conversion-helper"


async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}
        const protocol = await hre.ethers.getContractAt(
			"contracts/Protocol.sol:Protocol",
			"0x20E97A4fd0633eDa3112392CC0D8BD62a846011f"
		) as Protocol
        const volFeedFactory = await ethers.getContractFactory("VolatilityFeed")
        const volFeed = (await volFeedFactory.deploy("0x58a0D5c965F6Cc28a396b8282d0b73DfC99C7Cc1")) as VolatilityFeed
        console.log("volFeed deployed")
    
        try {
            await hre.run("verify:verify", {
                address: volFeed.address,
                constructorArguments: ["0x58a0D5c965F6Cc28a396b8282d0b73DfC99C7Cc1"]
            })
        } catch (err: any) {
            console.log(err)
        }
            await protocol.changeVolatilityFeed(volFeed.address)
            console.log("pricer verified")
        } catch (err: any) {
            console.log(err)
        }

}

main()
	.then(() => process.exit())
	.catch(error => {
		console.error(error)
		process.exit(1)
	})