//@ts-ignore
import { ethers } from "hardhat"
//@ts-ignore
import greeks from "greeks"
//@ts-ignore
import bs from "black-scholes"
import { BigNumber, Event, utils } from "ethers"
import { LiquidityPool } from "../types/LiquidityPool"
import { NewController } from "../types/NewController"
import { WriteOptionEvent } from "../types/LiquidityPool"
import { OptionRegistry } from "../types/OptionRegistry"
import { PriceFeed } from "../types/PriceFeed"
import {
	fromWei,
	genOptionTimeFromUnix,
	fromOpyn,
	fromOpynToWei,
	PUT,
	tFormatUSDC,
	toWei
} from "../utils/conversion-helper"
import { Oracle } from "../types/Oracle"
import { ERC20 } from "../types/ERC20"
import ERC20Artifact from "../artifacts/contracts/tokens/ERC20.sol/ERC20.json"

type GreekVariables = [string, string, number, string, number, "put" | "call"]
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
type VaultLiquidationRegisteredEvent = {
	amountLiquidated: BigNumber
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
	bsQuote?: number
	utilizationQuote: number
	greekVariables?: GreekVariables
	liquidityAllocated?: BigNumber
}
type SeriesInfo = [BigNumber, BigNumber, boolean, string, string, string] & {
	expiration: BigNumber
	strike: BigNumber
	isPut: boolean
	underlying: string
	strikeAsset: string
	collateral: string
}

type UtilizationCurve = {
	utilizationFunctionThreshold: number
	belowUtilizationThresholdGradient: number
	aboveUtilizationThresholdGradient: number
	yIntercept: number
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
	const portfolioDeltaAfter: BigNumber = portfolioDeltaBefore.add(formattedOptionDelta)
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
 * @returns {{ portfolioDelta: number, portfolioGamma: number, portfolioTheta: number, portfolioVega: number, callsPutsValue: number}}
 */
export async function getPortfolioValues(
	liquidityPool: LiquidityPool,
	controller: NewController,
	optionRegistry: OptionRegistry,
	priceFeed: PriceFeed,
	opynOracle: Oracle
) {
	const utilizationCurve: UtilizationCurve = await getUtilizationCurve(liquidityPool)
	const collateralAssetAddress = await liquidityPool.collateralAsset()
	const maxDiscount = await liquidityPool.maxDiscount()
	const collateralAsset: ERC20 = new ethers.Contract(
		collateralAssetAddress,
		ERC20Artifact.abi,
		liquidityPool.provider
	) as ERC20
	const lpCollateralBalance = await collateralAsset.balanceOf(liquidityPool.address)
	const collateralAllocated = await liquidityPool.collateralAllocated()
	const assets = await liquidityPool.getAssets()
	const portfolioDeltaBefore = await liquidityPool.getPortfolioDelta()
	const underlying = await liquidityPool.underlyingAsset()
	const strikeAsset = await liquidityPool.strikeAsset()
	const priceQuote = await priceFeed.getNormalizedRate(underlying, strikeAsset)

	const vaultLiquidationRegisteredFilter = optionRegistry.filters.VaultLiquidationRegistered()
	const writeOptionEventFilter = liquidityPool.filters.WriteOption()
	const buybackEventFilter = liquidityPool.filters.BuybackOption()
	const vaultSettledFilter = controller.filters.VaultSettled()
	const writeOption = await liquidityPool.queryFilter(writeOptionEventFilter)
	const buybackEvents = await liquidityPool.queryFilter(buybackEventFilter)
	const vaultSettledEvents = await controller.queryFilter(vaultSettledFilter)
	const vaultLiquidationRegisteredEvents = await optionRegistry.queryFilter(
		vaultLiquidationRegisteredFilter
	)
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const underlyingAsset = await liquidityPool.underlyingAsset()
	const { timestamp } = block

	// index liquidated vault registrations by vaultId
	const vaultLiquidations: Record<string, BigNumber> = {}
	// index settled vaults by vaultId
	const settledVaults = new Set<string>()
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
			buybackAmounts[decoded.series] = amount.add(decoded.amount)
		}
		return decoded
	})

	vaultLiquidationRegisteredEvents.map(x => {
		if (!x.decode) return
		const decoded: VaultLiquidationRegisteredEvent = x.decode(x.data, x.topics)
		const amountLiquidated = vaultLiquidations[decoded.vaultId.toString()]
		const fromOpynAmount = fromOpynToWei(decoded.amountLiquidated)
		if (!amountLiquidated) vaultLiquidations[decoded.vaultId.toString()] = fromOpynAmount
		else vaultLiquidations[decoded.vaultId.toString()] = amountLiquidated.add(fromOpynAmount)
	})

	vaultSettledEvents.map(x => {
		if (!x.decode) return
		const decoded = x.decode(x.data, x.topics)
		settledVaults.add(decoded.vaultId.toString())
	})
	const enrichedWriteOptions: Promise<EnrichedWriteEvent>[] = writeOption.map(
		async (x: WriteOptionEvent): Promise<EnrichedWriteEvent> => {
			const y: EnrichedWriteEvent = x as EnrichedWriteEvent
			const { data, topics, decode } = y
			if (!decode) return y
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
			const existingWriteAmount = writeOptionAmounts[y.series]
			if (!existingWriteAmount) writeOptionAmounts[y.series] = amount
			else writeOptionAmounts[y.series] = existingWriteAmount.add(amount)
			return y
		}
	)
	const resolved = await Promise.all(enrichedWriteOptions)
	// remove expired options
	const filtered = resolved.filter(x => {
		if (!x.vaultId) return
		if (!x.expiration) return
		// filter out only expired and settled
		return x.expiration > timestamp || !settledVaults.has(x.vaultId)
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
		const liquidationAmount: BigNumber = vaultLiquidations[x.vaultId]
		if (buybackAmount) x.amount = x.amount?.sub(buybackAmount)
		if (liquidationAmount) x.amount = x.amount?.sub(liquidationAmount)

		const seriesInfo = await optionRegistry.seriesInfo(x.series)
		const priceNorm = fromWei(priceQuote)
		const iv = await liquidityPool.getImpliedVolatility(
			seriesInfo.isPut,
			priceQuote,
			seriesInfo.strike,
			seriesInfo.expiration
		)
		const optionType = seriesInfo.isPut ? "put" : "call"
		let timeToExpiration = genOptionTimeFromUnix(Number(timestamp), seriesInfo.expiration.toNumber())
		const rfr = fromWei(await liquidityPool.riskFreeRate())
		let priceToUse = priceNorm
		if (!x.expiration) return x
		// handle expired but not settled options
		if (x.expiration <= timestamp) {
			const [price] = await opynOracle.getExpiryPrice(underlyingAsset, seriesInfo.expiration)
			timeToExpiration = 0
			priceToUse = fromOpyn(price)
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
		const delta = greeks.getDelta(...greekVariables)
		const gamma = greeks.getGamma(...greekVariables)
		const vega = greeks.getVega(...greekVariables)
		const theta = greeks.getTheta(...greekVariables)
		const bsQuote: number = bs.blackScholes(...greekVariables)
		const optionSeries = {
			expiration: seriesInfo.expiration,
			strike: seriesInfo.strike,
			isPut: greekVariables[5] == "put" ? true : false,
			strikeAsset: seriesInfo.strikeAsset,
			underlying: seriesInfo.underlying,
			collateral: seriesInfo.collateral
		}
		if (!x.amount) return x
		const liquidityAllocated: BigNumber = await optionRegistry.getCollateral(optionSeries, x.amount)
		x.liquidityAllocated = liquidityAllocated
		// @TODO consider keeping calculation in BigNumber as more precise and is the format onchain.
		if (x.amount) {
			const numericAmt = Number(fromWei(x.amount))
			// invert sign due to writing rather than buying
			x.delta = numericAmt * delta * -1
			x.gamma = numericAmt * gamma * -1
			x.theta = numericAmt * theta * -1
			x.vega = numericAmt * vega * -1
			x.bsQuote = bsQuote
		}
		return x
	})
	const resolvedOptionPositions = await Promise.all(enrichedOptionPositions)
	const portfolioDelta = resolvedOptionPositions.reduce((total, num) => total + (num.delta || 0), 0)
	const portfolioGamma = resolvedOptionPositions.reduce((total, num) => total + (num.gamma || 0), 0)
	const portfolioVega = resolvedOptionPositions.reduce((total, num) => total + (num.vega || 0), 0)
	const portfolioTheta = resolvedOptionPositions.reduce((total, num) => total + (num.theta || 0), 0)
	const bsCallsPutsValue = resolvedOptionPositions.reduce(
		(total, num) => total + (num.bsQuote || 0),
		0
	)
	const nav = assets.sub(toWei(bsCallsPutsValue.toString()))
	const enrichedWithNav: EnrichedWriteEvent[] = resolvedOptionPositions.map(x => {
		if (x.amount && x.greekVariables && x.liquidityAllocated) {
			const delta = greeks.getDelta(...x.greekVariables)
			const quote = calculateOptionQuote(
				x.greekVariables,
				priceQuote,
				nav,
				x.amount,
				collateralAllocated,
				x.liquidityAllocated,
				portfolioDeltaBefore,
				delta,
				lpCollateralBalance,
				utilizationCurve,
				maxDiscount
			)
			x.utilizationQuote = quote
		}
		return x
	})
	const callsPutsValue = enrichedWithNav.reduce(
		(total, num) => total + (num.utilizationQuote || 0),
		0
	)
	return { portfolioDelta, portfolioGamma, portfolioTheta, portfolioVega, callsPutsValue }
}
