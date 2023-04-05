import "@nomiclabs/hardhat-ethers"
import hre, { ethers } from "hardhat"
import { BeyondPricer, BlackScholes, NormalDist, Protocol } from "../types"
import { scaleNum, toWei } from "../utils/conversion-helper"

// async function main() {
// 	try {
// 		if (!process.env.DEPLOYER_PRIVATE_KEY) {
// 			console.log("can't find private key")
// 			process.exit()
// 		}
// 		const exchange = await hre.ethers.getContractAt(
// 			"OptionExchange",
// 			"0xFCc90f3c220cF6637983347f49540E359ec07D8c"
// 		)
//         const normDistFactory = await ethers.getContractFactory(
//             "contracts/libraries/NormalDist.sol:NormalDist",
//             {
//                 libraries: {}
//             }
//         )
//         const normDist = (await normDistFactory.deploy()) as NormalDist
//         console.log("normal dist deployed")
    
//         try {
//             await hre.run("verify:verify", {
//                 address: normDist.address,
//                 constructorArguments: []
//             })
//             console.log("normDist verified")
//         } catch (err: any) {
//             console.log(err)
//         }
    
//         const blackScholesFactory = await ethers.getContractFactory(
//             "contracts/libraries/BlackScholes.sol:BlackScholes",
//             {
//                 libraries: {
//                     NormalDist: normDist.address
//                 }
//             }
//         )
//         const blackScholes = (await blackScholesFactory.deploy()) as BlackScholes
//         console.log("BS deployed")
    
//         try {
//             await hre.run("verify:verify", {
//                 address: blackScholes.address,
//                 constructorArguments: []
//             })
//             console.log("blackScholes verified")
//         } catch (err: any) {
//             console.log(err)
//         }

//         const PricerFactory = await ethers.getContractFactory("BeyondPricer", {
//             libraries: {
//                 BlackScholes: blackScholes.address
//             }
//         })
//         const pricer = (await PricerFactory.deploy(
//             "0x58a0D5c965F6Cc28a396b8282d0b73DfC99C7Cc1",
//             "0x20E97A4fd0633eDa3112392CC0D8BD62a846011f",
//             "0xfD93dB0a7c1e373bdfE9b141693a25E4deb79dF2",
//             "0xd6e67bF0b1Cdb34C37f31A2652812CB30746a94A",
//             toWei("0.0001"),
//             toWei("5"),
//             [
//                 toWei("1"),
//                 toWei("1.1"),
//                 toWei("1.2"),
//                 toWei("1.3"),
//                 toWei("1.4"),
//                 toWei("1.5"),
//                 toWei("1.6"),
//                 toWei("1.7"),
//                 toWei("1.8"),
//                 toWei("1.9"),
//                 toWei("2"),
//                 toWei("2.1"),
//                 toWei("2.2"),
//                 toWei("2.3"),
//                 toWei("2.4"),
//                 toWei("2.5"),
//                 toWei("2.6"),
//                 toWei("2.7"),
//                 toWei("2.8"),
//                 toWei("2.9")
//             ],
//             [
//                 toWei("1"),
//                 toWei("1.1"),
//                 toWei("1.2"),
//                 toWei("1.3"),
//                 toWei("1.4"),
//                 toWei("1.5"),
//                 toWei("1.6"),
//                 toWei("1.7"),
//                 toWei("1.8"),
//                 toWei("1.9"),
//                 toWei("2"),
//                 toWei("2.1"),
//                 toWei("2.2"),
//                 toWei("2.3"),
//                 toWei("2.4"),
//                 toWei("2.5"),
//                 toWei("2.6"),
//                 toWei("2.7"),
//                 toWei("2.8"),
//                 toWei("2.9")
//             ],
//             40000,
//             {sellLong: 19500, sellShort: 15000, buyLong: 15000, buyShort: 19500}
//         )) as BeyondPricer
		
//         try {
//             await hre.run("verify:verify", {
//                 address: pricer.address,
//                 constructorArguments: [
//                     "0x58a0D5c965F6Cc28a396b8282d0b73DfC99C7Cc1",
//                     "0x20E97A4fd0633eDa3112392CC0D8BD62a846011f",
//                     "0xfD93dB0a7c1e373bdfE9b141693a25E4deb79dF2",
//                     "0xd6e67bF0b1Cdb34C37f31A2652812CB30746a94A",
//                     toWei("0.0001"),
//                     toWei("5"),
//                     [
//                         toWei("1"),
//                         toWei("1.1"),
//                         toWei("1.2"),
//                         toWei("1.3"),
//                         toWei("1.4"),
//                         toWei("1.5"),
//                         toWei("1.6"),
//                         toWei("1.7"),
//                         toWei("1.8"),
//                         toWei("1.9"),
//                         toWei("2"),
//                         toWei("2.1"),
//                         toWei("2.2"),
//                         toWei("2.3"),
//                         toWei("2.4"),
//                         toWei("2.5"),
//                         toWei("2.6"),
//                         toWei("2.7"),
//                         toWei("2.8"),
//                         toWei("2.9")
//                     ],
//                     [
//                         toWei("1"),
//                         toWei("1.1"),
//                         toWei("1.2"),
//                         toWei("1.3"),
//                         toWei("1.4"),
//                         toWei("1.5"),
//                         toWei("1.6"),
//                         toWei("1.7"),
//                         toWei("1.8"),
//                         toWei("1.9"),
//                         toWei("2"),
//                         toWei("2.1"),
//                         toWei("2.2"),
//                         toWei("2.3"),
//                         toWei("2.4"),
//                         toWei("2.5"),
//                         toWei("2.6"),
//                         toWei("2.7"),
//                         toWei("2.8"),
//                         toWei("2.9")
//                     ],
//                     40000,
//                     {sellLong: 19500, sellShort: 15000, buyLong: 15000, buyShort: 19500}
//                 ]
//             })
//             await exchange.setPricer(pricer.address)
//             console.log("pricer verified")
//         } catch (err: any) {
//             console.log(err)
//         }

// 	} catch (err) {
// 		console.log(err)
// 	}
// }

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


// async function main() {
// 	try {
// 		if (!process.env.DEPLOYER_PRIVATE_KEY) {
// 			console.log("can't find private key")
// 			process.exit()
// 		}

// 		const pricer = await hre.ethers.getContractAt(
// 			"BeyondPricer",
// 			"0xd857e2e104D2493CE7EF12Ed04aCEAfD8b833033"
// 		)
        
//         const authority = await hre.ethers.getContractAt(
//             "Authority",
//             "0x58a0D5c965F6Cc28a396b8282d0b73DfC99C7Cc1"
//         )
//         // await authority.pullGovernor()
// 		await pricer.setFeePerContract(500000)
//         await pricer.setRiskFreeRate(0)
//         await pricer.setBidAskIVSpread(0)
//         await pricer.setCollateralLendingRate(40000)
//         await pricer.setDeltaBorrowRates({sellLong: 19500, sellShort: 15000, buyLong: 15000, buyShort: 19500})
		

// 	} catch (err) {
// 		console.log(err)
// 	}
// }

// main()
// 	.then(() => process.exit())
// 	.catch(error => {
// 		console.error(error)
// 		process.exit(1)
// 	})


// async function main() {
// 	try {
// 		if (!process.env.DEPLOYER_PRIVATE_KEY) {
// 			console.log("can't find private key")
// 			process.exit()
// 		}

// 		const calculator = await hre.ethers.getContractAt(
// 			"MarginCalculator",
// 			"0xcD270e755C2653e806e16dD3f78E16C89B7a1c9e"
// 		)
//         const day = 60 * 60 * 24
//         const timeToExpiry = [
//             day * 7, 
//             day * 14,
//             day * 28, 
//             day * 42, 
//             day * 56, 
//             day * 84
//         ]

//         const expiryToValuePuts = [
//             scaleNum("0.13450634965266337", 27),
//             scaleNum("0.1743636615770228", 27),
//             scaleNum("0.239321068989108", 27),
//             scaleNum("0.2974790984983397", 27),
//             scaleNum("0.3465422329949044", 27),
//             scaleNum("0.4300353956191806", 27)
//         ]

//         const expiryToValueCalls = [
//             scaleNum("0.12669600464771857", 27),
//             scaleNum("0.16068273273671582", 27),
//             scaleNum("0.2160991051547266", 27),
//             scaleNum("0.2628549745250929", 27),
//             scaleNum("0.3133534880128994", 27),
//             scaleNum("0.3861588491865918", 27)
//         ]

// 		await calculator.setSpotShock("0x53320bE2A35649E9B2a0f244f9E9474929d3B699", "0x6775842ae82bf2f0f987b10526768ad89d79536e", "0x6775842ae82bf2f0f987b10526768ad89d79536e", false, ethers.utils.parseUnits("0.9", 27))
//         await calculator.setSpotShock("0x53320bE2A35649E9B2a0f244f9E9474929d3B699", "0x6775842ae82bf2f0f987b10526768ad89d79536e", "0x6775842ae82bf2f0f987b10526768ad89d79536e", true, ethers.utils.parseUnits("0.9", 27))
//         await calculator.setUpperBoundValues(
//             "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", 
//             "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
//             "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
//             true, 
//             timeToExpiry,
//             expiryToValuePuts
//             )
//         await calculator.setUpperBoundValues(
//             "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", 
//             "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
//             "0x6775842ae82bf2f0f987b10526768ad89d79536e", 
//             false, 
//             timeToExpiry,
//             expiryToValueCalls
//             )

// 	} catch (err) {
// 		console.log(err)
// 	}
// }

// main()
// 	.then(() => process.exit())
// 	.catch(error => {
// 		console.error(error)
// 		process.exit(1)
// 	})

    