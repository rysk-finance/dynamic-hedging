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
        manager: "0xB8Cb70cf67EF7d7dFb1C70bc7A169DFCcCF0753c",
        catalogue: "0xde458dD32651F27A8895D4a92B7798Cdc4EbF2f0", 
        exchange: "0xb672fE86693bF6f3b034730f5d2C77C8844d6b45",
        usdc: "0x408c5755b5c7a0a28D851558eA3636CfC5b5b19d",
        weth: "0x3b3a1dE07439eeb04492Fa64A889eE25A130CDd3",
    },
}

const seriesToIssue = [
    {
        expiration: 1685088000,
        isPut: CALL_FLAVOR,
        strike: toWei("1700"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: CALL_FLAVOR,
        strike: toWei("1800"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: CALL_FLAVOR,
        strike: toWei("1900"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: PUT_FLAVOR,
        strike: toWei("1700"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: PUT_FLAVOR,
        strike: toWei("1800"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: PUT_FLAVOR,
        strike: toWei("1900"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: PUT_FLAVOR,
        strike: toWei("2000"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: PUT_FLAVOR,
        strike: toWei("2100"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: CALL_FLAVOR,
        strike: toWei("2000"),
        isSellable: true,
        isBuyable: true
    },
    {
        expiration: 1685088000,
        isPut: CALL_FLAVOR,
        strike: toWei("2100"),
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

        const manager = await hre.ethers.getContractAt(
            "Manager",
            ADDRESSES[CHAINID.ARBITRUM_GOERLI].manager
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
		const mgtx = await manager.issueNewSeries(seriesToIssue)

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
