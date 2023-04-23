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

		const pricer = await hre.ethers.getContractAt(
			"BeyondPricer",
			"0xd857e2e104D2493CE7EF12Ed04aCEAfD8b833033"
		)
        
        const authority = await hre.ethers.getContractAt(
            "Authority",
            "0x58a0D5c965F6Cc28a396b8282d0b73DfC99C7Cc1"
        )
        const lens = await hre.ethers.getContractAt(
            "DHVLensMK1",
            "0x5E0e91506C74beb73a7ff8e28aEB26120251d922"
        )
        const sequencerUptimeAddress = "0x4da69F028a5790fCCAfe81a75C0D24f46ceCDd69"
        const chainlinkOracleAddress = "0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08"
        const priceFeedFactory = await ethers.getContractFactory("contracts/PriceFeed.sol:PriceFeed")
        const priceFeed = (await priceFeedFactory.deploy(authority.address, sequencerUptimeAddress)) as PriceFeed
        console.log("priceFeed deployed")
    
        try {
            await hre.run("verify:verify", {
                address: priceFeed.address,
                constructorArguments: [authority.address, sequencerUptimeAddress]
            })
            console.log("priceFeed verified")
        } catch (err: any) {
            console.log(err)
        }
        const protocol = await hre.ethers.getContractAt(
			"contracts/Protocol.sol:Protocol",
			"0x20E97A4fd0633eDa3112392CC0D8BD62a846011f"
		) as Protocol
        await priceFeed.addPriceFeed("0x53320bE2A35649E9B2a0f244f9E9474929d3B699", "0x6775842ae82bf2f0f987b10526768ad89d79536e", chainlinkOracleAddress)
        await protocol.changePriceFeed(priceFeed.address)

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