import { Signer } from "ethers"
import fs from "fs"
import { deployments, ethers, getNamedAccounts } from "hardhat"
import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import path from "path"
import { ADDRESS_BOOK, GAMMA_ORACLE_NEW } from "../../test/constants"
import { AddressBook } from "../../types/AddressBook"
import { Oracle } from "../../types/Oracle"
import { scaleNum } from "../../utils/conversion-helper"

const chainId = 1

const addressPath = path.join(__dirname, "..", "..", "contracts.json")

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deploy, execute, read, log } = deployments
	const { deployer } = await getNamedAccounts()
	const signers: Signer[] = await ethers.getSigners()
	const [signer] = signers

	// Deploy Opyn Contracts
	const addressBook = (await ethers.getContractAt(
		"contracts/packages/opyn/core/AddressBook.sol:AddressBook",
		ADDRESS_BOOK[chainId]
	)) as AddressBook

	// get the oracle
	const oracle = (await ethers.getContractAt(
		"contracts/packages/opyn/core/Oracle.sol:Oracle",
		GAMMA_ORACLE_NEW[chainId]
	)) as Oracle

	const BSLib = await deploy("BlackScholes", {
		from: deployer,
		log: true
	})

	const LiquidityPool = await deploy("LiquidityPool", {
		from: deployer,
		log: true,
		libraries: {
			BlackScholes: BSLib.address
		},
		args: []
	})

	let dummyVaultDeploy = await deploy("DummyVault", {
		from: deployer,
		log: true
	})

	const productSpotShockValue = scaleNum("0.6", 27)
	const day = 60 * 60 * 24

	const timeToExpiry = [day * 7, day * 14, day * 28, day * 42, day * 56]

	const expiryToValue = [
		scaleNum("0.1678", 27),
		scaleNum("0.237", 27),
		scaleNum("0.3326", 27),
		scaleNum("0.4032", 27),
		scaleNum("0.4603", 27)
	]

	// let opynParams = await deployOpyn(signers, productSpotShockValue, timeToExpiry, expiryToValue)

	// let liquidtyPoolDeploy = await deploy("LiquidityPool", {
	// 	from: deployer,
	// 	log: true,
	// 	args: [

	// 	]
	// })

	// @ts-ignore
	const contractAddresses = JSON.parse(fs.readFileSync(addressPath))

	// @ts-ignore
	contractAddresses["localhost"]["DummyVault"] = dummyVaultDeploy.address
	// contractAddresses["localhost"]["LiquidityPool"] = liquidtyPoolDeploy.address

	fs.writeFileSync(addressPath, JSON.stringify(contractAddresses, null, 4))
}

func.tags = ["localhost"]
export default func
