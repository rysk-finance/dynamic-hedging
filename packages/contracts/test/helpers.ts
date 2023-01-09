import hre, { ethers } from "hardhat"
import {
	toWei,
	genOptionTimeFromUnix,
	fromWei,
	tFormatUSDC,
	tFormatEth,
	toUSDC,
	toOpyn
} from "../utils/conversion-helper"
import { AbiCoder } from "ethers/lib/utils"
import {
	CHAINLINK_WETH_PRICER,
	GAMMA_ORACLE,
	GAMMA_WHITELIST,
	ORACLE_DISPUTE_PERIOD,
	ORACLE_LOCKING_PERIOD,
	CONTROLLER_OWNER,
	ORACLE_OWNER,
	USDC_ADDRESS,
	WETH_ADDRESS
} from "./constants"
//@ts-ignore
import greeks from "greeks"
import { MintableERC20 } from "../types/MintableERC20"
import { WETH } from "../types/WETH"
import { BigNumber, Contract, Signer, utils } from "ethers"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { ChainLinkPricer } from "../types/ChainLinkPricer"
import { LiquidityPool } from "../types/LiquidityPool"
import { PriceFeed } from "../types/PriceFeed"
import { OtokenFactory } from "../types/OtokenFactory"
//@ts-ignore
import bs from "black-scholes"
import { OptionRegistry, OptionSeriesStruct } from "../types/OptionRegistry"
import { AddressBook } from "../types/AddressBook"
import { NewController } from "../types/NewController"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import { expect } from "chai"
import { Otoken } from "../types/Otoken"
import { BeyondPricer } from "../types/BeyondPricer"
import { OptionExchange } from "../types/OptionExchange"
import { priceToPriceX128 } from "@ragetrade/sdk"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const { provider } = ethers
const { parseEther } = ethers.utils
const chainId = 1
// decimal representation of a percentage
const rfr: string = "0"
const belowUtilizationThresholdGradient = 0
const aboveUtilizationThresholdGradient = 1
const utilizationFunctionThreshold = 0.6 // 60%
const yIntercept = -0.6

export async function getExchangeParams(
	liquidityPool,
	exchange,
	usd,
	weth,
	portfolioValuesFeed,
	optionToken,
	senderAddress,
	amount
) {
	const poolUSDBalance = await usd.balanceOf(liquidityPool.address)
	const senderUSDBalance = await usd.balanceOf(senderAddress)
	const exchangeTempUSD = await exchange.heldTokens(senderAddress, usd.address)
	const senderWethBalance = await weth.balanceOf(senderAddress)
	const pfList = await portfolioValuesFeed.getAddressSet()
	const opynAmount = toOpyn(fromWei(amount))
	const collateralAllocated = await liquidityPool.collateralAllocated()
	let seriesStores = await portfolioValuesFeed.storesForAddress(ZERO_ADDRESS)
	let exchangeOTokenBalance = 0
	let senderOtokenBalance = 0
	// stuff we always expect to be the case
	const poolWethBalance = await weth.balanceOf(liquidityPool.address)
	const exchangeWethBalance = await weth.balanceOf(exchange.address)
	const exchangeUSDBalance = await usd.balanceOf(exchange.address)
	expect(poolWethBalance).to.equal(0)
	expect(exchangeWethBalance).to.equal(0)
	expect(exchangeUSDBalance).to.equal(0)
	expect(exchangeTempUSD).to.equal(0)

	if (optionToken != 0) {
		exchangeOTokenBalance = await optionToken.balanceOf(exchange.address)
		senderOtokenBalance = await optionToken.balanceOf(senderAddress)
		seriesStores = await portfolioValuesFeed.storesForAddress(optionToken.address)
		const exchangeTempOtokens = await exchange.heldTokens(senderAddress, optionToken.address)
		const liquidityPoolOTokenBalance = await optionToken.balanceOf(liquidityPool.address)
		expect(liquidityPoolOTokenBalance).to.equal(0)
		expect(exchangeTempOtokens).to.equal(0)
	}
	return {
		poolUSDBalance,
		pfList,
		seriesStores,
		senderUSDBalance,
		senderWethBalance,
		opynAmount,
		exchangeOTokenBalance,
		senderOtokenBalance,
		collateralAllocated
	}
}
export async function makeBuy(exchange, senderAddress, optionToken, amount, proposedSeries) {
	await exchange.operate([
		{
			operation: 1,
			operationQueue: [
				{
					actionType: 1,
					owner: ZERO_ADDRESS,
					secondAddress: senderAddress,
					asset: optionToken,
					vaultId: 0,
					amount: amount,
					optionSeries: proposedSeries,
					index: 0,
					data: "0x"
				}
			]
		}
	])
}

export async function makeIssueAndBuy(
	exchange,
	senderAddress,
	optionToken,
	amount,
	proposedSeries
) {
	await exchange.operate([
		{
			operation: 1,
			operationQueue: [
				{
					actionType: 0,
					owner: ZERO_ADDRESS,
					secondAddress: ZERO_ADDRESS,
					asset: ZERO_ADDRESS,
					vaultId: 0,
					amount: 0,
					optionSeries: proposedSeries,
					index: 0,
					data: "0x"
				},
				{
					actionType: 1,
					owner: ZERO_ADDRESS,
					secondAddress: senderAddress,
					asset: ZERO_ADDRESS,
					vaultId: 0,
					amount: amount,
					optionSeries: proposedSeries,
					index: 0,
					data: "0x"
				}
			]
		}
	])
}

export async function makeSellBack(exchange, senderAddress, optionToken, amount, proposedSeries) {
	await exchange.operate([
		{
			operation: 1,
			operationQueue: [
				{
					actionType: 2,
					owner: ZERO_ADDRESS,
					secondAddress: senderAddress,
					asset: optionToken,
					vaultId: 0,
					amount: amount,
					optionSeries: proposedSeries,
					index: 0,
					data: "0x"
				}
			]
		}
	])
}

export async function whitelistProduct(
	underlying: string,
	strike: string,
	collateral: string,
	isPut: boolean,
	isNakedForPut: boolean,
	whitelistAddress: string,
	newCalculator: NewMarginCalculator,
	productSpotShockValue: any,
	timeToExpiry: any,
	expiryToValue: any,
	newController: NewController,
	oracle: Oracle,
	stablePrice: BigNumber
) {
	const adminSigner = (await ethers.getSigners())[0]

	await hre.network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [CONTROLLER_OWNER[chainId]]
	})
	await hre.network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [ORACLE_OWNER[chainId]]
	})
	const ownerSigner = await ethers.getSigner(CONTROLLER_OWNER[chainId])
	const oracleSigner = await ethers.getSigner(ORACLE_OWNER[chainId])

	const whitelist = await ethers.getContractAt("WhitelistInterface", whitelistAddress)

	await adminSigner.sendTransaction({
		to: CONTROLLER_OWNER[chainId],
		value: parseEther("1")
	})
	await whitelist.whitelistCollateral(collateral)
	await whitelist.whitelistProduct(underlying, strike, collateral, isPut)
	if (isNakedForPut) {
		await whitelist.whitelistCoveredCollateral(collateral, underlying, false)
		await whitelist.whitelistNakedCollateral(collateral, underlying, true)
	} else {
		await whitelist.whitelistCoveredCollateral(collateral, underlying, true)
		await whitelist.whitelistNakedCollateral(collateral, underlying, false)
		await oracle.connect(oracleSigner).setStablePrice(collateral, stablePrice)
	}
	await newController.connect(ownerSigner).setNakedCap(collateral, toWei("100000000000000000"))
	// usd collateralised calls
	await newCalculator.setSpotShock(underlying, strike, collateral, isPut, productSpotShockValue)
	// set expiry to value values
	await newCalculator.setUpperBoundValues(
		underlying,
		strike,
		collateral,
		isPut,
		timeToExpiry,
		expiryToValue
	)
}
export async function createFakeOtoken(senderAddress, proposedSeries, addressBook) {
	const otokenInstance = await ethers.getContractFactory("Otoken")
	const newOtoken = (await otokenInstance.deploy()) as Otoken
	await newOtoken.init(
		addressBook.address,
		proposedSeries.underlying,
		proposedSeries.strikeAsset,
		proposedSeries.collateral,
		proposedSeries.strike,
		proposedSeries.expiration,
		proposedSeries.isPut
	)
	return newOtoken
}
export async function createAndMintOtoken(
	addressBook: AddressBook,
	optionSeries: OptionSeriesStruct,
	usd: MintableERC20,
	weth: WETH,
	collateral: any,
	amount: BigNumber,
	signer: Signer,
	registry: OptionRegistry,
	vaultType: string
) {
	const signerAddress = await signer.getAddress()
	const otokenFactory = (await ethers.getContractAt(
		"OtokenFactory",
		await addressBook.getOtokenFactory()
	)) as OtokenFactory
	const otoken = await otokenFactory.callStatic.createOtoken(
		optionSeries.underlying,
		optionSeries.strikeAsset,
		optionSeries.collateral,
		optionSeries.strike.div(ethers.utils.parseUnits("1", 10)),
		optionSeries.expiration,
		optionSeries.isPut
	)
	await otokenFactory.createOtoken(
		optionSeries.underlying,
		optionSeries.strikeAsset,
		optionSeries.collateral,
		optionSeries.strike.div(ethers.utils.parseUnits("1", 10)),
		optionSeries.expiration,
		optionSeries.isPut
	)
	const controller = (await ethers.getContractAt(
		"NewController",
		await addressBook.getController()
	)) as NewController
	const marginPool = await addressBook.getMarginPool()
	const vaultId = await (await controller.getAccountVaultCounter(signerAddress)).add(1)
	const calculator = (await ethers.getContractAt(
		"NewMarginCalculator",
		await addressBook.getMarginCalculator()
	)) as NewMarginCalculator
	const marginRequirement = await (
		await registry.getCollateral(
			{
				expiration: optionSeries.expiration,
				strike: optionSeries.strike.div(ethers.utils.parseUnits("1", 10)),
				isPut: optionSeries.isPut,
				strikeAsset: optionSeries.strikeAsset,
				underlying: optionSeries.underlying,
				collateral: optionSeries.collateral
			},
			amount
		)
	).add(toUSDC("100"))
	await collateral.approve(marginPool, marginRequirement)
	const abiCode = new AbiCoder()
	const mintArgs = [
		{
			actionType: 0,
			owner: signerAddress,
			secondAddress: signerAddress,
			asset: ZERO_ADDRESS,
			vaultId: vaultId,
			amount: 0,
			index: 0,
			data: abiCode.encode(["uint256"], [vaultType])
		},
		{
			actionType: 5,
			owner: signerAddress,
			secondAddress: signerAddress,
			asset: collateral.address,
			vaultId: vaultId,
			amount: marginRequirement,
			index: 0,
			data: ZERO_ADDRESS
		},
		{
			actionType: 1,
			owner: signerAddress,
			secondAddress: signerAddress,
			asset: otoken,
			vaultId: vaultId,
			amount: amount.div(ethers.utils.parseUnits("1", 10)),
			index: 0,
			data: ZERO_ADDRESS
		}
	]
	await controller.connect(signer).operate(mintArgs)
	return otoken
}

export async function setupOracle(chainlinkPricer: string, signerAddress: string, useNew = false) {
	const signer = await provider.getSigner(signerAddress)
	await hre.network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [chainlinkPricer]
	})
	await hre.network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [ORACLE_OWNER[chainId]]
	})
	const pricerSigner = await provider.getSigner(chainlinkPricer)

	const forceSendContract = await ethers.getContractFactory("ForceSend")
	const forceSend = await forceSendContract.deploy() // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
	await forceSend.connect(signer).go(chainlinkPricer, { value: parseEther("0.5") })

	const oracle = await ethers.getContractAt("Oracle", GAMMA_ORACLE[chainId])

	const oracleOwnerSigner = await provider.getSigner(ORACLE_OWNER[chainId])

	await signer.sendTransaction({
		to: ORACLE_OWNER[chainId],
		value: parseEther("0.5")
	})
	await oracle.connect(oracleOwnerSigner).setStablePrice(USDC_ADDRESS[chainId], "100000000")
	const pricer = await ethers.getContractAt("ChainLinkPricer", chainlinkPricer)

	await oracle.connect(oracleOwnerSigner).setAssetPricer(await pricer.asset(), chainlinkPricer)
	return oracle
}

export async function setupTestOracle(signerAddress: string) {
	const signer = await provider.getSigner(signerAddress)

	await hre.network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [ORACLE_OWNER[chainId]]
	})

	const oracle = await ethers.getContractAt("Oracle", GAMMA_ORACLE[chainId])

	const oracleOwnerSigner = await provider.getSigner(ORACLE_OWNER[chainId])

	await signer.sendTransaction({
		to: ORACLE_OWNER[chainId],
		value: parseEther("0.5")
	})
	await oracle.connect(oracleOwnerSigner).setStablePrice(USDC_ADDRESS[chainId], "100000000")
	const newAggInstance = await ethers.getContractFactory("MockChainlinkAggregator")
	const aggregator = (await newAggInstance.deploy()) as MockChainlinkAggregator
	const newPricerInstance = await ethers.getContractFactory("ChainLinkPricer")
	const pricer = (await newPricerInstance.deploy(
		signerAddress,
		WETH_ADDRESS[chainId],
		aggregator.address,
		oracle.address
	)) as ChainLinkPricer
	const price = await oracle.getPrice(WETH_ADDRESS[chainId])
	await oracle.connect(oracleOwnerSigner).setAssetPricer(await pricer.asset(), pricer.address)
	const forceSendContract = await ethers.getContractFactory("ForceSend")
	const forceSend = await forceSendContract.deploy() // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
	await forceSend.connect(signer).go(pricer.address, { value: parseEther("0.5") })
	await aggregator.setLatestAnswer(price)
	return [oracle, aggregator, pricer.address]
}

export async function setOpynOracleExpiryPrice(
	asset: string,
	oracle: Contract,
	expiry: number,
	settlePrice: BigNumber,
	pricer?: string
) {
	await increaseTo(expiry + ORACLE_LOCKING_PERIOD + 100)
	if (pricer == undefined) {
		pricer = await oracle.getPricer(asset)
	}
	await hre.network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [pricer]
	})
	const pricerSigner = await provider.getSigner(pricer)
	const res = await oracle.connect(pricerSigner).setExpiryPrice(asset, expiry, settlePrice)

	const receipt = await res.wait()
	const timestamp = (await provider.getBlock(receipt.blockNumber)).timestamp

	await increaseTo(timestamp + ORACLE_DISPUTE_PERIOD + 1000)
}

export async function increaseTo(target: number | BigNumber) {
	if (!BigNumber.isBigNumber(target)) {
		target = BigNumber.from(target)
	}

	const now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp)

	if (target.lt(now))
		throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`)

	const diff = target.sub(now)
	return increase(diff)
}

export async function increase(duration: number | BigNumber) {
	if (!BigNumber.isBigNumber(duration)) {
		duration = BigNumber.from(duration)
	}

	if (duration.lt(BigNumber.from("0")))
		throw Error(`Cannot increase time by a negative amount (${duration})`)

	await ethers.provider.send("evm_increaseTime", [duration.toNumber()])

	await ethers.provider.send("evm_mine", [])
}

export async function calculateOptionQuoteLocally(
	liquidityPool: LiquidityPool,
	optionRegistry: OptionRegistry,
	collateralAsset: MintableERC20,
	priceFeed: PriceFeed,
	optionSeries: {
		expiration: number
		strike: BigNumber
		isPut: boolean
		strikeAsset: string
		underlying: string
		collateral: string
	},
	amount: BigNumber,
	toBuy: boolean = false // from perspective of DHV
) {
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block
	const timeToExpiration = genOptionTimeFromUnix(Number(timestamp), optionSeries.expiration)
	const underlyingPrice = await priceFeed.getNormalizedRate(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId]
	)
	const priceNorm = fromWei(underlyingPrice)
	const iv = await liquidityPool.getImpliedVolatility(
		optionSeries.isPut,
		underlyingPrice,
		optionSeries.strike,
		optionSeries.expiration
	)

	const bidAskSpread = 0
	const rfr = "0"
	const localBS =
		bs.blackScholes(
			priceNorm,
			fromWei(optionSeries.strike),
			timeToExpiration,
			toBuy ? Number(fromWei(iv)) * (1 - Number(bidAskSpread)) : fromWei(iv),
			parseFloat(rfr),
			optionSeries.isPut ? "put" : "call"
		) * parseFloat(fromWei(amount))
	return localBS
}

export async function applySlippageLocally(
	beyondPricer: BeyondPricer,
	exchange: OptionExchange,
	optionSeries: {
		expiration: number
		strike: BigNumber
		isPut: boolean
		strikeAsset: string
		underlying: string
		collateral: string
	},
	amount: BigNumber,
	vanillaPremium: Number,
	optionDelta: BigNumber,
	toBuy: boolean = false // from perspective of DHV
) {
	const formattedStrikePrice = (
		await exchange.formatStrikePrice(optionSeries.strike, optionSeries.collateral)
	).mul(ethers.utils.parseUnits("1", 10))
	const oHash = ethers.utils.solidityKeccak256(
		["uint64", "uint128", "bool"],
		[optionSeries.expiration, formattedStrikePrice, optionSeries.isPut]
	)
	const netDhvExposure = await exchange.netDhvExposure(oHash)
	console.log({ oHash, netDhvExposure })

	const exposureCoefficient = toBuy
		? parseFloat(fromWei(netDhvExposure)) + parseFloat(fromWei(amount)) / 2
		: parseFloat(fromWei(netDhvExposure)) - parseFloat(fromWei(amount)) / 2
	const slippageGradient = await beyondPricer.slippageGradient()
	let modifiedSlippageGradient
	console.log({ optionDelta })
	const deltaBandIndex = Math.floor(
		(parseFloat(fromWei(optionDelta.abs())) * 100) /
			parseFloat(fromWei(await beyondPricer.deltaBandWidth()))
	)
	console.log({
		deltaBandIndex,
		optionDelta: parseFloat(fromWei(optionDelta.abs())),
		deltaBandWidth: parseFloat(fromWei(await beyondPricer.deltaBandWidth()))
	})
	console.log("multiplier:", await beyondPricer.putSlippageGradientMultipliers(deltaBandIndex))
	if (parseFloat(fromWei(optionDelta)) < 0) {
		modifiedSlippageGradient =
			parseFloat(fromWei(slippageGradient)) *
			parseFloat(fromWei(await beyondPricer.putSlippageGradientMultipliers(deltaBandIndex)))
	} else {
		modifiedSlippageGradient =
			parseFloat(fromWei(slippageGradient)) *
			parseFloat(fromWei(await beyondPricer.callSlippageGradientMultipliers(deltaBandIndex)))
	}
	const slippagePremium = (1 + modifiedSlippageGradient) ** -exposureCoefficient
	console.log({ modifiedSlippageGradient, exposureCoefficient, slippagePremium })
	return slippagePremium
}

export async function calculateOptionDeltaLocally(
	liquidityPool: LiquidityPool,
	priceFeed: PriceFeed,
	optionSeries: {
		expiration: any
		isPut: boolean
		strike: any
		strikeAsset: string
		underlying: string
		collateral: string
	},
	amount: BigNumber,
	isShort: boolean
) {
	const priceQuote = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block
	const time = genOptionTimeFromUnix(timestamp, optionSeries.expiration)
	const vol = await liquidityPool.getImpliedVolatility(
		optionSeries.isPut,
		priceQuote,
		optionSeries.strike,
		optionSeries.expiration
	)
	const opType = optionSeries.isPut ? "put" : "call"
	let localDelta = greeks.getDelta(
		fromWei(priceQuote),
		fromWei(optionSeries.strike),
		time,
		fromWei(vol),
		rfr,
		opType
	)
	localDelta = isShort ? -localDelta : localDelta
	return toWei(localDelta.toFixed(18).toString()).mul(amount).div(toWei("1"))
}

export async function getBlackScholesQuote(
	liquidityPool: LiquidityPool,
	optionRegistry: OptionRegistry,
	collateralAsset: MintableERC20,
	priceFeed: PriceFeed,
	optionSeries: {
		expiration: number
		strike: BigNumber
		isPut: boolean
		strikeAsset: string
		underlying: string
		collateral: string
	},
	amount: BigNumber,
	toBuy: boolean = false
) {
	const underlyingPrice = await priceFeed.getNormalizedRate(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId]
	)
	const iv = await liquidityPool.getImpliedVolatility(
		optionSeries.isPut,
		underlyingPrice,
		optionSeries.strike,
		optionSeries.expiration
	)
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block
	const timeToExpiration = genOptionTimeFromUnix(Number(timestamp), optionSeries.expiration)

	const priceNorm = fromWei(underlyingPrice)
	const localBS =
		bs.blackScholes(
			priceNorm,
			fromWei(optionSeries.strike),
			timeToExpiration,
			Number(fromWei(iv)),
			parseFloat(rfr),
			optionSeries.isPut ? "put" : "call"
		) * parseFloat(fromWei(amount))

	return localBS
}

function getUtilizationPrice(
	utilizationBefore: number,
	utilizationAfter: number,
	optionPrice: number
) {
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
