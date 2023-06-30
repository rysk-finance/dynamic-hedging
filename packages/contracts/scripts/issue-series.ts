import "@nomiclabs/hardhat-ethers"
import hre from "hardhat"
import { CALL_FLAVOR, PUT_FLAVOR, toWei } from "../utils/conversion-helper"


export enum CHAINID {
	ARBITRUM = 42161, // eslint-disable-line no-unused-vars
	ARBITRUM_GOERLI = 421613, // eslint-disable-line no-unused-vars
}
export const ADDRESSES = {
	[CHAINID.ARBITRUM]: {
        manager: "0xD404D0eD7fe1EB1Cd6388610F9e5B5E6b6E41E72", // on mainnet the manager issues series
        exchange: "0xC117bf3103bd09552F9a721F0B8Bce9843aaE1fa",
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        catalogue: "0x44227Dc2a1d71FC07DC254Dfd42B1C44aFF12168"
    },
    [CHAINID.ARBITRUM_GOERLI]: {
        manager: "0xB8Cb70cf67EF7d7dFb1C70bc7A169DFCcCF0753c",
        catalogue: "0xde458dD32651F27A8895D4a92B7798Cdc4EbF2f0", // on goerli there is no manager
        exchange: "0xb672fE86693bF6f3b034730f5d2C77C8844d6b45",
        usdc: "0x408c5755b5c7a0a28D851558eA3636CfC5b5b19d",
        weth: "0x3b3a1dE07439eeb04492Fa64A889eE25A130CDd3",
    },
} 
const chainId = CHAINID.ARBITRUM
const expiry = 1688716800
const seriesToIssue = [
    {
        expiration: expiry,
        isPut: CALL_FLAVOR,
        strike: toWei("1800"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: PUT_FLAVOR,
        strike: toWei("1800"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: CALL_FLAVOR,
        strike: toWei("1850"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: PUT_FLAVOR,
        strike: toWei("1850"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: CALL_FLAVOR,
        strike: toWei("1900"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: PUT_FLAVOR,
        strike: toWei("1900"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: CALL_FLAVOR,
        strike: toWei("1950"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: PUT_FLAVOR,
        strike: toWei("1950"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: CALL_FLAVOR,
        strike: toWei("2000"),
        isSellable: false,
        isBuyable: false
    },
    {
        expiration: expiry,
        isPut: PUT_FLAVOR,
        strike: toWei("2000"),
        isSellable: false,
        isBuyable: false
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
			ADDRESSES[chainId].catalogue
		)
        const exchange = await hre.ethers.getContractAt(
			"OptionExchange",
			ADDRESSES[chainId].exchange
		)
        const collateralAssets = [ADDRESSES[chainId].usdc, ADDRESSES[chainId].weth]
        // create the otokens and confirm their validity
        for (let i=0; i < seriesToIssue.length; i++) {
            for (let j=0; j < collateralAssets.length; j++) {
                const proposedSeries = {
                    expiration: seriesToIssue[i].expiration,
                    strike: seriesToIssue[i].strike,
                    isPut: seriesToIssue[i].isPut,
                    strikeAsset: ADDRESSES[chainId].usdc,
                    underlying: ADDRESSES[chainId].weth,
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
