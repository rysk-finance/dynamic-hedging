//@ts-ignore
import { ethers } from "hardhat"
//@ts-ignore
import greeks from "greeks"
//@ts-ignore
import bs from "black-scholes"
import { BigNumber, Event } from "ethers"
import { LiquidityPool } from "../types/LiquidityPool"
import { NewController } from "../types/NewController"
import { WriteOptionEvent } from "../types/LiquidityPool"
import { OptionRegistry } from "../types/OptionRegistry"
import { PriceFeed } from "../types/PriceFeed"
import { fromWei, genOptionTimeFromUnix, fromOpyn } from "../utils/conversion-helper"

type WriteEvent = WriteOptionEvent & Event
type DecodedData = {
	series: string
	amount: BigNumber
}
type VaultLiquidatedEvent = {
	vaultOwner: string
	// amount of liquidation in 1e8
	debtAmount: BigNumber
	vaultId: BigNumber
}
interface EnrichedWriteEvent extends WriteEvent {
	decoded?: DecodedData
	series?: string
	expiration?: number
	vaultId?: string
	amount?: BigNumber
	delta?: number
	gamma?: number
	vega?: number
	theta?: number
	price?: number
}

export async function getPortfolioValues(
	liquidityPool: LiquidityPool,
	controller: NewController,
	optionRegistry: OptionRegistry,
	priceFeed: PriceFeed,
	rfr: string
) {
	const writeOptionEventFilter = liquidityPool.filters.WriteOption()
	const buybackEventFilter = liquidityPool.filters.BuybackOption()
	const vaultLiquidatedFilter = controller.filters.VaultLiquidated()
	const writeOption = await liquidityPool.queryFilter(writeOptionEventFilter)
	const buybackEvents = await liquidityPool.queryFilter(buybackEventFilter)
	const vaultLiquidatedEvents = await controller.queryFilter(vaultLiquidatedFilter)
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block

	// index liquidated vaults by vaultId
	const liquidatedVaults: Record<string, BigNumber> = {}
	// index buybacks amounts by series
	const buybackAmounts: Record<string, BigNumber> = {}
	// index write amount by series address
	const writeOptionAmounts: Record<string, BigNumber> = {}

	buybackEvents.map(x => {
		if (!x.decode) return
		const decoded: DecodedData = x.decode(x.data, x.topics)
		const amount = buybackAmounts[decoded.series]
		if (!amount) {
			buybackAmounts[decoded.series] = decoded.amount
		} else {
			buybackAmounts[decoded.series] = amount.add(buybackAmounts[decoded.series])
		}
		return decoded
	})
	vaultLiquidatedEvents.map(x => {
		if (!x.decode) return
		const decoded: VaultLiquidatedEvent = x.decode(x.data, x.topics)
		liquidatedVaults[decoded.vaultId.toString()] = decoded.debtAmount
	})
	const enrichedWriteOptions: Promise<EnrichedWriteEvent>[] = writeOption.map(
		async (x: WriteOptionEvent): Promise<EnrichedWriteEvent> => {
			const y: EnrichedWriteEvent = x
			const { data, topics, decode } = y
			if (!decode) return x
			y.decoded = decode(data, topics)
			y.series = y?.decoded?.series
			if (!y.series) return y
			//@TODO consider batching these as a multicall or using an indexing service
			const seriesInfo = await optionRegistry.seriesInfo(y.series)
			const vaultId = await optionRegistry.vaultIds(y.series)
			y.vaultId = vaultId.toString()
			y.expiration = seriesInfo.expiration.toNumber()
			const amount: BigNumber = y?.decoded?.amount ? y?.decoded?.amount : BigNumber.from(0)
			y.amount = amount
			writeOptionAmounts[y.series] = amount
			return y
		}
	)
	const resolved = await Promise.all(enrichedWriteOptions)
	// remove expired options
	const filtered = resolved.filter(x => {
		if (!x.expiration) return
		return x.expiration > timestamp
	})
	// reduce write events to options positions by series
	const seriesProcessed = new Set()
	//@ts-ignore
	const optionPositions: EnrichedWriteEvent[] = filtered.reduce((acc, cv) => {
		if (!cv.series) return acc
		if (seriesProcessed.has(cv.series)) return acc
		const amount = writeOptionAmounts[cv.series]
		cv.amount = amount
		seriesProcessed.add(cv.series)
		return [...acc, cv]
	}, [])

	const enrichedOptionPositions = optionPositions.map(async x => {
		if (!x.series || !x.vaultId) return x
		// reduce notional amount by buybacks and liquidations
		const buybackAmount: BigNumber = buybackAmounts[x.series]
		const liquidationAmount: BigNumber = liquidatedVaults[x.vaultId]
		if (buybackAmount) x.amount = x.amount?.sub(buybackAmount)
		if (liquidationAmount) x.amount = x.amount?.sub(liquidationAmount)

		const seriesInfo = await optionRegistry.seriesInfo(x.series)
		const priceQuote = await priceFeed.getNormalizedRate(
			seriesInfo.underlying,
			seriesInfo.strikeAsset
		)
		const priceNorm = fromWei(priceQuote)
		const iv = await liquidityPool.getImpliedVolatility(
			seriesInfo.isPut,
			priceQuote,
			seriesInfo.strike,
			seriesInfo.expiration
		)
		const optionType = seriesInfo.isPut ? "put" : "call"
		const timeToExpiration = genOptionTimeFromUnix(
			Number(timestamp),
			seriesInfo.expiration.toNumber()
		)

		const greekVariables = [
			priceNorm,
			fromOpyn(seriesInfo.strike),
			timeToExpiration,
			fromWei(iv),
			parseFloat(rfr),
			optionType
		]
		const delta = greeks.getDelta(...greekVariables)
		const gamma = greeks.getGamma(...greekVariables)
		const vega = greeks.getVega(...greekVariables)
		const theta = greeks.getTheta(...greekVariables)
		const price = bs.blackScholes(...greekVariables)
		// @TODO consider keeping calculation in BigNumber as more precise and is the format onchain.
		if (x.amount) {
			const numericAmt = Number(fromWei(x.amount))
			// invert sign due to writing rather than buying
			x.delta = numericAmt * delta * -1
			x.gamma = numericAmt * gamma * -1
			x.theta = numericAmt * theta * -1
			x.vega = numericAmt * vega * -1
			x.price = numericAmt * price
		}
		return x
	})
	const resolvedOptionPositions = await Promise.all(enrichedOptionPositions)
	const portfolioDelta = resolvedOptionPositions.reduce((total, num) => total + (num.delta || 0), 0)
	const portfolioGamma = resolvedOptionPositions.reduce((total, num) => total + (num.gamma || 0), 0)
	const portfolioVega = resolvedOptionPositions.reduce((total, num) => total + (num.vega || 0), 0)
	const portfolioTheta = resolvedOptionPositions.reduce((total, num) => total + (num.theta || 0), 0)
	const callsPutsValue = resolvedOptionPositions.reduce((total, num) => total + (num.price || 0), 0)
	return { portfolioDelta, portfolioGamma, portfolioTheta, portfolioVega, callsPutsValue }
}
