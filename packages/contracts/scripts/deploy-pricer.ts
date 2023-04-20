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
		const exchange = await hre.ethers.getContractAt(
			"OptionExchange",
			"0xFCc90f3c220cF6637983347f49540E359ec07D8c"
		)
        const normDistFactory = await ethers.getContractFactory(
            "contracts/libraries/NormalDist.sol:NormalDist",
            {
                libraries: {}
            }
        )
        const normDist = (await normDistFactory.deploy()) as NormalDist
        console.log("normal dist deployed")
    
        try {
            await hre.run("verify:verify", {
                address: normDist.address,
                constructorArguments: []
            })
            console.log("normDist verified")
        } catch (err: any) {
            console.log(err)
        }
    
        const blackScholesFactory = await ethers.getContractFactory(
            "contracts/libraries/BlackScholes.sol:BlackScholes",
            {
                libraries: {
                    NormalDist: normDist.address
                }
            }
        )
        const blackScholes = (await blackScholesFactory.deploy()) as BlackScholes
        console.log("BS deployed")
    
        try {
            await hre.run("verify:verify", {
                address: blackScholes.address,
                constructorArguments: []
            })
            console.log("blackScholes verified")
        } catch (err: any) {
            console.log(err)
        }

        const PricerFactory = await ethers.getContractFactory("BeyondPricer", {
            libraries: {
                BlackScholes: blackScholes.address
            }
        })
        const pricer = (await PricerFactory.deploy(
            "0x58a0D5c965F6Cc28a396b8282d0b73DfC99C7Cc1",
            "0x20E97A4fd0633eDa3112392CC0D8BD62a846011f",
            "0xfD93dB0a7c1e373bdfE9b141693a25E4deb79dF2",
            "0xd6e67bF0b1Cdb34C37f31A2652812CB30746a94A",
            toWei("0.0001"),
            toWei("5"),
            [
                toWei("1"),
                toWei("1.1"),
                toWei("1.2"),
                toWei("1.3"),
                toWei("1.4"),
                toWei("1.5"),
                toWei("1.6"),
                toWei("1.7"),
                toWei("1.8"),
                toWei("1.9"),
                toWei("2"),
                toWei("2.1"),
                toWei("2.2"),
                toWei("2.3"),
                toWei("2.4"),
                toWei("2.5"),
                toWei("2.6"),
                toWei("2.7"),
                toWei("2.8"),
                toWei("2.9")
            ],
            [
                toWei("1"),
                toWei("1.1"),
                toWei("1.2"),
                toWei("1.3"),
                toWei("1.4"),
                toWei("1.5"),
                toWei("1.6"),
                toWei("1.7"),
                toWei("1.8"),
                toWei("1.9"),
                toWei("2"),
                toWei("2.1"),
                toWei("2.2"),
                toWei("2.3"),
                toWei("2.4"),
                toWei("2.5"),
                toWei("2.6"),
                toWei("2.7"),
                toWei("2.8"),
                toWei("2.9")
            ],
            40000,
            {sellLong: 19500, sellShort: 15000, buyLong: 15000, buyShort: 19500}
        )) as BeyondPricer
		
        try {
            await hre.run("verify:verify", {
                address: pricer.address,
                constructorArguments: [
                    "0x58a0D5c965F6Cc28a396b8282d0b73DfC99C7Cc1",
                    "0x20E97A4fd0633eDa3112392CC0D8BD62a846011f",
                    "0xfD93dB0a7c1e373bdfE9b141693a25E4deb79dF2",
                    "0xd6e67bF0b1Cdb34C37f31A2652812CB30746a94A",
                    toWei("0.0001"),
                    toWei("5"),
                    [
                        toWei("1"),
                        toWei("1.1"),
                        toWei("1.2"),
                        toWei("1.3"),
                        toWei("1.4"),
                        toWei("1.5"),
                        toWei("1.6"),
                        toWei("1.7"),
                        toWei("1.8"),
                        toWei("1.9"),
                        toWei("2"),
                        toWei("2.1"),
                        toWei("2.2"),
                        toWei("2.3"),
                        toWei("2.4"),
                        toWei("2.5"),
                        toWei("2.6"),
                        toWei("2.7"),
                        toWei("2.8"),
                        toWei("2.9")
                    ],
                    [
                        toWei("1"),
                        toWei("1.1"),
                        toWei("1.2"),
                        toWei("1.3"),
                        toWei("1.4"),
                        toWei("1.5"),
                        toWei("1.6"),
                        toWei("1.7"),
                        toWei("1.8"),
                        toWei("1.9"),
                        toWei("2"),
                        toWei("2.1"),
                        toWei("2.2"),
                        toWei("2.3"),
                        toWei("2.4"),
                        toWei("2.5"),
                        toWei("2.6"),
                        toWei("2.7"),
                        toWei("2.8"),
                        toWei("2.9")
                    ],
                    40000,
                    {sellLong: 19500, sellShort: 15000, buyLong: 15000, buyShort: 19500}
                ]
            })
            await exchange.setPricer(pricer.address)
            console.log("pricer verified")
        } catch (err: any) {
            console.log(err)
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
