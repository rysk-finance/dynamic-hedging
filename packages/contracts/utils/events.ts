import { utils, Event, ContractReceipt } from "ethers"
import IUniswapv3Pool from "../artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import OptionRegistrySol from "../artifacts/contracts/OptionRegistry.sol/OptionRegistry.json"

const FAILED = "failed"
// Event names
export const WRITE_OPTION = "WriteOption"
export const BUYBACK_OPTION = "BuybackOption"
export const VAULT_LIQUIDATION_REGISTERED = "VaultLiquidationRegistered"
export const UNISWAP_POOL_MINT = "Mint"
export const UNISWAP_POOL_BURN = "Burn"
export const UNISWAP_POOL_COLLECT = "Collect"

type EventsMap = Record<string, any>
const eventsMap: EventsMap = {
	[WRITE_OPTION]: {
		["abi"]: LiquidityPoolSol.abi
	},
	[BUYBACK_OPTION]: {
		["abi"]: LiquidityPoolSol.abi
	},
	[VAULT_LIQUIDATION_REGISTERED]: {
		["abi"]: OptionRegistrySol.abi
	},
	[UNISWAP_POOL_BURN]: {
		["abi"]: IUniswapv3Pool.abi
	},
	[UNISWAP_POOL_COLLECT]: {
		["abi"]: IUniswapv3Pool.abi
	},
	[UNISWAP_POOL_MINT]: {
		["abi"]: IUniswapv3Pool.abi
	}
}

function decodeEvents(events: Event[] | undefined, eventName: string) {
	const eventInfo = eventsMap[eventName]
	let iface = new utils.Interface(eventInfo["abi"])
	if (!events) return []
	const mapped = events.map(x => {
		try {
			const decoded = iface.decodeEventLog(eventName, x.data, x.topics)
			return decoded
		} catch (e) {
			return FAILED
		}
	})
	const filtered = mapped.filter(x => x !== FAILED)
	return filtered
}

export function getMatchingEvents(receipt: ContractReceipt, eventName: string) {
	if (!receipt.events) return []
	const events: Event[] = receipt.events
	return decodeEvents(events, eventName)
}
