import hre, { ethers, network } from "hardhat"
import { Contract, utils, Signer, BigNumber } from "ethers"
import { NewController } from "../types/NewController"
import { AddressBook } from "../types/AddressBook"
import { Oracle } from "../types/Oracle"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import {
	GAMMA_CONTROLLER,
	USDC_ADDRESS,
	WETH_ADDRESS,
	CONTROLLER_OWNER,
	ADDRESS_BOOK,
	GAMMA_ORACLE_NEW
} from "../test/constants"
import { toWei } from "./conversion-helper"
const chainId = 1

export async function deployOpyn(
	signers: Signer[],
	productSpotShockValue: BigNumber,
	timeToExpiry: number[],
	expiryToValue: BigNumber[]
) {
	// impersonate the opyn controller owner
	await network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [CONTROLLER_OWNER[chainId]]
	})
	const [sender] = signers

	const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
	await sender.sendTransaction({
		to: signer.address,
		value: ethers.utils.parseEther("1.0") // Sends exactly 1.0 ether
	})
	// get an instance of the addressbook
	const addressBook = (await ethers.getContractAt(
		"contracts/packages/opyn/core/AddressBook.sol:AddressBook",
		ADDRESS_BOOK[chainId]
	)) as AddressBook
	// get the oracle
	const oracle = (await ethers.getContractAt(
		"contracts/packages/opyn/core/Oracle.sol:Oracle",
		GAMMA_ORACLE_NEW[chainId]
	)) as Oracle
	const vaultFactory = await ethers.getContractFactory("MarginVault")
	const newVault = await vaultFactory.deploy()
	const newControllerInstance = await ethers.getContractFactory("NewController", {
		libraries: {
			MarginVault: newVault.address
		}
	})
	let newController = (await newControllerInstance.deploy()) as NewController
	await newController.initialize(ADDRESS_BOOK[chainId], await sender.getAddress())
	// deploy the new calculator
	const newCalculatorInstance = await ethers.getContractFactory("NewMarginCalculator")
	const newCalculator = (await newCalculatorInstance.deploy(
		GAMMA_ORACLE_NEW[chainId],
		ADDRESS_BOOK[chainId]
	)) as NewMarginCalculator
	// deploy the new whitelist
	const newWhitelistInstance = await ethers.getContractFactory("NewWhitelist")
	const newWhitelist = await newWhitelistInstance.deploy(ADDRESS_BOOK[chainId])
	// update the addressbook with the new calculator and whitelist addresses
	await addressBook.connect(signer).setController(newController.address)
	await addressBook.connect(signer).setMarginCalculator(newCalculator.address)
	await addressBook.connect(signer).setWhitelist(newWhitelist.address)
	newController = await ethers.getContractAt("NewController", (await addressBook.getController())) as NewController
	await newController.connect(signer).setNakedCap(WETH_ADDRESS[chainId], toWei('1000000'))
	await newController.connect(signer).setNakedCap(USDC_ADDRESS[chainId], toWei('1000000'))
	// update the whitelist and calculator in the controller
	await newController.connect(signer).refreshConfiguration()
	// whitelist collateral
	await newWhitelist.whitelistCollateral(WETH_ADDRESS[chainId])
	await newWhitelist.whitelistCollateral(USDC_ADDRESS[chainId])
	// whitelist products
	// normal calls
	await newWhitelist.whitelistProduct(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		WETH_ADDRESS[chainId],
		false
	)
	// normal puts
	await newWhitelist.whitelistProduct(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		true
	)
	// usd collateralised calls
	await newWhitelist.whitelistProduct(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		false
	)
	// eth collateralised puts
	await newWhitelist.whitelistProduct(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		WETH_ADDRESS[chainId],
		true
	)
	// whitelist vault type 0 collateral
	await newWhitelist.whitelistCoveredCollateral(WETH_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
	await newWhitelist.whitelistCoveredCollateral(USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
	// whitelist vault type 1 collateral
	await newWhitelist.whitelistNakedCollateral(USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
	await newWhitelist.whitelistNakedCollateral(WETH_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
	// set product spot shock values
	// usd collateralised calls
	await newCalculator.setSpotShock(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		false,
		productSpotShockValue
	)
	// usd collateralised puts
	await newCalculator.setSpotShock(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		true,
		productSpotShockValue
	)
	// eth collateralised calls
	await newCalculator.setSpotShock(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		WETH_ADDRESS[chainId],
		false,
		productSpotShockValue
	)
	// eth collateralised puts
	await newCalculator.setSpotShock(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		WETH_ADDRESS[chainId],
		true,
		productSpotShockValue
	)
	// set expiry to value values
	// usd collateralised calls
	await newCalculator.setUpperBoundValues(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		false,
		timeToExpiry,
		expiryToValue
	)
	// usd collateralised puts
	await newCalculator.setUpperBoundValues(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		true,
		timeToExpiry,
		expiryToValue
	)
	// eth collateralised calls
	await newCalculator.setUpperBoundValues(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		WETH_ADDRESS[chainId],
		false,
		timeToExpiry,
		expiryToValue
	)
	// eth collateralised puts
	await newCalculator.setUpperBoundValues(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId],
		WETH_ADDRESS[chainId],
		true,
		timeToExpiry,
		expiryToValue
	)
	return {
		controller: newController,
		addressBook: addressBook,
		oracle: oracle,
		newCalculator: newCalculator
	}
}
