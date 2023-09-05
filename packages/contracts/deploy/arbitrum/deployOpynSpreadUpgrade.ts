
import { deployments, getNamedAccounts, ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { getAddresses } from "../utils/opynAddress"
import { NewMarginCalculator } from "../../types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	console.log(`Executing opyn upgrade to ${hre.network.name}. Hit ctrl + c to abort`)
    const { deployer } = await getNamedAccounts()
    const productSpotShockValue = ethers.utils.parseUnits("1", 27)
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
        ethers.utils.parseUnits("0.137310398921181", 27),
        ethers.utils.parseUnits("0.21532271007278914", 27),
        ethers.utils.parseUnits("0.28537036027751395", 27),
        ethers.utils.parseUnits("0.3483113205978359", 27),
        ethers.utils.parseUnits("0.4214755691406809", 27),
        ethers.utils.parseUnits("0.49055405840298094", 27),
        ethers.utils.parseUnits("0.5301302667777277", 27)
    ]

    const expiryToValuePuts = [
        ethers.utils.parseUnits("0.16097528948543374", 27),
        ethers.utils.parseUnits("0.23027824327552782", 27),
        ethers.utils.parseUnits("0.3056523951032439", 27),
        ethers.utils.parseUnits("0.38082167009044565", 27),
        ethers.utils.parseUnits("0.4539548883445394", 27),
        ethers.utils.parseUnits("0.5238145515841939", 27),
        ethers.utils.parseUnits("0.5678502236865992", 27)
    ]
    const fee = ethers.utils.parseEther("0.05")
	const addresses = getAddresses(hre.network.name)


    const exchange = await hre.ethers.getContractAt(
        "OptionExchange",
        addresses.exchange
    )
    const controllerProxy = await hre.ethers.getContractAt(
        "NewController",
        addresses.controller
    )
    const addressBook = await hre.ethers.getContractAt(
        "AddressBook",
        addresses.addressBook
    )
    // pause the exchange and controller
    await controllerProxy.setSystemFullyPaused(true)
    // await exchange.pause()

    // deploy the margin calculator

    const calculator = await (await ethers.getContractFactory("NewMarginCalculator")).deploy(addresses.oracle, addressBook.address) as NewMarginCalculator

	console.log(`Margin Calculator deployed to: ${calculator.address}`)

	try {
		await hre.run("verify:verify", {
			address: calculator.address,
			constructorArguments: [
                addresses.oracle,
                addressBook.address
			]
		})
		console.log("MC verified")
	} catch (verificationError) {
		console.log({ verificationError })
	}
// set product spot shock values
	// usd collateralised calls
	await calculator.setSpotShock(
		addresses.weth,
		addresses.usdc,
	    addresses.usdc,
		false,
		productSpotShockValue
	)
	// usd collateralised puts
	await calculator.setSpotShock(
		addresses.weth,
		addresses.usdc,
		addresses.usdc,
		true,
		productSpotShockValue
	)
	// eth collateralised calls
	await calculator.setSpotShock(
		addresses.weth,
		addresses.usdc,
		addresses.weth,
		false,
		productSpotShockValue
	)
    // eth collateralised puts
	await calculator.setSpotShock(
		addresses.weth,
		addresses.usdc,
		addresses.weth,
		true,
		productSpotShockValue
	)
	// set expiry to value values
	// usd collateralised calls
	await calculator.setUpperBoundValues(
		addresses.weth,
		addresses.usdc,
		addresses.usdc,
		false,
		timeToExpiry,
		expiryToValueCalls
	)
	// usd collateralised puts
	await calculator.setUpperBoundValues(
		addresses.weth,
		addresses.usdc,
		addresses.usdc,
		true,
		timeToExpiry,
		expiryToValuePuts
	)
	// eth collateralised calls
	await calculator.setUpperBoundValues(
		addresses.weth,
		addresses.usdc,
		addresses.weth,
		false,
		timeToExpiry,
		expiryToValueCalls
	)
    // eth collateralised puts
	await calculator.setUpperBoundValues(
		addresses.weth,
		addresses.usdc,
		addresses.weth,
		true,
		timeToExpiry,
		expiryToValuePuts
	)

    // set the fee and fee recipient
    await calculator.setFee(fee)
    await calculator.setFeeRecipient(addresses.feeRecipient)

    await addressBook.setMarginCalculator(calculator.address)

    // deploy controller
    // deploy Controller & set address
    // deploy MarginVault library
    const vault = await (await ethers.getContractFactory("MarginVault")).deploy()
    const controllerImpl = await (await ethers.getContractFactory("NewController", {libraries:{MarginVault: vault.address}})).deploy()
    try {
		await hre.run("verify:verify", {
			address: controllerImpl.address,
			constructorArguments: []
		})
		console.log("CI verified")
	} catch (verificationError) {
		console.log({ verificationError })
	}
    await addressBook.setController(controllerImpl.address)
    await controllerImpl.initialize(addressBook.address, deployer)
    await controllerProxy.refreshConfiguration()

    // unpause the system
    // await exchange.unpause()
    await controllerProxy.setSystemFullyPaused(false)
}

export default func

func.tags = ["OpynUpgrade"]

if (require.main === module) {
	//@ts-ignore
	func(hre)
}
