import {ethers} from "hardhat";
import { scaleNum } from "../utils/conversion-helper"
import { BigNumber, BigNumberish, utils } from "ethers"
import {Oracle} from "../types/Oracle"
import {NewWhitelist} from "../types/NewWhitelist"
import {NewMarginCalculator} from "../types/NewMarginCalculator"
import {NewController} from "../types/NewController"

const lockingPeriod = 60 * 10
const disputePeriod = 60 * 20
const chainlinkOracle = "0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8"
const bot = "0xa7d48256291bcd02656b05e7d38bd5cb617edb29"
const weth = "0x3b3a1dE07439eeb04492Fa64A889eE25A130CDd3"
const usdc = "0x408c5755b5c7a0a28D851558eA3636CfC5b5b19d"
const sequencerUptimeFeed = "0x4da69F028a5790fCCAfe81a75C0D24f46ceCDd69"

////
///////// FOR TESTNET MAKE SURE GRACE PERIOD IS FIXED /////////////
////

const productSpotShockValue = scaleNum("1", 27)
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

async function main() {
    
    const [deployer] = await ethers.getSigners();
    console.log("deployer: " + await deployer.getAddress())

    const oracle = await ethers.getContractAt("Oracle", "0x35578F5A49E1f1Cf34ed780B46A0BdABA23D4C0b") as Oracle
    const whitelist = await ethers.getContractAt("NewWhitelist", "0xf6651d140aeee442e91a6bae418c4993d0190370") as NewWhitelist
	const calculator = await ethers.getContractAt("NewMarginCalculator", "0xcD270e755C2653e806e16dD3f78E16C89B7a1c9e") as NewMarginCalculator
	const controller = await ethers.getContractAt("NewController", "0x11a602a5F5D823c103bb8b7184e22391Aae5F4C2") as NewController
    // deploy pricer
    const pricer = await(await ethers.getContractFactory("L2ChainLinkPricer")).deploy(bot, weth, chainlinkOracle, oracle.address, sequencerUptimeFeed, { gasLimit: BigNumber.from("500000000") })
    console.log("pricer: " + pricer.address)
    await oracle.setAssetPricer(weth, pricer.address)
    await oracle.setLockingPeriod(pricer.address, lockingPeriod)
    await oracle.setDisputePeriod(pricer.address, disputePeriod)

    await controller.setNakedCap(weth, utils.parseEther('1000000'))
	await controller.setNakedCap(usdc, utils.parseEther('1000000'))
    await controller.refreshConfiguration()

     // whitelist stuff

    await whitelist.whitelistCollateral(weth)
	await whitelist.whitelistCollateral(usdc)

// whitelist products
	// normal calls
	await whitelist.whitelistProduct(
		weth,
		usdc,
		weth,
		false
	)
	// normal puts
	await whitelist.whitelistProduct(
		weth,
		usdc,
		usdc,
		true
	)
	// usd collateralised calls
	await whitelist.whitelistProduct(
		weth,
		usdc,
		usdc,
		false
	)
	// eth collateralised puts
	await whitelist.whitelistProduct(
		weth,
		usdc,
		weth,
		true
	)
	// whitelist vault type 0 collateral
	await whitelist.whitelistCoveredCollateral(weth, weth, false)
	await whitelist.whitelistCoveredCollateral(usdc, weth, true)
	// whitelist vault type 1 collateral
	await whitelist.whitelistNakedCollateral(usdc, weth, false)
	await whitelist.whitelistNakedCollateral(weth, weth, true)

    // set product spot shock values
	// usd collateralised calls
	await calculator.setSpotShock(
		weth,
		usdc,
		usdc,
		false,
		productSpotShockValue
	)
	// usd collateralised puts
	await calculator.setSpotShock(
		weth,
		usdc,
		usdc,
		true,
		productSpotShockValue
	)
	// eth collateralised calls
	await calculator.setSpotShock(
		weth,
		usdc,
		weth,
		false,
		productSpotShockValue
	)
	// eth collateralised puts
	await calculator.setSpotShock(
		weth,
		usdc,
		weth,
		true,
		productSpotShockValue
	)
	// set expiry to value values
	// usd collateralised calls
	await calculator.setUpperBoundValues(
		weth,
		usdc,
		usdc,
		false,
		timeToExpiry,
		expiryToValueCalls
	)
	// usd collateralised puts
	await calculator.setUpperBoundValues(
		weth,
		usdc,
		usdc,
		true,
		timeToExpiry,
		expiryToValuePuts
	)
	// eth collateralised calls
	await calculator.setUpperBoundValues(
		weth,
		usdc,
		weth,
		false,
		timeToExpiry,
		expiryToValueCalls
	)
	// eth collateralised puts
	await calculator.setUpperBoundValues(
		weth,
		usdc,
		weth,
		true,
		timeToExpiry,
		expiryToValuePuts
	)

	await oracle.setStablePrice(usdc, "100000000")
	console.log("execution complete")
}
main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

