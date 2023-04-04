import "@nomiclabs/hardhat-ethers"
import hre from "hardhat"
import { CALL_FLAVOR, PUT_FLAVOR, toWei } from "../utils/conversion-helper"


export enum CHAINID {
	ARBITRUM = 42161, // eslint-disable-line no-unused-vars
	ARBITRUM_GOERLI = 421613, // eslint-disable-line no-unused-vars
}
export const ADDRESSES = {
	[CHAINID.ARBITRUM]: {
        manager: "", // on mainnet the manager issues series
        exchange: "",
        usdc: ""
    },
    [CHAINID.ARBITRUM_GOERLI]: {
        catalogue: "0xFE767C13EB75686817E4be774fAEEaBE93346887", // on goerli there is no manager
        exchange: "0xFCc90f3c220cF6637983347f49540E359ec07D8c",
        usdc: "0x6775842ae82bf2f0f987b10526768ad89d79536e",
        weth: "0x53320bE2A35649E9B2a0f244f9E9474929d3B699",
    },
}

const seriesToIssue = [
    {
        expiration: 1683273600,
        isPut: CALL_FLAVOR,
        strike: toWei("1700"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1683273600,
        isPut: CALL_FLAVOR,
        strike: toWei("1800"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1683273600,
        isPut: CALL_FLAVOR,
        strike: toWei("1900"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1683273600,
        isPut: PUT_FLAVOR,
        strike: toWei("1700"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1683273600,
        isPut: PUT_FLAVOR,
        strike: toWei("1800"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1683273600,
        isPut: PUT_FLAVOR,
        strike: toWei("1900"),
        isSellable: true,
        isBuyable: true
    },
]
// specific for Arbitrum Goerli as mainnet will likely need to be on safe board
async function main() {
	try {
		if (!process.env.DEPLOYER_PRIVATE_KEY) {
			console.log("can't find private key")
			process.exit()
		}

		const catalogue = await hre.ethers.getContractAt(
			"OptionCatalogue",
			ADDRESSES[CHAINID.ARBITRUM_GOERLI].catalogue
		)
        const exchange = await hre.ethers.getContractAt(
			"OptionExchange",
			ADDRESSES[CHAINID.ARBITRUM_GOERLI].exchange
		)
        const collateralAssets = [ADDRESSES[CHAINID.ARBITRUM_GOERLI].usdc, ADDRESSES[CHAINID.ARBITRUM_GOERLI].weth]
        // create the otokens and confirm their validity
        for (let i=0; i < seriesToIssue.length; i++) {
            for (let j=0; j < collateralAssets.length; j++) {
                const proposedSeries = {
                    expiration: seriesToIssue[i].expiration,
                    strike: seriesToIssue[i].strike,
                    isPut: seriesToIssue[i].isPut,
                    strikeAsset: ADDRESSES[CHAINID.ARBITRUM_GOERLI].usdc,
                    underlying: ADDRESSES[CHAINID.ARBITRUM_GOERLI].weth,
                    collateral: collateralAssets[j]
                }
                console.log(await exchange.callStatic.createOtoken(proposedSeries))
                await exchange.createOtoken(proposedSeries)
            }
        }
        // issue the series
		const mgtx = await catalogue.issueNewSeries(seriesToIssue)

		await mgtx.wait()
        
        
		console.log("all series created and activated")
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
