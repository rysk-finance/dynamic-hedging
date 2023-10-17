
import { deployments, getNamedAccounts, ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { getAddresses } from "../utils/opynAddress"
import { NewMarginCalculator } from "../../types"


// Mainnet wont use a script for the most part but the steps are split as follows:

// 1. Entire system pause - Both opyn full pause and rysk exchange pause
// 2. Margin Calculator deployment
// 3. Set Spot Shocks and Upper Bound values for all combinations of products on the newly deployed Margin Calculator
// 4. Set the fee and fee recipient on the newly deployed Margin Calculator
// 5. Transfer ownership of the margin calculator to the governor multisig
// 6. Set Margin calculator on address book
// 7. Deploy new Controller contract
// 8. Call setController on the address book using the newly deployed contract, this initialises the proxy
// 9. Call initialize on the new Controller Implementation contract to make sure no one else can call it
// 10. Call refreshConfiguration on the Controller Proxy contract and ensure that the proxy is pointing to the correct addresses
// 11. Open some trades, create some of the new spreads etc.

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
		ethers.utils.parseUnits("0.136113558844652341526790144", 27),
		ethers.utils.parseUnits("0.204187799962679547344715776", 27),
		ethers.utils.parseUnits("0.286851404906056194342256640", 27),
		ethers.utils.parseUnits("0.346254939021579129148407808", 27),
		ethers.utils.parseUnits("0.410351170012979402983342080", 27),
		ethers.utils.parseUnits("0.468023268960227811617931264", 27),
		ethers.utils.parseUnits("0.519059121881823487446745088", 27)
	]

	const expiryToValuePuts = [
		ethers.utils.parseUnits("0.152631225060838257058643968", 27),
		ethers.utils.parseUnits("0.220077115543755132474753024", 27),
		ethers.utils.parseUnits("0.300379400622110384259596288", 27),
		ethers.utils.parseUnits("0.379097031746117355062689792", 27),
		ethers.utils.parseUnits("0.441358135813662669482754048", 27),
		ethers.utils.parseUnits("0.499819416147169665479606272", 27),
		ethers.utils.parseUnits("0.559059596620901987634905088", 27)
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
	// await controllerProxy.setSystemFullyPaused(true)
	// await exchange.pause()

	// deploy the margin calculator

	// const calculator = await (await ethers.getContractFactory("NewMarginCalculator")).deploy(addresses.oracle, addressBook.address) as NewMarginCalculator

	// console.log(`Margin Calculator deployed to: ${calculator.address}`)

	// try {
	// 	await hre.run("verify:verify", {
	// 		address: calculator.address,
	// 		constructorArguments: [
	// 			addresses.oracle,
	// 			addressBook.address
	// 		]
	// 	})
	// 	console.log("MC verified")
	// } catch (verificationError) {
	// 	console.log({ verificationError })
	// }
	// // set product spot shock values
	// // usd collateralised calls
	// await calculator.setSpotShock(
	// 	addresses.weth,
	// 	addresses.usdc,
	// 	addresses.usdc,
	// 	false,
	// 	productSpotShockValue, { gasLimit: 100000000 }
	// )
	// // usd collateralised puts
	// await calculator.setSpotShock(
	// 	addresses.weth,
	// 	addresses.usdc,
	// 	addresses.usdc,
	// 	true,
	// 	productSpotShockValue, { gasLimit: 100000000 }
	// )
	// // eth collateralised calls
	// await calculator.setSpotShock(
	// 	addresses.weth,
	// 	addresses.usdc,
	// 	addresses.weth,
	// 	false,
	// 	productSpotShockValue, { gasLimit: 100000000 }
	// )
	// // eth collateralised puts
	// await calculator.setSpotShock(
	// 	addresses.weth,
	// 	addresses.usdc,
	// 	addresses.weth,
	// 	true,
	// 	productSpotShockValue, { gasLimit: 100000000 }
	// )
	// // set expiry to value values
	// // usd collateralised calls
	// await calculator.setUpperBoundValues(
	// 	addresses.weth,
	// 	addresses.usdc,
	// 	addresses.usdc,
	// 	false,
	// 	timeToExpiry,
	// 	expiryToValueCalls, { gasLimit: 100000000 }
	// )
	// // usd collateralised puts
	// await calculator.setUpperBoundValues(
	// 	addresses.weth,
	// 	addresses.usdc,
	// 	addresses.usdc,
	// 	true,
	// 	timeToExpiry,
	// 	expiryToValuePuts, { gasLimit: 100000000 }
	// )
	// // eth collateralised calls
	// await calculator.setUpperBoundValues(
	// 	addresses.weth,
	// 	addresses.usdc,
	// 	addresses.weth,
	// 	false,
	// 	timeToExpiry,
	// 	expiryToValueCalls, { gasLimit: 100000000 }
	// )
	// // eth collateralised puts
	// await calculator.setUpperBoundValues(
	// 	addresses.weth,
	// 	addresses.usdc,
	// 	addresses.weth,
	// 	true,
	// 	timeToExpiry,
	// 	expiryToValuePuts, { gasLimit: 100000000 }
	// )

	// // set the fee and fee recipient
	// await calculator.setFee(fee, { gasLimit: 100000000 })
	// await calculator.setFeeRecipient(addresses.feeRecipient, { gasLimit: 100000000 })
	// await calculator.transferOwnership(addresses.governor, { gasLimit: 100000000 })
	// await addressBook.setMarginCalculator(calculator.address)

	// deploy controller
	// deploy Controller & set address
	// deploy MarginVault library
	const vault = await (await ethers.getContractFactory("MarginVault")).deploy()
	const controllerImpl = await (await ethers.getContractFactory("NewController", { libraries: { MarginVault: vault.address } })).deploy()
	try {
		await hre.run("verify:verify", {
			address: controllerImpl.address,
			constructorArguments: []
		})
		console.log("CI verified")
	} catch (verificationError) {
		console.log({ verificationError })
	}
	// await addressBook.setController(controllerImpl.address)
	// await controllerImpl.initialize(addressBook.address, deployer, { gasLimit: 100000000 })
	// await controllerProxy.refreshConfiguration()

	// unpause the system
	// await exchange.unpause()
	// await controllerProxy.setSystemFullyPaused(false)
}

export default func

func.tags = ["OpynUpgrade"]

if (require.main === module) {
	//@ts-ignore
	func(hre)
}
