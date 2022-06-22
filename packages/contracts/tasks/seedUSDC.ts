import hre from "hardhat"
import { task } from "hardhat/config"
import "@nomiclabs/hardhat-ethers"
import erc20ABI from "../abis/erc20.json"

const USDC_OWNER_ADDRESS = "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"
const USDC_MAINNET_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

task("seedUSDC", "Seeds a provided account with 500 USDC")
	.addParam("address", "Target address")
	// Default to 500 USDC
	.addOptionalParam("amount", "USDC amount to send", (500000 * 1e6).toString())
	.setAction(async ({ address, amount }, hre) => {
		try {
			await hre.network.provider.request({
				method: "hardhat_impersonateAccount",
				params: [USDC_OWNER_ADDRESS]
			})
			const signer = hre.ethers.provider.getSigner(USDC_OWNER_ADDRESS)
			const usdcContract = new hre.ethers.Contract(USDC_MAINNET_CONTRACT_ADDRESS, erc20ABI, signer)

			await usdcContract.transfer(address, amount)

			const balance = await usdcContract.balanceOf(address)

			console.log(`Balance: ${balance}`)
		} catch (err) {
			console.log(err)
		}
	})
