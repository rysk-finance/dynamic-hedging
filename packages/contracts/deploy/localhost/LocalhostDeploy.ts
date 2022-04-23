import { Signer } from "ethers"
import { deployments, ethers, getNamedAccounts } from "hardhat"
import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import fs from "fs"
import path from "path"

const addressPath = path.join(__dirname, "..", "..", "contracts.json")

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deploy, execute, read, log } = deployments
	const { deployer } = await getNamedAccounts()
	const signers: Signer[] = await ethers.getSigners()
	const [signer] = signers

	let dummyVaultDeploy = await deploy("DummyVault", {
		from: deployer,
		log: true
	})

	// @ts-ignore
	const contractAddresses = JSON.parse(fs.readFileSync(addressPath))

	// @ts-ignore
	contractAddresses["localhost"]["DummyVault"] = dummyVaultDeploy.address

	fs.writeFileSync(addressPath, JSON.stringify(contractAddresses, null, 4))
}

func.tags = ["localhost"]
export default func
