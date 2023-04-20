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
            scaleNum("0.06450397731816006", 27),
            scaleNum("0.09231833770011297", 27),
            scaleNum("0.13579500625405116", 27),
            scaleNum("0.16946505030414766", 27),
            scaleNum("0.18966040863879444", 27),
            scaleNum("0.21712954627555758", 27),
            scaleNum("0.2334277303931109", 27)
        ]

        const expiryToValuePuts = [
            scaleNum("0.07512407679605068", 27),
            scaleNum("0.10248639549205446", 27),
            scaleNum("0.13835981996663352", 27),
            scaleNum("0.17352015118659453", 27),
            scaleNum("0.201775324051628", 27),
            scaleNum("0.22504301373228863", 27),
            scaleNum("0.24491364798591958", 27)
        ]

		await calculator.setSpotShock("0x53320bE2A35649E9B2a0f244f9E9474929d3B699", "0x6775842ae82bf2f0f987b10526768ad89d79536e", "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", false, ethers.utils.parseUnits("1", 27))
        await calculator.setSpotShock("0x53320bE2A35649E9B2a0f244f9E9474929d3B699", "0x6775842ae82bf2f0f987b10526768ad89d79536e", "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", true, ethers.utils.parseUnits("1", 27))

        for(let i=0; i < timeToExpiry.length; i++) {
            await calculator.updateUpperBoundValue(
                "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", 
                "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
                "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", 
                true, 
                timeToExpiry[i],
                expiryToValuePuts[i]
                )
            await calculator.updateUpperBoundValue(
                "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", 
                "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
                "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", 
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
