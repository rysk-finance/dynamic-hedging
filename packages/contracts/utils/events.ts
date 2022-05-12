import { utils, Event, ContractReceipt } from "ethers"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"

const FAILED = "failed"
// Event names
export const WRITE_OPTION = "WriteOption"
export const BUYBACK_OPTION = "BuybackOption"

type EventsMap = Record<string, any>
const eventsMap: EventsMap = {
	[WRITE_OPTION]: {
		["abi"]: LiquidityPoolSol.abi
	},
	[BUYBACK_OPTION]: {
		["abi"]: LiquidityPoolSol.abi
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
