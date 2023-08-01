import { ethers } from "ethers"

const contractNames = [
	"OptionExchange",
	"LiquidityPool",
	"Accounting",
	"VolatilityFeed",
	"PriceFeed"
]

function main() {
	for (let i = 0; i < contractNames.length; i++) {
		const contractName = contractNames[i]
		console.log(`***********************`)
		console.log(`Contract: ${contractName}`)
		console.log(`***********************`)
		const { abi } = require(`../artifacts/contracts/${contractName}.sol/${contractName}.json`)
		const iface = new ethers.utils.Interface(abi)
		const data = abi.reduce(
			(acc: Record<string, string>, { name, type }: { name: string; type: string }) => {
				if (type === "error") acc[iface.getSighash(name)] = name
				return acc
			},
			{} as Record<string, string>
		)
		console.log(data)
	}
}

main()
