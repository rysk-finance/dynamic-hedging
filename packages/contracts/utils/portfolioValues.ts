//@ts-ignore
import { ethers } from "hardhat"
//@ts-ignore
import greeks from "greeks"
//@ts-ignore
import bs from "black-scholes"
import { BigNumber, Event, utils } from "ethers"
import { BuybackOptionEvent, LiquidityPool } from "../types/LiquidityPool"
import { NewController, VaultSettledEvent } from "../types/NewController"
import { WriteOptionEvent } from "../types/LiquidityPool"
import {
	OptionRegistry,
	VaultLiquidationRegisteredEvent,
	OptionsContractSettledEvent
} from "../types/OptionRegistry"
import { PriceFeed } from "../types/PriceFeed"
import {
	fromWei,
	genOptionTimeFromUnix,
	fromOpyn,
	fromOpynToWei,
	tFormatUSDC,
	toWei
} from "../utils/conversion-helper"
import { Oracle } from "../types/Oracle"
import { ERC20 } from "../types/ERC20"
import ERC20Artifact from "../artifacts/contracts/tokens/ERC20.sol/ERC20.json"

type GreekVariables = [string, string, number, string, number, "put" | "call"]
type WriteEvent = WriteOptionEvent & Event
type OptionEventAmounts = {
	amount: BigNumber
	escrow: BigNumber
}
interface WriteOptionEventAmounts extends OptionEventAmounts {
	premium: BigNumber
}
type WriteEventMap = Record<string, WriteOptionEventAmounts>
type EventMap = Record<string, OptionEventAmounts>
type DecodedData = {
	series: string
	amount: BigNumber
	escrow: BigNumber
	premium: BigNumber
}

type BuybackDecodedData = {
	series: string
	amount: BigNumber
	escrowReturned: BigNumber
}
interface VaultLiquidationRegistered extends VaultLiquidationRegisteredEvent {
	amountLiquidated: BigNumber
	vaultId: BigNumber
	collateralLiquidated: BigNumber
}
interface EnrichedWriteEvent extends WriteEvent {
	decoded?: DecodedData
	series?: string
	expiration?: number
	vaultId?: string
	amount?: BigNumber
	escrow?: BigNumber
	premium?: BigNumber
	delta?: number
	gamma?: number
	vega?: number
	theta?: number
	bsQuote?: number
	utilizationQuote: number
	greekVariables?: GreekVariables
	liquidityAllocated?: BigNumber
}
type UtilizationCurve = {
	utilizationFunctionThreshold: number
	belowUtilizationThresholdGradient: number
	aboveUtilizationThresholdGradient: number
	yIntercept: number
}

type ContractsState = {
	utilizationCurve: UtilizationCurve
	maxDiscount: BigNumber
	lpCollateralBalance: BigNumber
	assets: BigNumber
	externalDelta: BigNumber
	underlying: string
	strikeAsset: string
	priceQuote: BigNumber
	writeOption: WriteOptionEvent[]
	buybackEvents: BuybackOptionEvent[]
	vaultLiquidationRegisteredEvents: VaultLiquidationRegisteredEvent[]
	optionsContractSettledEvents: OptionsContractSettledEvent[]
}
const ZERO: BigNumber = BigNumber.from(0)

/**
 * Uses the contractState to set the event maps
 *
 * @typeParam contractState
 * @typeParam buybackAmount
 * @typeParam vaultLiquidation
 * @typeParam settleVaults
 */
function populateEventMaps(
	contractsState: ContractsState,
	buybackAmounts: EventMap,
	vaultLiquidations: EventMap,
	settledVaults: Set<string>
) {
	contractsState.buybackEvents.forEach(x => {
		if (!x.decode) return
		const decoded: BuybackDecodedData = x.decode(x.data, x.topics)
		const { amount, escrowReturned } = decoded
		const amounts: OptionEventAmounts = buybackAmounts[decoded.series]
		const newAmounts: OptionEventAmounts = { amount, escrow: escrowReturned }
		if (amounts && amounts.amount) newAmounts.amount = amount.add(amounts.amount)
		if (amounts && amounts.escrow) newAmounts.escrow = escrowReturned.add(amounts.escrow)
		buybackAmounts[decoded.series] = newAmounts
	})

	contractsState.vaultLiquidationRegisteredEvents.forEach(x => {
		if (!x.decode) return
		const decoded: VaultLiquidationRegistered = x.decode(x.data, x.topics)
		const { amountLiquidated, collateralLiquidated } = decoded
		const amounts = vaultLiquidations[decoded.vaultId.toString()]
		const fromOpynAmount = fromOpynToWei(amountLiquidated)
		const fromOpynEscrow = fromOpynToWei(collateralLiquidated)
		const newAmounts: OptionEventAmounts = { amount: amountLiquidated, escrow: collateralLiquidated }
		if (amounts && amounts.amount) newAmounts.amount = amounts.amount.add(fromOpynAmount)
		if (amounts && amounts.escrow) newAmounts.escrow = amounts.amount.add(fromOpynEscrow)
		vaultLiquidations[decoded.vaultId.toString()] = newAmounts
	})

	contractsState.optionsContractSettledEvents.forEach((x: OptionsContractSettledEvent) => {
		if (!x.decode) return
		const decoded = x.decode(x.data, x.topics)
		settledVaults.add(decoded.series)
	})
}

async function enrichOptionPositions(
	optionPositions: EnrichedWriteEvent[],
	contractsState: ContractsState,
	buybackAmounts: EventMap,
	vaultLiquidations: EventMap,
	timestamp: number,
	optionRegistry: OptionRegistry,
	liquidityPool: LiquidityPool,
	opynOracle: Oracle,
	controller: NewController
): Promise<EnrichedWriteEvent[]> {
	const enrichedOptionPositions = optionPositions.map(async x => {
		if (!x.series || !x.vaultId) return x
		if (!x.expiration) return x
		const expired = x.expiration <= timestamp
		// reduce notional amount by buybacks and liquidations
		const buybackEventAmounts: OptionEventAmounts = buybackAmounts[x.series]
		const buybackAmount: BigNumber = buybackEventAmounts ? buybackEventAmounts.amount : ZERO
		const buybackEscrow: BigNumber = buybackEventAmounts ? buybackEventAmounts.escrow : ZERO
		const liquidationEventAmounts: OptionEventAmounts = vaultLiquidations[x.vaultId]
		const liquidationAmount: BigNumber = liquidationEventAmounts
			? fromOpynToWei(liquidationEventAmounts.amount)
			: ZERO
		const liquidationEscrow: BigNumber = liquidationEventAmounts
			? fromOpynToWei(liquidationEventAmounts.escrow)
			: ZERO
		if (buybackEventAmounts) {
			x.amount = x.amount?.sub(buybackAmount)
			x.escrow = x.escrow?.sub(buybackEscrow)
		}
		if (liquidationEventAmounts) {
			x.amount = x.amount?.sub(liquidationAmount)
			x.escrow = x.escrow?.sub(liquidationEscrow)
		}

		const seriesInfo = await optionRegistry.seriesInfo(x.series)
		const priceNorm = fromWei(contractsState.priceQuote)
		const iv = expired
			? "0"
			: await liquidityPool.getImpliedVolatility(
					seriesInfo.isPut,
					contractsState.priceQuote,
					fromOpynToWei(seriesInfo.strike),
					seriesInfo.expiration
			  )

		const optionType = seriesInfo.isPut ? "put" : "call"
		let timeToExpiration = genOptionTimeFromUnix(Number(timestamp), seriesInfo.expiration.toNumber())
		const rfr = fromWei(await liquidityPool.riskFreeRate())
		let priceToUse = priceNorm
		// handle expired but not settled options
		if (expired) {
			const [price] = await opynOracle.getExpiryPrice(contractsState.underlying, seriesInfo.expiration)
			timeToExpiration = 0
			// if expiration price is not set there is a fallback price
			// do not use this approach in production version of external adapter
			// actual external adapter will need to query historical price as a fallback
			priceToUse = Number(price) > 0 ? fromOpyn(price) : priceNorm
		} else {
			timeToExpiration = genOptionTimeFromUnix(Number(timestamp), seriesInfo.expiration.toNumber())
		}
		const greekVariables: GreekVariables = [
			priceToUse,
			fromOpyn(seriesInfo.strike),
			timeToExpiration,
			fromWei(iv),
			parseFloat(rfr),
			optionType
		]
		x.greekVariables = greekVariables
		const delta = greeks.getDelta(...greekVariables)
		const gamma = greeks.getGamma(...greekVariables)
		const vega = greeks.getVega(...greekVariables)
		const theta = greeks.getTheta(...greekVariables)
		const bsQuote: number = bs.blackScholes(...greekVariables)
		if (!x.amount) return x
		const optionRegistryAddress = optionRegistry.address
		const vaultInfo = await controller.getVault(optionRegistryAddress, x.vaultId)
		const liquidityAllocated: BigNumber = vaultInfo.collateralAmounts[0]
		x.liquidityAllocated = liquidityAllocated
		// @TODO consider keeping calculation in BigNumber as more precise and is the format onchain.
		if (x.amount) {
			const numericAmt = Number(fromWei(x.amount))
			// invert sign due to writing rather than buying
			x.delta = numericAmt * delta * -1
			x.gamma = numericAmt * gamma * -1
			x.theta = numericAmt * theta * -1
			x.vega = numericAmt * vega * -1
			x.bsQuote = numericAmt * bsQuote
		}
		return x
	})
	const resolvedOptionPositions = await Promise.all(enrichedOptionPositions)
	return resolvedOptionPositions
}

async function filterAndEnrichWriteOptions(
	writeOption: WriteOptionEvent[],
	optionRegistry: OptionRegistry,
	writeOptionAmounts: WriteEventMap,
	timestamp: number,
	settledVaults: Set<string>
): Promise<EnrichedWriteEvent[]> {
	const enrichedWriteOptions: Promise<EnrichedWriteEvent>[] = writeOption.map(
		async (x: WriteOptionEvent): Promise<EnrichedWriteEvent> => {
			const y: EnrichedWriteEvent = x as EnrichedWriteEvent
			const { data, topics, decode } = y
			if (!decode) return y
			y.decoded = decode(data, topics)
			y.series = y?.decoded?.series
			y.escrow = y?.decoded?.escrow
			y.premium = y?.decoded?.premium
			if (!y.series) return y
			//@TODO consider batching these as a multicall or using an indexing service
			const seriesInfo = await optionRegistry.seriesInfo(y.series)
			const vaultId = await optionRegistry.vaultIds(y.series)
			y.vaultId = vaultId.toString()
			y.expiration = seriesInfo.expiration.toNumber()
			const amount: BigNumber = y?.decoded?.amount ? y?.decoded?.amount : BigNumber.from(0)
			const escrow: BigNumber = y?.decoded?.escrow ? y?.decoded?.escrow : BigNumber.from(0)
			const premium: BigNumber = y?.decoded?.premium ? y?.decoded?.premium : BigNumber.from(0)
			y.amount = amount
			// populate writeOptionAmounts
			const existingWriteAmount = writeOptionAmounts[y.series]
			const newWriteAmounts: WriteOptionEventAmounts = { amount, escrow, premium }
			if (existingWriteAmount && existingWriteAmount.amount)
				newWriteAmounts.amount = existingWriteAmount.amount.add(amount)
			if (existingWriteAmount && existingWriteAmount.escrow)
				newWriteAmounts.escrow = existingWriteAmount.escrow.add(escrow)
			if (existingWriteAmount && existingWriteAmount.premium)
				newWriteAmounts.premium = existingWriteAmount.premium.add(premium)
			writeOptionAmounts[y.series] = newWriteAmounts
			return y
		}
	)
	const resolved = await Promise.all(enrichedWriteOptions)
	const filtered = resolved.filter(x => {
		if (!x.series) return
		if (!x.expiration) return
		return x.expiration > timestamp || !settledVaults.has(x.series)
	})
	// reduce write events to options positions by series
	const seriesProcessed = new Set()
	//@ts-ignore
	const optionPositions: EnrichedWriteEvent[] = filtered.reduce((acc, cv) => {
		if (!cv.series) return acc
		if (seriesProcessed.has(cv.series)) return acc
		const amounts: WriteOptionEventAmounts = writeOptionAmounts[cv.series]
		cv.amount = amounts.amount
		cv.escrow = amounts.escrow
		cv.premium = amounts.premium
		seriesProcessed.add(cv.series)
		return [...acc, cv]
	}, [])
	return optionPositions
}

async function getContractsState(
	liquidityPool: LiquidityPool,
	priceFeed: PriceFeed,
	optionRegistry: OptionRegistry,
	controller: NewController
): Promise<ContractsState> {
	const utilizationCurve: UtilizationCurve = await getUtilizationCurve(liquidityPool)
	const collateralAssetAddress = await liquidityPool.collateralAsset()
	const maxDiscount = await liquidityPool.maxDiscount()
	const collateralAsset: ERC20 = new ethers.Contract(
		collateralAssetAddress,
		ERC20Artifact.abi,
		liquidityPool.provider
	) as ERC20
	const lpCollateralBalance = await collateralAsset.balanceOf(liquidityPool.address)
	const assets = await liquidityPool.getAssets()
	const externalDelta = await liquidityPool.getExternalDelta()
	const underlying = await liquidityPool.underlyingAsset()
	const strikeAsset = await liquidityPool.strikeAsset()
	const priceQuote = await priceFeed.getNormalizedRate(underlying, strikeAsset)

	const vaultLiquidationRegisteredFilter = optionRegistry.filters.VaultLiquidationRegistered()
	const writeOptionEventFilter = liquidityPool.filters.WriteOption()
	const buybackEventFilter = liquidityPool.filters.BuybackOption()
	const writeOption = await liquidityPool.queryFilter(writeOptionEventFilter)
	const buybackEvents = await liquidityPool.queryFilter(buybackEventFilter)
	const vaultLiquidationRegisteredEvents = await optionRegistry.queryFilter(
		vaultLiquidationRegisteredFilter
	)
	const optionsContractSettledFilter = await optionRegistry.filters.OptionsContractSettled()
	const optionsContractSettledEvents = await optionRegistry.queryFilter(optionsContractSettledFilter)
	const contractsState: ContractsState = {
		utilizationCurve,
		maxDiscount,
		lpCollateralBalance,
		assets,
		externalDelta,
		priceQuote,
		writeOption,
		buybackEvents,
		vaultLiquidationRegisteredEvents,
		underlying,
		strikeAsset,
		optionsContractSettledEvents
	}
	return contractsState
}
/**
 *
 * @param portfolioDelta - the delta of the portfolio after the option has already been written
 * @param externalDelta - the delta of external liquidity pools such as hedging reactors
 * @param optionDelta - the uninverted delta of the option being traded
 * @param amount - the quantity of the option being traded
 * @returns - the delta of the portfolio plus the uninverted delta of the option being traded
 */
function computeDelta(
	portfolioDelta: number,
	externalDelta: BigNumber,
	optionDelta: number,
	amount: BigNumber
): BigNumber {
	const externalDeltaNumber: number = Number(fromWei(externalDelta))
	const originalDelta = portfolioDelta + optionDelta * Number(fromWei(amount))
	return toWei(originalDelta.toString()).add(externalDeltaNumber)
}
const weiToNum = (x: BigNumber) => Number(fromWei(x))
async function getUtilizationCurve(liquidityPool: LiquidityPool): Promise<UtilizationCurve> {
	const utilizationFunctionThreshold: number = weiToNum(
		await liquidityPool.utilizationFunctionThreshold()
	)
	const belowUtilizationThresholdGradient: number = weiToNum(
		await liquidityPool.belowThresholdGradient()
	)
	const aboveUtilizationThresholdGradient: number = weiToNum(
		await liquidityPool.aboveThresholdGradient()
	)
	const yIntercept: number = weiToNum(await liquidityPool.aboveThresholdYIntercept())
	let utilizationCurve: UtilizationCurve = {
		utilizationFunctionThreshold,
		belowUtilizationThresholdGradient,
		aboveUtilizationThresholdGradient,
		yIntercept
	}
	return utilizationCurve
}

function getUtilizationPrice(
	utilizationBefore: number,
	utilizationAfter: number,
	optionPrice: number,
	utilizationCurve: UtilizationCurve
) {
	const {
		utilizationFunctionThreshold,
		belowUtilizationThresholdGradient,
		aboveUtilizationThresholdGradient,
		yIntercept
	} = utilizationCurve
	if (
		utilizationBefore < utilizationFunctionThreshold &&
		utilizationAfter < utilizationFunctionThreshold
	) {
		return (
			optionPrice +
			((optionPrice * (utilizationBefore + utilizationAfter)) / 2) * belowUtilizationThresholdGradient
		)
	} else if (
		utilizationBefore > utilizationFunctionThreshold &&
		utilizationAfter > utilizationFunctionThreshold
	) {
		const utilizationPremiumFactor =
			((utilizationBefore + utilizationAfter) / 2) * aboveUtilizationThresholdGradient + yIntercept
		return optionPrice + optionPrice * utilizationPremiumFactor
	} else {
		const weightingRatio =
			(utilizationFunctionThreshold - utilizationBefore) /
			(utilizationAfter - utilizationFunctionThreshold)
		const averageFactorBelow =
			((utilizationFunctionThreshold + utilizationBefore) / 2) * belowUtilizationThresholdGradient
		const averageFactorAbove =
			((utilizationFunctionThreshold + utilizationAfter) / 2) * aboveUtilizationThresholdGradient +
			yIntercept
		const multiplicationFactor =
			(weightingRatio * averageFactorBelow + averageFactorAbove) / (1 + weightingRatio)
		return optionPrice + optionPrice * multiplicationFactor
	}
}
/**
 * @typeParam greekVariables - variables used for localized black-scholes price
 * @param underlyingPrice - underlying price in wei
 * @param nav - Net Asset Value in wei
 * @param amount - Quantity of options being written in wei
 * @param collateralAllocated - Amount of collateral allocated by liquidity pool in wei
 * @param liquidityAllocated - Amount of collateral new option being written will use
 * @param portfolioDeltaBefore - Existing delta of the portfolio
 * @param optionDelta - delta of the option being written not adjusted for amount
 * @param lpUSDBalance - USD balance of the liquidity pool
 * @param maxDiscount - Max discount that will be applied in the tilt factor as defined in the liquidity pool
 * @returns option quote based on utilization
 */
function calculateOptionQuote(
	greekVariables: GreekVariables,
	underlyingPrice: BigNumber,
	nav: BigNumber,
	amount: BigNumber,
	collateralAllocated: BigNumber,
	liquidityAllocated: BigNumber,
	portfolioDeltaBefore: BigNumber,
	optionDelta: number,
	lpUSDBalance: BigNumber,
	utilizationCurve: UtilizationCurve,
	maxDiscount: BigNumber = ethers.utils.parseUnits("1", 17) // 10%
) {
	const numericAmt: number = parseFloat(fromWei(amount))
	const formattedOptionDelta: BigNumber = toWei(optionDelta.toString()).mul(amount.div(toWei("1")))
	// subtract new delta as pool is not buying
	const portfolioDeltaAfter: BigNumber = portfolioDeltaBefore.sub(formattedOptionDelta)
	const portfolioDeltaIsDecreased = portfolioDeltaAfter.abs().sub(portfolioDeltaBefore.abs()).lt(0)
	const normalisedDelta = portfolioDeltaBefore
		.add(portfolioDeltaAfter)
		.div(2)
		.abs()
		.div(nav.div(underlyingPrice))

	const deltaTiltAmount = parseFloat(
		utils.formatEther(normalisedDelta.gt(maxDiscount) ? maxDiscount : normalisedDelta)
	)
	const localBS = bs.blackScholes(...greekVariables) * numericAmt
	const utilizationBefore =
		tFormatUSDC(collateralAllocated) / tFormatUSDC(collateralAllocated.add(lpUSDBalance))
	const utilizationAfter =
		tFormatUSDC(collateralAllocated.add(liquidityAllocated)) /
		tFormatUSDC(collateralAllocated.add(lpUSDBalance))
	const utilizationPrice = getUtilizationPrice(
		utilizationBefore,
		utilizationAfter,
		localBS,
		utilizationCurve
	)
	// if delta exposure reduces, subtract delta skew from  pricequotes
	if (portfolioDeltaIsDecreased) return utilizationPrice - utilizationPrice * deltaTiltAmount
	return utilizationPrice + utilizationPrice * deltaTiltAmount
}
/**
 * @typeParam liquidityPool - Instance of the liquidityPool
 * @typeParam controller - Instance of the controller
 * @typeParam optionRegistry - Instance of the option registry
 * @typeParam priceFeed - Instance of the price feed
 * @typeParam opynOracle - Instance of the opyn oracle
 * @returns {{
 *  portfolioDelta: number,
 *  portfolioGamma: number,
 *  portfolioTheta: number,
 *  portfolioVega: number,
 *  callsPutsValue: number,
 *  bsCallsPutsValue: number }}
 */
export async function getPortfolioValues(
	liquidityPool: LiquidityPool,
	controller: NewController,
	optionRegistry: OptionRegistry,
	priceFeed: PriceFeed,
	opynOracle: Oracle
) {
	const contractsState: ContractsState = await getContractsState(
		liquidityPool,
		priceFeed,
		optionRegistry,
		controller
	)

	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block

	// index liquidated vault registrations by vaultId
	const vaultLiquidations: EventMap = {}
	// index settled vaults by vaultId
	const settledVaults = new Set<string>()
	// index buybacks amounts by series
	const buybackAmounts: EventMap = {}
	// index write amount by series address
	const writeOptionAmounts: WriteEventMap = {}

	populateEventMaps(contractsState, buybackAmounts, vaultLiquidations, settledVaults)
	const optionPositions: EnrichedWriteEvent[] = await filterAndEnrichWriteOptions(
		contractsState.writeOption,
		optionRegistry,
		writeOptionAmounts,
		timestamp,
		settledVaults
	)

	const resolvedOptionPositions: EnrichedWriteEvent[] = await enrichOptionPositions(
		optionPositions,
		contractsState,
		buybackAmounts,
		vaultLiquidations,
		timestamp,
		optionRegistry,
		liquidityPool,
		opynOracle,
		controller
	)
	const portfolioDelta = resolvedOptionPositions.reduce((total, num) => total + (num.delta || 0), 0)
	const portfolioGamma = resolvedOptionPositions.reduce((total, num) => total + (num.gamma || 0), 0)
	const portfolioVega = resolvedOptionPositions.reduce((total, num) => total + (num.vega || 0), 0)
	const portfolioTheta = resolvedOptionPositions.reduce((total, num) => total + (num.theta || 0), 0)
	const bsCallsPutsValue = resolvedOptionPositions.reduce(
		(total, num) => total + (num.bsQuote || 0),
		0
	)
	const nav = contractsState.assets.sub(toWei(bsCallsPutsValue.toString()))
	let collateralAllocated = ZERO
	const enrichedWithNav: EnrichedWriteEvent[] = resolvedOptionPositions.map(x => {
		if (x.amount && x.escrow && x.greekVariables && x.liquidityAllocated) {
			const premium = x.premium ? x.premium : ZERO
			// not inverting delta here to stay consistent with contracts
			const delta = greeks.getDelta(...x.greekVariables)
			// collateral has been removed when the option(s) were written
			// so we need to add it back to get the USD balance before the option(s) was written
			const preWriteCollateralBalance = contractsState.lpCollateralBalance
				.add(x.liquidityAllocated)
				.sub(premium)
			const quote = calculateOptionQuote(
				x.greekVariables,
				contractsState.priceQuote,
				nav,
				x.amount,
				collateralAllocated,
				x.liquidityAllocated,
				computeDelta(portfolioDelta, contractsState.externalDelta, delta, x.amount),
				delta,
				preWriteCollateralBalance,
				contractsState.utilizationCurve,
				contractsState.maxDiscount
			)
			x.utilizationQuote = quote
			collateralAllocated = collateralAllocated.add(x.escrow)
		}
		return x
	})
	const callsPutsValue = enrichedWithNav.reduce(
		(total, num) => total + (num.utilizationQuote || 0),
		0
	)
	return {
		portfolioDelta,
		portfolioGamma,
		portfolioTheta,
		portfolioVega,
		callsPutsValue,
		bsCallsPutsValue
	}
}
