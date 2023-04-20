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
			"0xFCc90f3c220cF6637983347f49540E359ec07D8c"
		) as BeyondPricer

        await pricer.setFeePerContract(500000)
        await pricer.setRiskFreeRate(0)
        await pricer.setBidAskIVSpread(0)
        await pricer.setCollateralLendingRate(40000)
        await pricer.setDeltaBorrowRates({sellLong: 19500, sellShort: 15000, buyLong: 15000, buyShort: 19500})
        // await pricer.setSlippageGradient()
        // console.log(await pricer.quoteOptionPrice({
        //     expiration: 1685088000,
        //     strike: toWei("2500"),
        //     isPut: CALL_FLAVOR,
        //     strikeAsset: "0x6775842ae82bf2f0f987b10526768ad89d79536e",
        //     underlying: "0x53320bE2A35649E9B2a0f244f9E9474929d3B699",
        //     collateral: "0x6775842ae82bf2f0f987b10526768ad89d79536e"
        // }, toWei("1"), false, 0))
		// console.log((await lens.getOptionExpirationDrill(1685088000))[2][3])

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





    