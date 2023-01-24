import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"

import {
	ADDRESS_BOOK,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS
} from "../test/constants"
import { Accounting, AlphaOptionHandler, AlphaPortfolioValuesFeed, LiquidityPool, MintableERC20, MockChainlinkAggregator, OptionCatalogue, OptionRegistry, Oracle, PriceFeed, Protocol, Volatility, VolatilityFeed, WETH } from "../types"
import { toWei, ZERO_ADDRESS } from "./conversion-helper"

dayjs.extend(utc)

// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000

// decimal representation of a percentage
const interestRate: string = "0.01"
const miniCallStrikePrice = utils.parseEther("500")
const maxiCallStrikePrice = utils.parseEther("10000")
const miniPutStrikePrice = utils.parseEther("500")
const maxiPutStrikePrice = utils.parseEther("10000")
// one week in seconds
const miniExpiry = 86400 * 1
// 365 days in seconds
const maxiExpiry = 86400 * 50

export async function deploySystem(
	signers: Signer[],
	oracle: Oracle,
	opynAggregator: MockChainlinkAggregator
) {
	const sender = signers[0]
	const senderAddress = await sender.getAddress()
	// deploy libraries
	const interactionsFactory = await hre.ethers.getContractFactory("OpynInteractions")
	const interactions = await interactionsFactory.deploy()
	// deploy options registry
	const optionRegistryFactory = await hre.ethers.getContractFactory("OptionRegistry", {
		libraries: {
			OpynInteractions: interactions.address
		}
	})
	const authorityFactory = await hre.ethers.getContractFactory("Authority")
	const authority = await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)
	// get and transfer weth
	const weth = (await ethers.getContractAt(
		"contracts/interfaces/WETH.sol:WETH",
		WETH_ADDRESS[chainId]
	)) as WETH
	const wethERC20 = (await ethers.getContractAt(
		"contracts/tokens/ERC20.sol:ERC20",
		WETH_ADDRESS[chainId]
	)) as MintableERC20
	const usd = (await ethers.getContractAt(
		"contracts/tokens/ERC20.sol:ERC20",
		USDC_ADDRESS[chainId]
	)) as MintableERC20
	await network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [USDC_OWNER_ADDRESS[chainId]]
	})
	const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
	await usd.connect(signer).transfer(senderAddress, toWei("1000").div(oTokenDecimalShift18))
	await weth.deposit({ value: utils.parseEther("99") })
	const _optionRegistry = (await optionRegistryFactory.deploy(
		USDC_ADDRESS[chainId],
		OTOKEN_FACTORY[chainId],
		GAMMA_CONTROLLER[chainId],
		MARGIN_POOL[chainId],
		senderAddress,
		ADDRESS_BOOK[chainId],
		authority.address
	)) as OptionRegistry
	const optionRegistry = _optionRegistry

	const sequencerUptimeFeedFactory = await ethers.getContractFactory("MockChainlinkSequencerFeed")
	const sequencerUptimeFeed = await sequencerUptimeFeedFactory.deploy()
	const priceFeedFactory = await ethers.getContractFactory("contracts/PriceFeed.sol:PriceFeed")
	const _priceFeed = (await priceFeedFactory.deploy(
		authority.address,
		sequencerUptimeFeed.address
	)) as PriceFeed
	const priceFeed = _priceFeed
	await priceFeed.addPriceFeed(ZERO_ADDRESS, usd.address, opynAggregator.address)
	await priceFeed.addPriceFeed(weth.address, usd.address, opynAggregator.address)
	// oracle returns price denominated in 1e8
	const oraclePrice = await oracle.getPrice(weth.address)
	// pricefeed returns price denominated in 1e18
	const priceFeedPrice = await priceFeed.getNormalizedRate(weth.address, usd.address)
	const volFeedFactory = await ethers.getContractFactory("VolatilityFeed")
	const volFeed = (await volFeedFactory.deploy(authority.address)) as VolatilityFeed
	const expiryDate: string = "2022-04-05"
	let expiration = dayjs.utc(expiryDate).add(30, "days").add(8, "hours").unix()
	const proposedSabrParams = {
		callAlpha: 250000,
		callBeta: 1_000000,
		callRho: -300000,
		callVolvol: 1_500000,
		putAlpha: 250000,
		putBeta: 1_000000,
		putRho: -300000,
		putVolvol: 1_500000,
		interestRate: utils.parseEther("-0.001")
	}
	await volFeed.setSabrParameters(proposedSabrParams, expiration)
	const normDistFactory = await ethers.getContractFactory(
		"contracts/libraries/NormalDist.sol:NormalDist",
		{
			libraries: {}
		}
	)
	const normDist = await normDistFactory.deploy()
	const blackScholesFactory = await ethers.getContractFactory(
		"contracts/libraries/BlackScholes.sol:BlackScholes",
		{
			libraries: {
				NormalDist: normDist.address
			}
		}
	)
	const blackScholesDeploy = await blackScholesFactory.deploy()
	const portfolioValuesFeedFactory = await ethers.getContractFactory("AlphaPortfolioValuesFeed", {
		libraries: {
			BlackScholes: blackScholesDeploy.address
		}
	})
	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		authority.address,
		toWei("50000")
	)) as AlphaPortfolioValuesFeed

	const protocolFactory = await ethers.getContractFactory("contracts/Protocol.sol:Protocol")
	const optionProtocol = (await protocolFactory.deploy(
		optionRegistry.address,
		priceFeed.address,
		volFeed.address,
		portfolioValuesFeed.address,
		authority.address
	)) as Protocol
	expect(await optionProtocol.optionRegistry()).to.equal(optionRegistry.address)

	return {
		weth: weth,
		wethERC20: wethERC20,
		usd: usd,
		optionRegistry: optionRegistry,
		priceFeed: priceFeed,
		volFeed: volFeed,
		portfolioValuesFeed: portfolioValuesFeed,
		optionProtocol: optionProtocol,
		authority: authority
	}
}

export async function deployLiquidityPool(
	signers: Signer[],
	optionProtocol: Protocol,
	usd: MintableERC20,
	weth: MintableERC20,
	optionRegistry: OptionRegistry,
	pvFeed: AlphaPortfolioValuesFeed,
	authority: string,
	rfr: string = interestRate,
	minCallStrikePrice: any = miniCallStrikePrice,
	minPutStrikePrice: any = miniPutStrikePrice,
	maxCallStrikePrice: any = maxiCallStrikePrice,
	maxPutStrikePrice: any = maxiPutStrikePrice,
	minExpiry: any = miniExpiry,
	maxExpiry: any = maxiExpiry,
) {
	const normDistFactory = await ethers.getContractFactory(
		"contracts/libraries/NormalDist.sol:NormalDist",
		{
			libraries: {}
		}
	)
	const normDist = await normDistFactory.deploy()
	const volFactory = await ethers.getContractFactory("Volatility", {
		libraries: {}
	})
	const volatility = (await volFactory.deploy()) as Volatility
	const blackScholesFactory = await ethers.getContractFactory(
		"contracts/libraries/BlackScholes.sol:BlackScholes",
		{
			libraries: {
				NormalDist: normDist.address
			}
		}
	)
	const blackScholesDeploy = await blackScholesFactory.deploy()
	const optionsCompFactory = await await ethers.getContractFactory("OptionsCompute", {
		libraries: {}
	})
	const optionsCompute = await optionsCompFactory.deploy()
	const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
		libraries: {
			OptionsCompute: optionsCompute.address
		}
	})
	const liquidityPool = (await liquidityPoolFactory.deploy(
		optionProtocol.address,
		usd.address,
		weth.address,
		usd.address,
		toWei(rfr),
		"ETH/USDC",
		"EDP",
		{
			minCallStrikePrice,
			maxCallStrikePrice,
			minPutStrikePrice,
			maxPutStrikePrice,
			minExpiry: minExpiry,
			maxExpiry: maxExpiry
		},
		//@ts-ignore
		authority
	)) as LiquidityPool

	await optionRegistry.setLiquidityPool(liquidityPool.address)
	await liquidityPool.setMaxTimeDeviationThreshold(600)
	await liquidityPool.setMaxPriceDeviationThreshold(toWei("0.03"))
	await liquidityPool.setKeeper(await signers[0].getAddress(), true)
	await pvFeed.setLiquidityPool(liquidityPool.address)
	await pvFeed.setProtocol(optionProtocol.address)
	await pvFeed.fulfill(weth.address, usd.address)
	const AccountingFactory = await ethers.getContractFactory("Accounting")
	const Accounting = (await AccountingFactory.deploy(liquidityPool.address)) as Accounting
	await optionProtocol.changeAccounting(Accounting.address)
	const catalogueFactory = await ethers.getContractFactory("OptionCatalogue")
	const catalogue = (await catalogueFactory.deploy(
		authority,
		usd.address
	)) as OptionCatalogue
	const handlerFactory = await ethers.getContractFactory("AlphaOptionHandler")
	const handler = (await handlerFactory.deploy(
		authority,
		optionProtocol.address,
		liquidityPool.address
	)) as AlphaOptionHandler
	await liquidityPool.changeHandler(handler.address, true)
	await pvFeed.setKeeper(handler.address, true)
	await pvFeed.setKeeper(liquidityPool.address, true)
	await pvFeed.setKeeper(await signers[0].getAddress(), true)
	await pvFeed.setHandler(handler.address, true)
	await pvFeed.setRFR(toWei("0.01"))
	return {
		volatility: volatility,
		liquidityPool: liquidityPool,
		handler: handler,
		accounting: Accounting,
		catalogue: catalogue
	}
}
