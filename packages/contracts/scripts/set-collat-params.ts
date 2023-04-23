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

		const calculator = await hre.ethers.getContractAt(
			"MarginCalculator",
			"0xcD270e755C2653e806e16dD3f78E16C89B7a1c9e"
		)
        const day = 60 * 60 * 24
        const timeToExpiry = [
            day * 7, 
            day * 14,
            day * 28, 
            day * 42, 
            day * 56, 
            day * 70,
            day * 84
        ]

        const expiryToValueCalls = [
            scaleNum("0.137310398921181", 27),
            scaleNum("0.21532271007278914", 27),
            scaleNum("0.28537036027751395", 27),
            scaleNum("0.3483113205978359", 27),
            scaleNum("0.4214755691406809", 27),
            scaleNum("0.49055405840298094", 27),
            scaleNum("0.5301302667777277", 27)
        ]

        const expiryToValuePuts = [
            scaleNum("0.16097528948543374", 27),
            scaleNum("0.23027824327552782", 27),
            scaleNum("0.3056523951032439", 27),
            scaleNum("0.38082167009044565", 27),
            scaleNum("0.4539548883445394", 27),
            scaleNum("0.5238145515841939", 27),
            scaleNum("0.5678502236865992", 27)
        ]

		await calculator.setSpotShock("0x53320bE2A35649E9B2a0f244f9E9474929d3B699", "0x6775842ae82bf2f0f987b10526768ad89d79536e", "0x6775842ae82bf2f0f987b10526768ad89d79536e", false, ethers.utils.parseUnits("1", 27))
        await calculator.setSpotShock("0x53320bE2A35649E9B2a0f244f9E9474929d3B699", "0x6775842ae82bf2f0f987b10526768ad89d79536e", "0x6775842ae82bf2f0f987b10526768ad89d79536e", true, ethers.utils.parseUnits("1", 27))

        for(let i=0; i < timeToExpiry.length; i++) {
            await calculator.updateUpperBoundValue(
                "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", 
                "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
                "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
                true, 
                timeToExpiry[i],
                expiryToValuePuts[i]
                )
            await calculator.updateUpperBoundValue(
                "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", 
                "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
                "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
                false, 
                timeToExpiry[i],
                expiryToValueCalls[i]
                )
        }

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
