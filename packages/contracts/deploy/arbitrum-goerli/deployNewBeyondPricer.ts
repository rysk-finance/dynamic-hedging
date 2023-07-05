import hre, { ethers } from "hardhat"
import { expect } from "chai"
import { toUSDC, toWei } from "../../utils/conversion-helper"
import { BeyondPricer, OptionExchange } from "../../types"

// deploys a new Beyond Pricer contract and links it to the protocol

const authorityAddress = "0x68256a51a6777129968b88bd21b6f657eCE8B0E6"
const optionProtocolAddress = "0x81267CBE2d605b7Ae2328462C1EAF51a1Ab57fFd"
const liquidityPoolAddress = "0x0B1Bf5fb77AA36cD48Baa1395Bc2B5fa0f135d8C"
const opynAddressBookAddress = "0xd6e67bF0b1Cdb34C37f31A2652812CB30746a94A"
const blackScholesAddress = "0x0D7776e816E774D5d8Ce0af78F6C51582846a66c"
const optionExchangeAddress = "0xb672fE86693bF6f3b034730f5d2C77C8844d6b45"

let callMultipliers1 = [
	toWei("5"),
	toWei("4"),
	toWei("3"),
	toWei("2"),
	toWei("1"),
	toWei("1"),
	toWei("2"),
	toWei("3"),
	toWei("4"),
	toWei("5")
]

let putMultipliers1 = [
	toWei("5"),
	toWei("4"),
	toWei("3"),
	toWei("2"),
	toWei("1"),
	toWei("1"),
	toWei("2"),
	toWei("3"),
	toWei("4"),
	toWei("5")
]
let callMultipliers2 = [
	toWei("3"),
	toWei("2.5"),
	toWei("2"),
	toWei("1.5"),
	toWei("1"),
	toWei("1"),
	toWei("1.5"),
	toWei("2"),
	toWei("2.5"),
	toWei("3")
]

let putMultipliers2 = [
	toWei("3"),
	toWei("2.5"),
	toWei("2"),
	toWei("1.5"),
	toWei("1"),
	toWei("1"),
	toWei("1.5"),
	toWei("2"),
	toWei("2.5"),
	toWei("3")
]

let callMultipliers3 = [
	toWei("1.4"),
	toWei("1.3"),
	toWei("1.2"),
	toWei("1.1"),
	toWei("1"),
	toWei("1"),
	toWei("1.1"),
	toWei("1.2"),
	toWei("1.3"),
	toWei("1.4")
]

let putMultipliers3 = [
	toWei("1.4"),
	toWei("1.3"),
	toWei("1.2"),
	toWei("1.1"),
	toWei("1"),
	toWei("1"),
	toWei("1.1"),
	toWei("1.2"),
	toWei("1.3"),
	toWei("1.4")
]

let callMultipliers4 = [
	toWei("3"),
	toWei("2.5"),
	toWei("2"),
	toWei("1.5"),
	toWei("1"),
	toWei("1"),
	toWei("1.5"),
	toWei("2"),
	toWei("2.5"),
	toWei("3")
]

let putMultipliers4 = [
	toWei("3"),
	toWei("2.5"),
	toWei("2"),
	toWei("1.5"),
	toWei("1"),
	toWei("1"),
	toWei("1.5"),
	toWei("2"),
	toWei("2.5"),
	toWei("3")
]

let callMultipliers5 = [
	toWei("5"),
	toWei("4"),
	toWei("3"),
	toWei("2"),
	toWei("1"),
	toWei("1"),
	toWei("2"),
	toWei("3"),
	toWei("4"),
	toWei("5")
]

let putMultipliers5 = [
	toWei("5"),
	toWei("4"),
	toWei("3"),
	toWei("2"),
	toWei("1"),
	toWei("1"),
	toWei("2"),
	toWei("3"),
	toWei("4"),
	toWei("5")
]

export async function deployNewBeyondPricer() {
	const PricerFactory = await ethers.getContractFactory("BeyondPricer", {
		libraries: {
			BlackScholes: blackScholesAddress
		}
	})
	const pricer = (await PricerFactory.deploy(
		authorityAddress,
		optionProtocolAddress,
		liquidityPoolAddress,
		opynAddressBookAddress,
		toWei("0.0001"),
		40000,
		{ sellLong: 15000, sellShort: 19500, buyLong: 15000, buyShort: 19500 }
	)) as BeyondPricer
	console.log("pricer deployed")
	try {
		await hre.run("verify:verify", {
			address: pricer.address,
			constructorArguments: [
				authorityAddress,
				optionProtocolAddress,
				liquidityPoolAddress,
				opynAddressBookAddress,
				toWei("0.0001"),
				40000,
				{ sellLong: 15000, sellShort: 19500, buyLong: 15000, buyShort: 19500 }
			]
		})
		console.log("pricer verified")
	} catch (err: any) {
		console.log(err)
	}
	await pricer.initializeTenorParams(toWei("10"), 5, 2800, [
		{
			callSlippageGradientMultipliers: callMultipliers1,
			putSlippageGradientMultipliers: putMultipliers1,
			callSpreadCollateralMultipliers: callMultipliers1,
			putSpreadCollateralMultipliers: putMultipliers1,
			callSpreadDeltaMultipliers: callMultipliers1,
			putSpreadDeltaMultipliers: putMultipliers1
		},
		{
			callSlippageGradientMultipliers: callMultipliers2,
			putSlippageGradientMultipliers: putMultipliers2,
			callSpreadCollateralMultipliers: callMultipliers2,
			putSpreadCollateralMultipliers: putMultipliers2,
			callSpreadDeltaMultipliers: callMultipliers2,
			putSpreadDeltaMultipliers: putMultipliers2
		},
		{
			callSlippageGradientMultipliers: callMultipliers3,
			putSlippageGradientMultipliers: putMultipliers3,
			callSpreadCollateralMultipliers: callMultipliers3,
			putSpreadCollateralMultipliers: putMultipliers3,
			callSpreadDeltaMultipliers: callMultipliers3,
			putSpreadDeltaMultipliers: putMultipliers3
		},
		{
			callSlippageGradientMultipliers: callMultipliers4,
			putSlippageGradientMultipliers: putMultipliers4,
			callSpreadCollateralMultipliers: callMultipliers4,
			putSpreadCollateralMultipliers: putMultipliers4,
			callSpreadDeltaMultipliers: callMultipliers4,
			putSpreadDeltaMultipliers: putMultipliers4
		},
		{
			callSlippageGradientMultipliers: callMultipliers5,
			putSlippageGradientMultipliers: putMultipliers5,
			callSpreadCollateralMultipliers: callMultipliers5,
			putSpreadCollateralMultipliers: putMultipliers5,
			callSpreadDeltaMultipliers: callMultipliers5,
			putSpreadDeltaMultipliers: putMultipliers5
		}
	])
	await pricer.setFeePerContract(toUSDC("0.5"))
	const exchange = await ethers.getContractAt("OptionExchange", optionExchangeAddress)
	await exchange.setPricer(pricer.address)
}

deployNewBeyondPricer()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})
