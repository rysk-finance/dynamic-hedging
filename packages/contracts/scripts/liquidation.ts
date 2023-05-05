import "@nomiclabs/hardhat-ethers"
import hre from "hardhat"
import { BeyondPricer, NewController, OptionExchange, OptionRegistry} from "../types"
import {CHAINID} from "./utils"
import { MarginVault } from "../types/Controller"
import { fromOpynToWei } from "../utils/conversion-helper"

export const ADDRESSES = {
	[CHAINID.ARBITRUM]: {
        manager: "", // on mainnet the manager issues series
        exchange: "",
        usdc: ""
    },
    [CHAINID.ARBITRUM_GOERLI]: {
        controller: "0x5F7350aEA196825C3AAc335D97535e9b4EfCDb45",
        exchange: "0x63cE41cA4E30e75Caf9B561E0250c25056B6e2C0",
        registry: "",
        pricer: "",
        usdc: "0x6775842ae82bf2f0f987b10526768ad89d79536e",
        weth: "0x53320bE2A35649E9B2a0f244f9E9474929d3B699",
    },
}

export async function executeLiquidation(vaultId: number, owner: string, controller: NewController, vault: MarginVault.VaultStruct, registry: OptionRegistry, pricer: BeyondPricer) {
    // look at the otoken inside and get its series details
    const series = await registry.getSeriesInfo(vault.shortOtokens[0])
    // get the net dhv exposure of this option
    const netDhvExposure = await 
    // get the price according to the pricer to determine the execution price
    const price = await pricer.quoteOptionPrice(series, fromOpynToWei(vault.shortAmounts), false, )
    // construct the liquidation transaction to liquidate the vault
    // do a try catch for offloading the option to the dhv and withdrawing collateral, make sure we have sufficient capital 
    // to cover any collateralisation we need to do
    // if the offloading would fail then we need to collateralise the vault instead after liquidating so compute the right amount

}
async function main() {
    const controller = await hre.ethers.getContractAt(
        "NewController",
        ADDRESSES[CHAINID.ARBITRUM_GOERLI].controller
    )
    const exchange = await hre.ethers.getContractAt(
        "OptionExchange",
        ADDRESSES[CHAINID.ARBITRUM_GOERLI].exchange
    )
    const pricer = await hre.ethers.getContractAt(
        "BeyondPricer",
        ADDRESSES[CHAINID.ARBITRUM_GOERLI].pricer
    )
    const registry = await hre.ethers.getContractAt(
        "OptionRegistry",
        ADDRESSES[CHAINID.ARBITRUM_GOERLI].registry
    )
    // construct a graph query to get all the vaults to look at
    // go through all deployed opyn collateral vaults and see if they are liquidatable, if they are then execute a liquidation in a try catch
    // at the end check our own vaults if we have any to make sure their collateral factor is ok if it isnt then top it up


}


main()
	.then(() => process.exit())
	.catch(error => {
		console.error(error)
		process.exit(1)
	})