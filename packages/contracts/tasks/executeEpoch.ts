import hre from "hardhat"
import { task } from "hardhat/config"
import "@nomiclabs/hardhat-ethers"
import { abi } from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { localhost } from "../contracts.json"

task("executeEpoch", "Executes the current epoch").setAction(async (_, hre) => {
	try {
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [localhost.liquidityPool]
		})
		const [signer] = await hre.ethers.getSigners()
		const lpContract = new hre.ethers.Contract(localhost.liquidityPool, abi, signer)

		const initialEpoch = await lpContract.epoch()
		console.log(`Current epoch is ${initialEpoch}`)

		await lpContract.pauseTradingAndRequest()
		await lpContract.executeEpochCalculation()

		const newEpoch = await lpContract.epoch()
		console.log(`New epoch is ${newEpoch}`)
	} catch (err) {
		console.log(err)
	}
})
