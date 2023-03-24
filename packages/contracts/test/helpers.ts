import { AbiCoder } from "ethers/lib/utils"
import hre, { ethers } from "hardhat"
import {
	fromUSDC,
	fromWei,
	genOptionTimeFromUnix,
	SECONDS_IN_YEAR,
	tFormatUSDC,
	toOpyn,
	toUSDC,
	toWei,
	ZERO_ADDRESS
} from "../utils/conversion-helper"
import {
	ADDRESS_BOOK,
	CONTROLLER_OWNER,
	GAMMA_ORACLE,
	ORACLE_DISPUTE_PERIOD,
	ORACLE_LOCKING_PERIOD,
	ORACLE_OWNER,
	USDC_ADDRESS,
	WETH_ADDRESS
} from "./constants"
//@ts-ignore
import { BigNumber, BigNumberish, Contract, Signer, utils } from "ethers"
import greeks from "greeks"
import {
	AddressBook,
	AlphaPortfolioValuesFeed,
	BeyondPricer,
	ChainLinkPricer,
	LiquidityPool,
	MintableERC20,
	MockChainlinkAggregator,
	NewController,
	NewMarginCalculator,
	OptionCatalogue,
	OptionExchange,
	OptionRegistry,
	Oracle,
	Otoken,
	OtokenFactory,
	PriceFeed,
	VolatilityFeed,
	WETH
} from "../types"
//@ts-ignore
import bs from "black-scholes"
import { expect } from "chai"

const SIX_DPS = 1000000
const { provider } = ethers
const { parseEther } = ethers.utils
const chainId = 1

export async function getNetDhvExposure(
	strikePrice: BigNumberish,
	collateral: string,
	catalogue: OptionCatalogue,
	portfolioValuesFeed: AlphaPortfolioValuesFeed,
	expiration: BigNumberish,
	flavor: boolean
) {
	const formattedStrikePrice = strikePrice
		.div(ethers.utils.parseUnits("1", 12))
		.mul(ethers.utils.parseUnits("1", 12))
	const oHash = ethers.utils.solidityKeccak256(
		["uint64", "uint128", "bool"],
		[expiration, formattedStrikePrice, flavor]
	)
	return await portfolioValuesFeed.netDhvExposure(oHash)
}
export async function getSeriesWithe18Strike(proposedSeries: any, optionRegistry: OptionRegistry) {
	const formattedStrike = proposedSeries.strike
		.div(ethers.utils.parseUnits("1", 12))
		.mul(ethers.utils.parseUnits("1", 2))
	const seriesAddress = await optionRegistry.getSeries({
		expiration: proposedSeries.expiration,
		isPut: proposedSeries.isPut,
		strike: formattedStrike,
		strikeAsset: proposedSeries.strikeAsset,
		underlying: proposedSeries.underlying,
		collateral: proposedSeries.collateral
	})
	return seriesAddress
}

export async function compareQuotes(
	quoteResponse: any,
	liquidityPool: LiquidityPool,
	volFeed: VolatilityFeed,
	priceFeed: PriceFeed,
	proposedSeries: any,
	amount: BigNumber,
	isSell: boolean,
	exchange: OptionExchange,
	optionRegistry: OptionRegistry,
	usd: any,
	pricer: BeyondPricer,
	netDhvExposureOverride: BigNumberish = 1
) {
	const catalogue = (await ethers.getContractAt(
		"OptionCatalogue",
		await exchange.catalogue()
	)) as OptionCatalogue
	const portfolioValuesFeed = (await ethers.getContractAt(
		"AlphaPortfolioValuesFeed",
		await exchange.getPortfolioValuesFeed()
	)) as AlphaPortfolioValuesFeed
	const feePerContract = await pricer.feePerContract()
	const localDelta = await calculateOptionDeltaLocally(
		liquidityPool,
		priceFeed,
		proposedSeries,
		amount,
		isSell
	)
	const localQuote = await localQuoteOptionPrice(
		liquidityPool,
		volFeed,
		optionRegistry,
		usd,
		priceFeed,
		proposedSeries,
		amount,
		pricer,
		isSell,
		catalogue,
		portfolioValuesFeed,
		localDelta.div(amount.div(toWei("1"))),
		netDhvExposureOverride
	)
	expect(tFormatUSDC(quoteResponse[0]) - localQuote).to.be.within(-0.11, 0.11)
	expect(parseFloat(fromWei(quoteResponse.totalDelta.abs().sub(localDelta.abs())))).to.be.within(
		-0.005,
		0.005
	)
	if (proposedSeries.isPut) {
		if (isSell) {
			expect(localDelta).to.be.gt(0)
		} else {
			expect(localDelta).to.be.lt(0)
		}
		expect(quoteResponse.totalDelta).to.be.lt(0)
	} else {
		if (isSell) {
			expect(localDelta).to.be.lt(0)
		} else {
			expect(localDelta).to.be.gt(0)
		}
		expect(quoteResponse.totalDelta).to.be.gt(0)
	}
	expect(quoteResponse.totalFees).to.equal(feePerContract.mul(amount.div(toWei("1"))))
}
export async function getExchangeParams(
	liquidityPool: LiquidityPool,
	exchange: OptionExchange,
	usd: any,
	weth: any,
	portfolioValuesFeed: AlphaPortfolioValuesFeed,
	optionToken: any,
	senderAddress: string,
	amount: BigNumber
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
	let netDhvExposure = toWei("0")
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
		netDhvExposure = await getNetDhvExposure(
			(await optionToken.strikePrice()).mul(utils.parseUnits("1", 10)),
			usd.address,
			(await ethers.getContractAt("OptionCatalogue", await exchange.catalogue())) as OptionCatalogue,
			(await ethers.getContractAt(
				"AlphaPortfolioValuesFeed",
				await exchange.getPortfolioValuesFeed()
			)) as AlphaPortfolioValuesFeed,
			await optionToken.expiryTimestamp(),
			await optionToken.isPut()
		)
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
		collateralAllocated,
		netDhvExposure
	}
}
export async function makeBuy(
	exchange: OptionExchange,
	senderAddress: string,
	optionToken: string,
	amount: BigNumber,
	proposedSeries: any
) {
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
					indexOrAcceptablePremium: amount,
					data: "0x"
				}
			]
		}
	])
}

export async function makeIssueAndBuy(
	exchange: OptionExchange,
	senderAddress: string,
	optionToken: string,
	amount: BigNumber,
	proposedSeries: any
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
					indexOrAcceptablePremium: 0,
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
					indexOrAcceptablePremium: amount,
					data: "0x"
				}
			]
		}
	])
}

export async function makeSellBack(
	exchange: OptionExchange,
	senderAddress: string,
	optionToken: any,
	amount: BigNumber,
	proposedSeries: any
) {
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
					indexOrAcceptablePremium: 0,
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
export async function createFakeOtoken(
	senderAddress: string,
	proposedSeries: any,
	addressBook: AddressBook
) {
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
	optionSeries: any,
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
	volFeed: VolatilityFeed,
	optionRegistry: OptionRegistry,
	collateralAsset: MintableERC20,
	priceFeed: PriceFeed,
	optionSeries: any,
	amount: BigNumber,
	pricer: BeyondPricer,
	isSell: boolean = false // from perspective of user,
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
	const iv = await volFeed.getImpliedVolatilityWithForward(
		optionSeries.isPut,
		underlyingPrice,
		optionSeries.strike,
		optionSeries.expiration
	)

	const bidAskSpread = await pricer.bidAskIVSpread()
	const rfr = await pricer.riskFreeRate()
	const localBS =
		((bs.blackScholes(
			fromWei(iv[1]),
			fromWei(optionSeries.strike),
			timeToExpiration,
			isSell ? Number(fromWei(iv[0])) * (1 - Number(fromWei(bidAskSpread))) : fromWei(iv[0]),
			fromWei(rfr),
			optionSeries.isPut ? "put" : "call"
		) *
			parseFloat(fromWei(underlyingPrice))) /
			parseFloat(fromWei(iv[1]))) *
		parseFloat(fromWei(amount))

	return localBS
}
export async function calculateOptionQuoteLocallyAlpha(
	liquidityPool: LiquidityPool,
	optionRegistry: OptionRegistry,
	collateralAsset: MintableERC20,
	priceFeed: PriceFeed,
	optionSeries: any,
	amount: BigNumber,
	isSell: boolean = false // from perspective of user,
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

	const bidAskSpread = 0.01
	const rfr = 0.01
	const localBS =
		bs.blackScholes(
			priceNorm,
			fromWei(optionSeries.strike),
			timeToExpiration,
			isSell ? Number(fromWei(iv)) * (1 - Number(bidAskSpread)) : fromWei(iv),
			rfr,
			optionSeries.isPut ? "put" : "call"
		) * parseFloat(fromWei(amount))
	return localBS
}

export async function localQuoteOptionPrice(
	liquidityPool: LiquidityPool,
	volFeed: VolatilityFeed,
	optionRegistry: OptionRegistry,
	collateralAsset: MintableERC20,
	priceFeed: PriceFeed,
	optionSeries: any,
	amount: BigNumber,
	pricer: BeyondPricer,
	isSell: boolean, // from perspective of user,
	catalogue: OptionCatalogue,
	portfolioValuesFeed: AlphaPortfolioValuesFeed,
	optionDelta: BigNumber,
	netDhvExposure: BigNumberish = 1
) {
	const bsQ = await calculateOptionQuoteLocally(
		liquidityPool,
		volFeed,
		optionRegistry,
		collateralAsset,
		priceFeed,
		optionSeries,
		amount,
		pricer,
		isSell
	)
	const slip = await applySlippageLocally(
		pricer,
		catalogue,
		portfolioValuesFeed,
		optionSeries,
		amount,
		optionDelta,
		isSell,
		netDhvExposure
	)
	let spread = 0

	spread = await applySpreadLocally(
		pricer,
		(await ethers.getContractAt("AddressBook", ADDRESS_BOOK[chainId])) as AddressBook,
		priceFeed,
		optionSeries,
		amount,
		optionDelta,
		netDhvExposure,
		isSell
	)
	if (spread < 0) {
		spread = 0
	}
	return isSell ? bsQ * slip - spread : bsQ * slip + spread
}

export async function applySlippageLocally(
	beyondPricer: BeyondPricer,
	catalogue: OptionCatalogue,
	portfolioValuesFeed: AlphaPortfolioValuesFeed,
	optionSeries: any,
	amount: BigNumber,
	optionDelta: BigNumber,
	isSell: boolean = false, // from perspective of user
	netDhvExposure: BigNumberish = 1
) {
	const formattedStrikePrice = optionSeries.strike
		.div(ethers.utils.parseUnits("1", 12))
		.mul(ethers.utils.parseUnits("1", 12))
	const oHash = ethers.utils.solidityKeccak256(
		["uint64", "uint128", "bool"],
		[optionSeries.expiration, formattedStrikePrice, optionSeries.isPut]
	)
	if (netDhvExposure == 1) {
		netDhvExposure = await portfolioValuesFeed.netDhvExposure(oHash)
	}
	const newExposureCoefficient = isSell
		? parseFloat(fromWei(netDhvExposure)) + parseFloat(fromWei(amount))
		: parseFloat(fromWei(netDhvExposure)) - parseFloat(fromWei(amount))
	const oldExposureCoefficient = fromWei(netDhvExposure)
	const slippageGradient = await beyondPricer.slippageGradient()
	let modifiedSlippageGradient
	const deltaBandIndex = Math.floor(
		(parseFloat(fromWei(optionDelta.abs())) * 100) /
			parseFloat(fromWei(await beyondPricer.deltaBandWidth()))
	)
	if (parseFloat(fromWei(optionDelta)) < 0) {
		modifiedSlippageGradient =
			parseFloat(fromWei(slippageGradient)) *
			parseFloat(fromWei(await beyondPricer.putSlippageGradientMultipliers(deltaBandIndex)))
	} else {
		modifiedSlippageGradient =
			parseFloat(fromWei(slippageGradient)) *
			parseFloat(fromWei(await beyondPricer.callSlippageGradientMultipliers(deltaBandIndex)))
	}
	if (slippageGradient.eq(BigNumber.from(0))) {
		return 1
	}
	const slippageFactor = 1 + modifiedSlippageGradient
	const slippagePremium = isSell
		? (slippageFactor ** -oldExposureCoefficient - slippageFactor ** -newExposureCoefficient) /
		  Math.log(slippageFactor) /
		  parseFloat(fromWei(amount))
		: (slippageFactor ** -newExposureCoefficient - slippageFactor ** -oldExposureCoefficient) /
		  Math.log(slippageFactor) /
		  parseFloat(fromWei(amount))
	return slippagePremium
}

export async function applySpreadLocally(
	beyondPricer: BeyondPricer,
	addressBook: AddressBook,
	priceFeed: PriceFeed,
	optionSeries: any,
	amount: BigNumber,
	optionDelta: BigNumber,
	netDhvExposure: BigNumber,
	isSell: Boolean
) {
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block
	const timeToExpiry = (optionSeries.expiration - timestamp) / SECONDS_IN_YEAR
	let collateralLendingPremium = 0
	const underlyingPrice = await priceFeed.getNormalizedRate(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId]
	)
	if (!isSell) {
		let netShortContracts
		if (netDhvExposure < toWei("0")) {
			netShortContracts = amount
		} else {
			netShortContracts =
				amount.sub(netDhvExposure) < toWei("0") ? toWei("0") : amount.sub(netDhvExposure)
		}
		const marginCalc = (await ethers.getContractAt(
			"NewMarginCalculator",
			await addressBook.getMarginCalculator()
		)) as NewMarginCalculator

		const collateralToLend = parseFloat(
			fromUSDC(
				await marginCalc.getNakedMarginRequired(
					optionSeries.underlying,
					optionSeries.strikeAsset,
					optionSeries.collateral,
					netShortContracts.div(utils.parseUnits("1", 10)), // format from e18 to e8
					optionSeries.strike.div(utils.parseUnits("1", 10)), // format from e18 to e8
					underlyingPrice.div(utils.parseUnits("1", 10)), // format from e18 to e8,
					optionSeries.expiration,
					6,
					optionSeries.isPut
				)
			)
		)
		const collateralLendingRate = await beyondPricer.collateralLendingRate()
		collateralLendingPremium =
			(1 + collateralLendingRate / SIX_DPS) ** timeToExpiry * collateralToLend - collateralToLend
	}

	const dollarDelta =
		parseFloat(fromWei(optionDelta.abs())) *
		parseFloat(fromWei(amount)) *
		parseFloat(fromWei(underlyingPrice))
	let deltaBorrowPremium
	const sellLongDeltaBorrowRate = (await beyondPricer.deltaBorrowRates()).sellLong
	const sellShortDeltaBorrowRate = (await beyondPricer.deltaBorrowRates()).sellShort
	const buyLongDeltaBorrowRate = (await beyondPricer.deltaBorrowRates()).buyLong
	const buyShortDeltaBorrowRate = (await beyondPricer.deltaBorrowRates()).buyShort
	let realOptionDelta = optionDelta
	if (isSell) {
		realOptionDelta = -optionDelta
	}

	// option delta is flipped in case of sale, so flip back
	if (realOptionDelta < toWei("0")) {
		deltaBorrowPremium =
			dollarDelta *
				(1 + (isSell ? sellLongDeltaBorrowRate : buyShortDeltaBorrowRate) / SIX_DPS) ** timeToExpiry -
			dollarDelta
	} else {
		deltaBorrowPremium =
			dollarDelta *
				(1 + (isSell ? sellShortDeltaBorrowRate : buyLongDeltaBorrowRate) / SIX_DPS) ** timeToExpiry -
			dollarDelta
	}

	return collateralLendingPremium + deltaBorrowPremium
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
	isSell: boolean, // from perspective of user
	ignoreBASpread: boolean = false
) {
	const priceQuote = await priceFeed.getNormalizedRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block
	const time = genOptionTimeFromUnix(timestamp, optionSeries.expiration)
	const volFeed = (await ethers.getContractAt(
		"VolatilityFeed",
		await liquidityPool.getVolatilityFeed()
	)) as VolatilityFeed
	const vol = await volFeed.getImpliedVolatilityWithForward(
		optionSeries.isPut,
		priceQuote,
		optionSeries.strike,
		optionSeries.expiration
	)
	const rfr = 0
	let bidAskSpread: BigNumberish = 0
	if (!ignoreBASpread) {
		bidAskSpread = toWei("0.01")
	}

	const opType = optionSeries.isPut ? "put" : "call"
	let localDelta = greeks.getDelta(
		fromWei(vol[1]),
		fromWei(optionSeries.strike),
		time,
		isSell ? Number(fromWei(vol[0])) * (1 - Number(fromWei(bidAskSpread))) : fromWei(vol[0]),
		rfr,
		opType
	)
	localDelta = isSell ? -localDelta : localDelta
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
	isSell: boolean = false
) {
	const underlyingPrice = await priceFeed.getNormalizedRate(
		WETH_ADDRESS[chainId],
		USDC_ADDRESS[chainId]
	)
	const volFeed = (await ethers.getContractAt(
		"VolatilityFeed",
		await liquidityPool.getVolatilityFeed()
	)) as VolatilityFeed
	const iv = await volFeed.getImpliedVolatilityWithForward(
		optionSeries.isPut,
		underlyingPrice,
		optionSeries.strike,
		optionSeries.expiration
	)
	const blockNum = await ethers.provider.getBlockNumber()
	const block = await ethers.provider.getBlock(blockNum)
	const { timestamp } = block
	const timeToExpiration = genOptionTimeFromUnix(Number(timestamp), optionSeries.expiration)
	const rfr = 0
	const priceNorm = fromWei(iv[1])
	const localBS =
		((bs.blackScholes(
			priceNorm,
			fromWei(optionSeries.strike),
			timeToExpiration,
			Number(fromWei(iv[0])),
			rfr,
			optionSeries.isPut ? "put" : "call"
		) *
			parseFloat(fromWei(underlyingPrice))) /
			parseFloat(fromWei(iv[1]))) *
		parseFloat(fromWei(amount))

	return localBS
}
