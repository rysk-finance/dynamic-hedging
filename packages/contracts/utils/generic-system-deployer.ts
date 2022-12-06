import { BigNumber, Contract, Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"
import { toWei } from "./conversion-helper"
import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"

import { ERC20Interface } from "../types/ERC20Interface"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { AlphaPortfolioValuesFeed, PortfolioValuesStruct } from "../types/AlphaPortfolioValuesFeed"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPool } from "../types/LiquidityPool"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import { Volatility } from "../types/Volatility"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import {
	ADDRESS_BOOK,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	WETH_ADDRESS,
	USDC_OWNER_ADDRESS,
	UNISWAP_V3_SWAP_ROUTER
} from "../test/constants"
import { Accounting } from "../types/Accounting"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { Oracle } from "../types/Oracle"
import { VolatilityFeed } from "../types/VolatilityFeed"

dayjs.extend(utc)

import { BeyondOptionHandler } from "../types/BeyondOptionHandler"
import { OptionExchange } from "../types/OptionExchange"
import { BeyondPricer } from "../types/BeyondPricer"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000

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
		"ERC20Interface",
		WETH_ADDRESS[chainId]
	)) as ERC20Interface
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

	const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
	const _priceFeed = (await priceFeedFactory.deploy(authority.address)) as PriceFeed
	const priceFeed = _priceFeed
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
		putVolvol: 1_500000
	}
	await volFeed.setSabrParameters(proposedSabrParams, expiration)
	const normDistFactory = await ethers.getContractFactory("contracts/libraries/NormalDist.sol:NormalDist", {
		libraries: {}
	})
	const normDist = await normDistFactory.deploy()
	const blackScholesFactory = await ethers.getContractFactory("contracts/libraries/BlackScholes.sol:BlackScholes", {
		libraries: {
			NormalDist: normDist.address
		}
	})
	const blackScholesDeploy = await blackScholesFactory.deploy()
	const portfolioValuesFeedFactory = await ethers.getContractFactory("AlphaPortfolioValuesFeed", {
		libraries: {
			BlackScholes: blackScholesDeploy.address
		}
	})
	const portfolioValuesFeed = (await portfolioValuesFeedFactory.deploy(
		authority.address
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
	weth: ERC20Interface,
	rfr: string,
	minCallStrikePrice: any,
	minPutStrikePrice: any,
	maxCallStrikePrice: any,
	maxPutStrikePrice: any,
	minExpiry: any,
	maxExpiry: any,
	optionRegistry: OptionRegistry,
	pvFeed: AlphaPortfolioValuesFeed,
	authority: string
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
			BlackScholes: blackScholesDeploy.address,
			OptionsCompute: optionsCompute.address
		}
	})
	const lp = (await liquidityPoolFactory.deploy(
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

	const lpAddress = lp.address
	const liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
	await optionRegistry.setLiquidityPool(liquidityPool.address)
	await liquidityPool.setMaxTimeDeviationThreshold(600)
	await liquidityPool.setMaxPriceDeviationThreshold(toWei("0.03"))
	await liquidityPool.setBidAskSpread(toWei("0.05"))
	await pvFeed.setLiquidityPool(liquidityPool.address)
	await pvFeed.setProtocol(optionProtocol.address)
	await pvFeed.fulfill(weth.address, usd.address)
	const AccountingFactory = await ethers.getContractFactory("Accounting")
	const Accounting = (await AccountingFactory.deploy(liquidityPool.address)) as Accounting
	const PricerFactory =  await ethers.getContractFactory("BeyondPricer",  {
		libraries: {
			BlackScholes: blackScholesDeploy.address
		}
	})
	const pricer = await PricerFactory.deploy(authority, optionProtocol.address, liquidityPool.address) as BeyondPricer
	await optionProtocol.changeAccounting(Accounting.address)
	// deploy libraries
	const interactionsFactory = await hre.ethers.getContractFactory("OpynInteractions")
	const interactions = await interactionsFactory.deploy()
	const exchangeFactory = await ethers.getContractFactory("OptionExchange",  {
		libraries: {
			OpynInteractions: interactions.address
		}
	})
	const exchange = (await exchangeFactory.deploy(
		authority,
		optionProtocol.address,
		liquidityPool.address,
		pricer.address,
		ADDRESS_BOOK[chainId],
		UNISWAP_V3_SWAP_ROUTER[chainId]
	)) as OptionExchange
	await liquidityPool.changeHandler(exchange.address, true)
	await pvFeed.setKeeper(exchange.address, true)
	await pvFeed.setKeeper(liquidityPool.address, true)
	await pvFeed.setKeeper(await signers[0].getAddress(), true)
	await pvFeed.setHandler(exchange.address, true)
	return {
		volatility: volatility,
		liquidityPool: liquidityPool,
		exchange: exchange,
		accounting: Accounting,
		pricer: pricer
	}
}
