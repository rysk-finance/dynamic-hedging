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
			"0xF18C263aA3926f1AaBb879Cb9fF5905E40239fF4"
		) as BeyondPricer

        await pricer.setFeePerContract(500000)
        await pricer.setRiskFreeRate(0)
        await pricer.setBidAskIVSpread(0)
        await pricer.setCollateralLendingRate(40000)
        await pricer.setDeltaBorrowRates({sellLong: 19500, sellShort: 15000, buyLong: 15000, buyShort: 19500})
        await pricer.setSlippageGradient(toWei("0.0001"))
        await pricer.setDeltaBandWidth(toWei("5"),
        [
            toWei("32.03079203078064"),
            toWei("31.878274585633"),
            toWei("31.58602118332404"),
            toWei("31.15446923851714"),
            toWei("30.61983012863621"),
            toWei("30.02751862352724"),
            toWei("29.76793598877384"),
            toWei("29.51965103798659"),
            toWei("29.27589652184065"),
            toWei("29.15813224691419"),
            toWei("28.89918904808979"),
            toWei("28.79395354628805"),
            toWei("28.59621097502779"),
            toWei("28.53193609853176"),
            toWei("28.49647421070104"),
            toWei("28.67212963708871"),
            toWei("28.55318769450707"),
            toWei("28.46149657037454"),
            toWei("28.40969916260404"),
            toWei("28.35790175483355")
        ],
        [
            toWei("32.0626957760057"),
            toWei("31.993108078547117"),
            toWei("31.810983791965135"),
            toWei("31.43481548633707"),
            toWei("30.974590543073322"),
            toWei("30.668836938634346"),
            toWei("30.604289472424558"),
            toWei("30.37288983067886"),
            toWei("30.0304814467131"),
            toWei("29.992446607725974"),
            toWei("29.813904329921087"),
            toWei("29.50780508052873"),
            toWei("29.31535898140196"),
            toWei("29.626966203258913"),
            toWei("30.08913219416901"),
            toWei("29.098197656692076"),
            toWei("29.41624225234537"),
            toWei("29.3254848787627"),
            toWei("29.080503786931374"),
            toWei("28.890374")
        ]
         )
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





    