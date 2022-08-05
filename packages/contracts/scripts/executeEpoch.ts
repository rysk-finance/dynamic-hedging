import hre from "hardhat"
import "@nomiclabs/hardhat-ethers"
// This is a circular reference
// Hardhat cannot compile because it relies on this file which is the output of a compile
import { abi } from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
// This file doesn't exist in CI, only exists locally (in git ignore)
import { localhost } from "../contracts.json"

async function main() {
	try {
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [localhost.liquidityPool]
		})
		const [signer] = await hre.ethers.getSigners()
		const lpContract = new hre.ethers.Contract(localhost.liquidityPool, abi, signer)

		const initialDepositEpoch = await lpContract.depositEpoch()
		const initialWithdrawalEpoch = await lpContract.withdrawalEpoch()
		console.log(`Current DepositEpoch is ${initialDepositEpoch}`)
		console.log(`Current WithdrawalEpoch is ${initialWithdrawalEpoch}`)

		await lpContract.pauseTradingAndRequest()
		await lpContract.executeEpochCalculation()

		const newDepositEpoch = await lpContract.depositEpoch()
		const newWithdrawalEpoch = await lpContract.withdrawalEpoch()
		console.log(`New depositEpoch is ${newDepositEpoch}`)
		console.log(`New withdrawalEpoch is ${newWithdrawalEpoch}`)
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
