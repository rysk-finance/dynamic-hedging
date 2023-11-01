import hre, { ethers, network, Contract } from "hardhat"
import { Signer, BigNumber, utils } from "ethers"
import { expect, util } from "chai"
import { MintableERC20 } from "../types/MintableERC20"
import {
	UniswapV3RangeOrderReactor,
	RangeOrderParamsStruct
} from "../types/UniswapV3RangeOrderReactor"
import { UniswapV3HedgingTest } from "../types/UniswapV3HedgingTest"
import { UniswapConversionsTest } from "../types"
import {
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS,
	UNISWAP_V3_FACTORY,
	USDT_ADDRESS
} from "./constants"
import { PriceFeed } from "../types/PriceFeed"
import { Manager } from "../types/Manager"
import { Authority } from "../types/Authority"
import { MintEvent } from "../types/IUniswapV3PoolEvents"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import { abi as ISwapRouterABI } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json"
import { abi as IPriceFeedABI } from "../artifacts/contracts/PriceFeed.sol/PriceFeed.json"
import { getPoolInfo } from "../utils/uniswap"
import { fromUSDC, fromWei, toUSDC, toWei } from "../utils/conversion-helper"
import {
	getMatchingEvents,
	UNISWAP_POOL_MINT,
	UNISWAP_POOL_BURN,
	UNISWAP_POOL_COLLECT
} from "../utils/events"
import { WETH } from "../types/WETH"
import { LiquidityPool } from "../types/LiquidityPool"
import { arbitrum as addresses } from "../contracts.json"

enum Direction {
	ABOVE = 0,
	BELOW = 1
}
let signers: Signer[]
let usdcWhale: Signer
let usdcWhaleAddress: string
let usdtWhale: Signer
let usdtWhaleAddress: string
let liquidityPoolDummy: UniswapV3HedgingTest
let liquidityPoolDummyAddress: string
let liquidityPoolUSDTDummy: UniswapV3HedgingTest
let liquidityPoolUSDTDummyAddress: string
let uniswapV3RangeOrderReactor: UniswapV3RangeOrderReactor
let wethUsdtRangeOrderReactor: UniswapV3RangeOrderReactor
let usdcContract: MintableERC20
let usdtContract: MintableERC20
let wethContract: WETH
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
let uniswapUSDCWETHPool: Contract
let uniswapWETHUSDTPool: Contract
let uniswapConversions: UniswapConversionsTest
let uniswapRouter: Contract
let bigSignerAddress: string
let authority: string
let manager: Manager
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const POOL_FEE = 3000
const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
const TETHER_TREASURY = "0x5754284f345afc66a98fbB0a0Afe71e0F007B949"
// edit depending on the chain id to be tested on
const chainId = 1

describe("UniswapV3RangeOrderReactor", () => {
	before(async function () {
		await network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						chainId: 1,
						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
						blockNumber: 14500000
					}
				}
			]
		})
	})

	it("deploys Uniswap Conversions Testing contract", async () => {
		signers = await ethers.getSigners()
		const uniswapConversionsFactory = await ethers.getContractFactory("UniswapConversionsTest")
		uniswapConversions = (await uniswapConversionsFactory.deploy()) as Contract
	})

	it("deploys the dummy LP USDC collateral contract", async () => {
		signers = await ethers.getSigners()
		const liquidityPoolDummyFactory = await ethers.getContractFactory("UniswapV3HedgingTest")
		liquidityPoolDummy = (await liquidityPoolDummyFactory.deploy()) as UniswapV3HedgingTest
		liquidityPoolDummyAddress = liquidityPoolDummy.address

		expect(liquidityPoolDummy).to.have.property("setHedgingReactorAddress")
		expect(liquidityPoolDummy).to.have.property("hedgeDelta")
	})

	it("deploys the dummy LP USDT contract", async () => {
		signers = await ethers.getSigners()
		const liquidityPoolDummyFactory = await ethers.getContractFactory("UniswapV3HedgingTest")
		liquidityPoolUSDTDummy = (await liquidityPoolDummyFactory.deploy()) as UniswapV3HedgingTest
		liquidityPoolUSDTDummyAddress = liquidityPoolDummy.address

		expect(liquidityPoolDummy).to.have.property("setHedgingReactorAddressAndToken")
		expect(liquidityPoolDummy).to.have.property("hedgeDelta")
	})

	it("funds the LP contract with a million USDC", async () => {
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		usdcWhale = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		await signers[0].sendTransaction({
			to: USDC_OWNER_ADDRESS[chainId],
			value: ethers.utils.parseEther("1.0") // Sends exactly 1.0 ether
		})
		usdcWhaleAddress = await usdcWhale.getAddress()
		usdcContract = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDC_ADDRESS[chainId]
		)) as MintableERC20

		await usdcContract
			.connect(usdcWhale)
			.transfer(liquidityPoolDummyAddress, ethers.utils.parseUnits("1000000", 6))

		const LPContractBalance = parseFloat(
			ethers.utils.formatUnits(await usdcContract.balanceOf(liquidityPoolDummyAddress), 6)
		)

		expect(LPContractBalance).to.equal(1000000)
	})

	it("funds the LP contract with a million USDT", async () => {
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [TETHER_TREASURY]
		})
		usdtWhale = await ethers.getSigner(TETHER_TREASURY)
		await signers[0].sendTransaction({
			to: TETHER_TREASURY,
			value: ethers.utils.parseEther("1.0") // Sends exactly 1.0 ether
		})
		usdtWhaleAddress = await usdcWhale.getAddress()
		usdtContract = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDT_ADDRESS[chainId]
		)) as MintableERC20

		await usdtContract
			.connect(usdtWhale)
			.transfer(liquidityPoolUSDTDummyAddress, ethers.utils.parseUnits("1000000", 6))

		const LPContractBalance = parseFloat(
			ethers.utils.formatUnits(await usdtContract.balanceOf(liquidityPoolUSDTDummyAddress), 6)
		)

		expect(LPContractBalance).to.equal(1000000)
	})

	it("Should deploy a price feed", async () => {
		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)
		const authorityFactory = await hre.ethers.getContractFactory("Authority")
		const senderAddress = await signers[0].getAddress()
		authority = (await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)).address
		const sequencerUptimeFeedFactory = await ethers.getContractFactory("MockChainlinkSequencerFeed")
		const sequencerUptimeFeed = await sequencerUptimeFeedFactory.deploy()
		const priceFeedFactory = await ethers.getContractFactory("contracts/PriceFeed.sol:PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy(
			authority,
			sequencerUptimeFeed.address
		)) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, USDC_ADDRESS[chainId], ethUSDAggregator.address)
		await priceFeed.addPriceFeed(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			ethUSDAggregator.address
		)
		await priceFeed.addPriceFeed(
			WETH_ADDRESS[chainId],
			USDT_ADDRESS[chainId],
			ethUSDAggregator.address
		)
		const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, USDC_ADDRESS[chainId])
		expect(feedAddress).to.eq(ethUSDAggregator.address)
		//rate = "3555720000"
		rate = "3280899462"
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			rate,
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		await ethUSDAggregator.mock.decimals.returns("6")
	})

	it("deploys the UniswapV3RangeOrderReactor contract", async () => {
		const uniswapV3RangeOrderReactorFactory = await ethers.getContractFactory(
			"UniswapV3RangeOrderReactor",
			{
				signer: signers[0]
			}
		)

		uniswapV3RangeOrderReactor = (await uniswapV3RangeOrderReactorFactory.deploy(
			UNISWAP_V3_FACTORY,
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			liquidityPoolDummyAddress,
			POOL_FEE,
			priceFeed.address,
			authority
		)) as UniswapV3RangeOrderReactor
		expect(uniswapV3RangeOrderReactor).to.have.property("hedgeDelta")
	})

	it("deploys the UniswapV3RangeOrderReactor contract with weth/usdt pair", async () => {
		// This pool is being deployed to test cases where the pair of tokens is inverted in order from usdc/weth
		const uniswapV3RangeOrderReactorFactory = await ethers.getContractFactory(
			"UniswapV3RangeOrderReactor",
			{
				signer: signers[0]
			}
		)

		wethUsdtRangeOrderReactor = (await uniswapV3RangeOrderReactorFactory.deploy(
			UNISWAP_V3_FACTORY,
			USDT_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			liquidityPoolDummyAddress,
			POOL_FEE,
			priceFeed.address,
			authority
		)) as UniswapV3RangeOrderReactor
		const poolAddress = await wethUsdtRangeOrderReactor.pool()
		uniswapWETHUSDTPool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, signers[1])
		const token0 = await wethUsdtRangeOrderReactor.token0()
		const token1 = await wethUsdtRangeOrderReactor.token1()
		expect(wethUsdtRangeOrderReactor).to.have.property("hedgeDelta")
		expect(token0.toLowerCase()).to.eq(WETH_ADDRESS[chainId].toLowerCase())
		expect(token1.toLowerCase()).to.eq(USDT_ADDRESS[chainId].toLowerCase())
	})

	it("sets reactor address on LP contract", async () => {
		const reactorAddress = uniswapV3RangeOrderReactor.address

		await liquidityPoolDummy.setHedgingReactorAddress(reactorAddress)

		expect(await liquidityPoolDummy.uniswapV3HedgingReactor()).to.equal(reactorAddress)
	})

	it("sets up a uniswap pool, router and large swapper", async () => {
		wethContract = (await ethers.getContractAt(
			"contracts/tokens/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		const provider = ethers.provider
		bigSignerAddress = await signers[1].getAddress()
		// 100,000 * 1e18
		const ONE_HUNDRED_THOUSAND_HEX = "0x152D02C7E14AF6800000"
		await hre.network.provider.request({
			method: "hardhat_setBalance",
			params: [bigSignerAddress, ONE_HUNDRED_THOUSAND_HEX]
		})
		const signer1BalanceAfter = await provider.getBalance(await signers[1].getAddress())
		expect(signer1BalanceAfter).to.equal(ONE_HUNDRED_THOUSAND_HEX)

		const amountToSend = toUSDC("10000000").toString()
		await usdcContract.connect(usdcWhale).transfer(bigSignerAddress, amountToSend)

		const poolAddress = await uniswapV3RangeOrderReactor.pool()
		uniswapUSDCWETHPool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, signers[1])
		uniswapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, ISwapRouterABI, signers[1])

		const wethBalanceBefore = await wethContract.balanceOf(bigSignerAddress)
		const wethTarget = toWei("90000")
		const options = { value: wethTarget }
		await wethContract.connect(signers[1]).deposit(options)
		const wethBalance = await wethContract.balanceOf(bigSignerAddress)

		expect(wethBalance).to.be.gt(wethBalanceBefore)
		expect(wethBalance).to.eq(wethTarget)
	})

	it("changes nothing if no ETH balance and hedging positive delta", async () => {
		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3RangeOrderReactor.address))
			)
		)

		expect(reactorWethBalanceBefore).to.equal(0)

		const reactorDeltaBefore = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("20"))

		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3RangeOrderReactor.address))
			)
		)
		const reactorDeltaAfter = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		expect(reactorDeltaBefore).to.equal(reactorDeltaAfter)
		expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
	})

	it("Returns proper pool prices usdc/weth", async () => {
		const ONE = (10 ** 18).toString()
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price = poolInfo.token1Price.toFixed(18)
		const usdc_weth_price = poolInfo.token0Price.toFixed(18)
		const { price, inversed } = await uniswapV3RangeOrderReactor.getPoolPrice()
		const priceDecimals = fromWei(price)
		const inversedDecimals = fromWei(inversed)
		const priceDifference = Number(usdc_weth_price) - Number(priceDecimals)
		const inversedDifference = Number(weth_usdc_price) - Number(inversedDecimals)
		expect(priceDifference).to.be.lt(10e-10)
		// some loss of precision is expected in conversion, but very little
		expect(inversedDifference).to.be.lt(10e-10)
	})

	it("Returns proper pool prices weth/usdt", async () => {
		let poolInfo = await getPoolInfo(uniswapWETHUSDTPool)
		uniswapWETHUSDTPool.token
		const weth_usdt_price = poolInfo.token0Price.toFixed(18)
		const usdt_weth_price = poolInfo.token1Price.toFixed(18)
		const tp = poolInfo.token0Price
		const { price, inversed } = await wethUsdtRangeOrderReactor.getPoolPrice()
		const priceDecimals = fromWei(price)
		const inversedDecimals = fromWei(inversed)
		const priceDifference = Number(weth_usdt_price) - Number(priceDecimals)
		const inversedDifference = Number(usdt_weth_price) - Number(inversedDecimals)
		const pricePercentageDiff = Math.abs(priceDifference) / Number(weth_usdt_price)
		const inversedPercentageDiff = Math.abs(inversedDifference) / Number(usdt_weth_price)
		expect(pricePercentageDiff).to.be.lt(0.001)
		expect(inversedPercentageDiff).to.be.lt(0.001)
	})

	it("Returns proper pool prices dai/weth", async () => {
		const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
		const uniswapV3RangeOrderReactorFactory = await ethers.getContractFactory(
			"UniswapV3RangeOrderReactor",
			{
				signer: signers[0]
			}
		)

		const daiWethV3RangeOrderReactor = (await uniswapV3RangeOrderReactorFactory.deploy(
			UNISWAP_V3_FACTORY,
			DAI,
			WETH_ADDRESS[chainId],
			liquidityPoolDummyAddress,
			POOL_FEE,
			priceFeed.address,
			authority
		)) as UniswapV3RangeOrderReactor
		const poolAddress = await daiWethV3RangeOrderReactor.pool()
		const uniswapDAIWETHPool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, signers[1])
		let poolInfo = await getPoolInfo(uniswapDAIWETHPool)
		const weth_dai_price = poolInfo.token1Price.toFixed(18)
		const dai_weth_price = poolInfo.token0Price.toFixed(18)
		const { price, inversed } = await daiWethV3RangeOrderReactor.getPoolPrice()
		const priceDecimals = fromWei(price)
		const inversedDecimals = fromWei(inversed)
		const priceDifference = Number(dai_weth_price) - Number(priceDecimals)
		const pricePercentageDiff = Math.abs(priceDifference) / Number(dai_weth_price)
		const inversedDifference = Number(weth_dai_price) - Number(inversedDecimals)
		const inversedPercentageDiff = Math.abs(inversedDifference) / Number(weth_dai_price)
		expect(pricePercentageDiff).to.be.lt(1e-10)
		// some loss of precision is expected in conversion, but very little
		expect(inversedPercentageDiff).to.be.lt(1e-10)
	})

	it("Returns proper pool prices wbtc/usdt", async () => {
		// testing a pair with neither being 18 decimals
		const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
		const uniswapV3RangeOrderReactorFactory = await ethers.getContractFactory(
			"UniswapV3RangeOrderReactor",
			{
				signer: signers[0]
			}
		)

		const wbtcUSDTV3RangeOrderReactor = (await uniswapV3RangeOrderReactorFactory.deploy(
			UNISWAP_V3_FACTORY,
			USDT_ADDRESS[chainId],
			WBTC,
			liquidityPoolDummyAddress,
			POOL_FEE,
			priceFeed.address,
			authority
		)) as UniswapV3RangeOrderReactor
		const poolAddress = await wbtcUSDTV3RangeOrderReactor.pool()
		const uniswapWBTCUSDTPool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, signers[1])
		let poolInfo = await getPoolInfo(uniswapWBTCUSDTPool)
		const wbtc_usdt_price = poolInfo.token0Price.toFixed(18)
		const usdt_wbtc_price = poolInfo.token1Price.toFixed(18)
		const { price, inversed } = await wbtcUSDTV3RangeOrderReactor.getPoolPrice()
		const priceDecimals = fromWei(price)
		const inversedDecimals = fromWei(inversed)
		const priceDifference = Number(wbtc_usdt_price) - Number(priceDecimals)
		const pricePercentageDiff = Math.abs(priceDifference) / Number(wbtc_usdt_price)
		const inversedDifference = Number(usdt_wbtc_price) - Number(inversedDecimals)
		const inversedPercentageDiff = Math.abs(inversedDifference) / Number(usdt_wbtc_price)
		expect(pricePercentageDiff).to.be.lt(1e-10)
		expect(inversedPercentageDiff).to.be.lt(1e-10)
	})

	it("Returns proper pool prices wbtc/usdc", async () => {
		// testing a pair with neither being 18 decimals
		const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
		const uniswapV3RangeOrderReactorFactory = await ethers.getContractFactory(
			"UniswapV3RangeOrderReactor",
			{
				signer: signers[0]
			}
		)

		const wbtcUSDCV3RangeOrderReactor = (await uniswapV3RangeOrderReactorFactory.deploy(
			UNISWAP_V3_FACTORY,
			USDC_ADDRESS[chainId],
			WBTC,
			liquidityPoolDummyAddress,
			POOL_FEE,
			priceFeed.address,
			authority
		)) as UniswapV3RangeOrderReactor
		const poolAddress = await wbtcUSDCV3RangeOrderReactor.pool()
		const uniswapWBTCUSDCPool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, signers[1])
		let poolInfo = await getPoolInfo(uniswapWBTCUSDCPool)
		const wbtc_usdc_price = poolInfo.token0Price.toFixed(18)
		const usdc_wbtc_price = poolInfo.token1Price.toFixed(18)
		const { price, inversed } = await wbtcUSDCV3RangeOrderReactor.getPoolPrice()
		const priceDecimals = fromWei(price)
		const inversedDecimals = fromWei(inversed)
		const priceDifference = Number(wbtc_usdc_price) - Number(priceDecimals)
		const pricePercentageDiff = Math.abs(priceDifference) / Number(wbtc_usdc_price)
		const inversedDifference = Number(usdc_wbtc_price) - Number(inversedDecimals)
		const inversedPercentageDiff = Math.abs(inversedDifference) / Number(usdc_wbtc_price)
		expect(pricePercentageDiff).to.be.lt(1e-10)
		expect(inversedPercentageDiff).to.be.lt(1e-10)
	})

	it("Enters a range to hedge a negative delta", async () => {
		const currentPosition = await uniswapV3RangeOrderReactor.currentPosition()
		expect(currentPosition.activeLowerTick).to.equal(0)
		expect(currentPosition.activeUpperTick).to.equal(0)
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("-0.5"))
		const receipt = await hedgeDeltaTx.wait()
		const [event] = getMatchingEvents(receipt, UNISWAP_POOL_MINT)
		const currentPositionAfter = await uniswapV3RangeOrderReactor.currentPosition()
		expect(currentPositionAfter.activeLowerTick).to.not.equal(0)
		expect(currentPositionAfter.activeLowerTick).to.equal(event.tickLower)
		expect(currentPositionAfter.activeUpperTick).to.equal(event.tickUpper)
		expect(event.owner).to.equal(uniswapV3RangeOrderReactor.address)
		const reactorWethBalance = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3RangeOrderReactor.address))
			)
		)

		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)

		const balancesBefore = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		expect(reactorDelta).to.equal(0)
		expect(reactorWethBalance).to.equal(0)
		expect(LpUsdcBalanceBefore).to.be.above(LpUsdcBalanceAfter)
	})

	it("Does not allow removing an unfilled negative hedge order", async () => {
		const fulfillAttempt = uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		expect(fulfillAttempt).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"RangeOrderNotFilled"
		)
	})

	it("Does not allow removing a partially filled negative hedge order", async () => {
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_before = poolInfo.token1Price.toFixed()
		// pool is usdc/weth due to uniswap v3 pool address ordering
		const amountToSwap = toWei("1000")
		await wethContract.connect(signers[1]).approve(uniswapRouter.address, amountToSwap)
		// setup swap trade params
		let params = {
			tokenIn: poolInfo.token1.address,
			tokenOut: poolInfo.token0.address,
			fee: poolInfo.fee,
			recipient: bigSignerAddress,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			amountIn: amountToSwap,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0
		}
		const swapTx = await uniswapRouter.exactInputSingle(params)
		await swapTx.wait()
		const { tick } = await uniswapUSDCWETHPool.slot0()
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		expect(tick).to.be.gt(activeLowerTick)
		expect(tick).to.be.lte(activeUpperTick)
		const fulfillAttempt = uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		expect(fulfillAttempt).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"RangeOrderNotFilled"
		)
	})

	it("Fills hedge when market moves into range", async () => {
		const balancesBefore = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_before = poolInfo.token1Price.toFixed()
		// pool is usdc/weth due to uniswap v3 pool address ordering
		const amountToSwap = toWei("10000")
		await wethContract.connect(signers[1]).approve(uniswapRouter.address, amountToSwap)
		// setup swap trade params
		let params = {
			tokenIn: poolInfo.token1.address,
			tokenOut: poolInfo.token0.address,
			fee: poolInfo.fee,
			recipient: bigSignerAddress,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			amountIn: amountToSwap,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0
		}
		const swapTx = await uniswapRouter.exactInputSingle(params)
		await swapTx.wait()
		poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_after = poolInfo.token1Price.toFixed()
		const { tick } = await uniswapUSDCWETHPool.slot0()
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		const balances = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		const reactorDelta = Number(fromWei(await liquidityPoolDummy.getDelta()))
		// delta will greater due to additional fees collected
		// but should always return at least the delta requested
		expect(reactorDelta).to.be.within(0.5, 0.502)
		expect(tick).to.be.gt(activeLowerTick)
		expect(tick).to.be.gt(activeUpperTick)
	})

	it("should pull liquidity from range order if filled", async () => {
		const wethBalanceBefore = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const newSigner = signers[2]
		const rangePoolWithNewSigner = uniswapV3RangeOrderReactor.connect(newSigner)
		const fulfilledRange = await rangePoolWithNewSigner.fulfillActiveRangeOrder()
		const receipt = await fulfilledRange.wait()
		const [burnEvent] = getMatchingEvents(receipt, UNISWAP_POOL_BURN)
		const [collectEvent] = getMatchingEvents(receipt, UNISWAP_POOL_COLLECT)
		const burnReceived = burnEvent.amount1
		// total received with fees
		const collectReceived = collectEvent.amount1
		// difference is the fees collected
		const feesCollected = collectReceived.sub(burnReceived)
		const reactorDelta = Number(fromWei(await liquidityPoolDummy.getDelta()))
		const wethBalanceAfter = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const currentPosition = await uniswapV3RangeOrderReactor.currentPosition()
		const estimatedFees = Number(collectReceived) * 0.003
		const estimatedVsActualFees = Math.abs(estimatedFees - Number(feesCollected))

		expect(burnEvent.owner).to.equal(uniswapV3RangeOrderReactor.address)
		expect(currentPosition.activeLowerTick).to.equal(0)
		expect(currentPosition.activeUpperTick).to.equal(0)
		// All weth is locked in the range order
		expect(wethBalanceBefore).to.eq(0)
		expect(wethBalanceAfter).to.eq(collectReceived)
		expect(reactorDelta).to.but.gt(0.5)
		expect(estimatedVsActualFees).to.be.lte(1)
	})

	it("Enters a range to hedge a positive delta", async () => {
		// setup: adjust oracle rate to be closer to pool rate from previous swap
		rate = "3060020000"
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			rate,
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).toString(),
			"55340232221128660932"
		)
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		const reactorWethBalanceBefore = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(toWei("0.3"))
		const receipt = await hedgeDeltaTx.wait()
		const lpBalanceAfter = await fromUSDC(await usdcContract.balanceOf(liquidityPoolDummy.address))
		const reactorDeltaAfter = Number(fromWei(await liquidityPoolDummy.getDelta()))
		const [mintEvent] = getMatchingEvents(receipt, UNISWAP_POOL_MINT) as unknown as [MintEvent]
		const reactorWethBalance = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const { activeLowerTick: lowerTickAfer, activeUpperTick: upperTickAfter } =
			await uniswapV3RangeOrderReactor.currentPosition()
		const wethDifference =
			Math.round(
				(Number(fromWei(reactorWethBalanceBefore)) - Number(fromWei(reactorWethBalance))) * 1000
			) / 1000
		expect(activeLowerTick).to.not.eq(lowerTickAfer)
		expect(activeUpperTick).to.not.eq(upperTickAfter)
		expect(mintEvent.tickLower).to.eq(lowerTickAfer)
		expect(mintEvent.tickUpper).to.eq(upperTickAfter)
		expect(wethDifference).to.eq(0.3)
	})

	it("Enters a new range to adjust a positive delta hedge", async () => {
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		const wethBalanceBefore = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(toWei("0.2"))
		const receipt = await hedgeDeltaTx.wait()
		const [burnEvent] = getMatchingEvents(receipt, UNISWAP_POOL_BURN)
		const [mintEvent] = getMatchingEvents(receipt, UNISWAP_POOL_MINT) as unknown as [MintEvent]
		const { activeLowerTick: lowerTickAfer, activeUpperTick: upperTickAfter } =
			await uniswapV3RangeOrderReactor.currentPosition()
		const wethBalanceAfter = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const wethDifference =
			Math.round((Number(fromWei(wethBalanceAfter)) - Number(fromWei(wethBalanceBefore))) * 1000) /
			1000
		// Moving from a hedge of 0.3 to 0.2 should be a 0.1 weth difference
		expect(wethDifference).to.eq(0.1)
		expect(burnEvent.tickLower).to.eq(activeLowerTick)
		expect(burnEvent.tickUpper).to.eq(activeUpperTick)
		// price did not change
		expect(activeLowerTick).to.eq(lowerTickAfer)
		expect(activeUpperTick).to.eq(upperTickAfter)
		expect(mintEvent.tickLower).to.eq(lowerTickAfer)
		expect(mintEvent.tickUpper).to.eq(upperTickAfter)
	})

	it("Reverts when trying to fulfill a range order that is partially filled", async () => {
		const reactorDelta = Number(fromWei(await liquidityPoolDummy.getDelta()))
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		// transfer usdc to reactor to test it's not removed
		await usdcContract.connect(signers[1]).transfer(uniswapV3RangeOrderReactor.address, toUSDC("100"))
		const usdcBalance = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const weth_usdc_price_before = poolInfo.token1Price.toFixed()
		const amountToSwap = toUSDC("6000000")
		await usdcContract.connect(signers[1]).approve(uniswapRouter.address, amountToSwap)
		const signerBalance = await usdcContract.balanceOf(bigSignerAddress)

		const { tick } = await uniswapUSDCWETHPool.slot0()

		let params = {
			tokenIn: poolInfo.token0.address,
			tokenOut: poolInfo.token1.address,
			fee: poolInfo.fee,
			recipient: bigSignerAddress,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			amountIn: amountToSwap,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0
		}
		const swapTx = await uniswapRouter.exactInputSingle(params)
		await swapTx.wait()
		let poolInfoAfter = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_after = poolInfoAfter.token1Price.toFixed()
		const { tick: tickAfter } = await uniswapUSDCWETHPool.slot0()
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		const balances = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		const reactorDeltaAfter = Number(fromWei(await liquidityPoolDummy.getDelta()))

		const fulfillAttempt = uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		const usdcBalanceAfter = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		expect(fulfillAttempt).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"RangeOrderNotFilled"
		)
		expect(tick).to.be.gt(activeLowerTick)
		expect(tickAfter).to.be.lt(activeUpperTick)
		expect(reactorDeltaAfter).to.be.lt(reactorDelta)
		// no collateral should be transfered when a fulfill fails
		expect(usdcBalanceAfter).to.be.eq(usdcBalance)
	})

	it("Allows for rehedging after range order is partially filled", async () => {
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(toWei("0.3"))
		const receipt = await hedgeDeltaTx.wait()
		const [collectEvent] = getMatchingEvents(receipt, UNISWAP_POOL_COLLECT)
		const [mintEvent] = getMatchingEvents(receipt, UNISWAP_POOL_MINT) as unknown as [MintEvent]
		expect(mintEvent.amount1).to.eq(toWei("0.3"))
		// should be less than previous hedge
		expect(collectEvent.amount1).to.be.lt(toWei("0.2"))
	})

	it("It fulfills when rehedge moves through range", async () => {
		const reactorDelta = Number(fromWei(await liquidityPoolDummy.getDelta()))
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_before = poolInfo.token1Price.toFixed()
		const amountToSwap = toUSDC("10000000")
		await usdcContract.connect(signers[1]).approve(uniswapRouter.address, amountToSwap)
		const signerBalance = await usdcContract.balanceOf(bigSignerAddress)

		const { tick } = await uniswapUSDCWETHPool.slot0()

		let params = {
			tokenIn: poolInfo.token0.address,
			tokenOut: poolInfo.token1.address,
			fee: poolInfo.fee,
			recipient: bigSignerAddress,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			amountIn: amountToSwap,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0
		}
		const swapTx = await uniswapRouter.exactInputSingle(params)
		await swapTx.wait()
		let poolInfoAfter = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_after = poolInfoAfter.token1Price.toFixed()
		const { tick: tickAfter } = await uniswapUSDCWETHPool.slot0()
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		const balances = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		const usdcBalanceBefore = balances.amount0Current
		const reactorDeltaAfter = Number(fromWei(await liquidityPoolDummy.getDelta()))
		const LpUsdcBalanceBefore = await usdcContract.balanceOf(liquidityPoolDummy.address)

		const fulfillAttempt = await uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		const balancesAfer = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		const usdcBalanceAfter = balancesAfer.amount0Current
		const receipt = await fulfillAttempt.wait()
		const [collectEvent] = getMatchingEvents(receipt, UNISWAP_POOL_COLLECT)
		const { activeLowerTick: activeLowerAfter, activeUpperTick: activeUpperAfter } =
			await uniswapV3RangeOrderReactor.currentPosition()
		const deltaDifference = Math.round((reactorDelta - reactorDeltaAfter) * 100) / 100
		const average = Math.sqrt(Number(weth_usdc_price_before) * Number(weth_usdc_price_after))
		// USDC amount
		const amountOut = Number(fromUSDC(collectEvent.amount0))
		const fillPrice = amountOut / 0.3
		const LpUsdcBalanceAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const lpUsdcBalanceAfterExpectation = LpUsdcBalanceBefore.add(usdcBalanceBefore)
		// Amount of delta hedged
		expect(deltaDifference).to.eq(0.3)
		expect(fillPrice).to.be.gt(average)
		expect(tickAfter).to.be.lt(activeLowerTick)
		expect(activeLowerAfter).to.be.eq(0)
		expect(activeUpperAfter).to.be.eq(0)
		// collateral should be transfered when a fulfill succeeds
		expect(usdcBalanceAfter).to.be.lt(usdcBalanceBefore)
		expect(LpUsdcBalanceAfter).to.be.eq(lpUsdcBalanceAfterExpectation)
	})

	it("withdraws partial excess USDC to liquidity pool", async () => {
		const withdrawAmount = toUSDC("1000")
		await usdcContract
			.connect(signers[1])
			.transfer(uniswapV3RangeOrderReactor.address, withdrawAmount)
		const usdcBalance = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const usdcBalanceLp = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const withdrawTx = await liquidityPoolDummy.withdraw(withdrawAmount)
		const receipt = await withdrawTx.wait()
		const usdcBalanceAfter = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const usdcBalanceLpAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(usdcBalanceAfter).to.eq(usdcBalance.sub(withdrawAmount))
		expect(usdcBalanceLpAfter).to.eq(usdcBalanceLp.add(withdrawAmount))
	})

	it("Allows the guardian to recover an erc20 token directly", async () => {
		const initAmount = toUSDC("1000")
		await usdcContract.connect(signers[1]).transfer(uniswapV3RangeOrderReactor.address, initAmount)
		const usdcBalance = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		// ensure there is a balance to recover for the test to be valid
		expect(usdcBalance).to.be.gt(0)
		const recoverTx = uniswapV3RangeOrderReactor
			.connect(signers[1])
			.recoverERC20(usdcContract.address, liquidityPoolDummy.address, usdcBalance)
		// non guardian should not be able to recover
		await expect(recoverTx).to.be.revertedWithCustomError(uniswapV3RangeOrderReactor, "UNAUTHORIZED")
		// signer 0 is the guardian
		const recoverTx2 = await uniswapV3RangeOrderReactor
			.connect(signers[0])
			.recoverERC20(usdcContract.address, liquidityPoolDummy.address, usdcBalance)
		const usdcBalanceAfter = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		expect(usdcBalanceAfter).to.eq(0)
	})

	it("Withdraw more than reactor balance should withdraw balance", async () => {
		const transferAmount = toUSDC("100000")
		const sendUSDCToReactorFromWhale = await usdcContract
			.connect(usdcWhale)
			.transfer(uniswapV3RangeOrderReactor.address, transferAmount)
		const usdcBalance = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const withdrawReturn = await liquidityPoolDummy.callStatic.withdraw(
			usdcBalance.add(transferAmount)
		)
		const withdrawTx = await liquidityPoolDummy.withdraw(usdcBalance.add(transferAmount))
		const usdcBalanceAfter = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		expect(usdcBalance).to.eq(transferAmount)
		expect(withdrawReturn).to.eq(transferAmount)
		expect(usdcBalanceAfter).to.eq(0)
	})

	it("Allows the manager to create a custom range order", async () => {
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_before = poolInfo.token1Price.toFixed()
		const { sqrtPriceX96, tick } = await uniswapUSDCWETHPool.slot0()
		const tickSpacing = await uniswapUSDCWETHPool.tickSpacing()
		const nearestTick = Math.round(tick / tickSpacing) * tickSpacing
		const lowerTick = nearestTick + tickSpacing
		// make a 10 tick range to be non-standard
		const upperTick = lowerTick + tickSpacing * 10
		//TODO use uniswap api to create order
		let rangeOrderParams: RangeOrderParamsStruct = {
			lowerTick,
			upperTick,
			sqrtPriceX96,
			meanPrice: 0,
			direction: Direction.ABOVE
		}
		await usdcContract
			.connect(signers[1])
			.transfer(uniswapV3RangeOrderReactor.address, toUSDC("1000"))
		const usdcBalance = await usdcContract.balanceOf(await signers[0].getAddress())
		const rangeOrderAmount = toUSDC("1000")
		const createRangeOrderTx = await uniswapV3RangeOrderReactor.createUniswapRangeOrder(
			rangeOrderParams,
			rangeOrderAmount
		)
		const receipt = await createRangeOrderTx.wait()
		const [mintEvent] = getMatchingEvents(receipt, UNISWAP_POOL_MINT)
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		expect(mintEvent.tickLower).to.eq(lowerTick)
		expect(mintEvent.tickUpper).to.eq(upperTick)
		expect(activeLowerTick).to.eq(lowerTick)
		expect(activeUpperTick).to.eq(upperTick)
		expect(mintEvent.amount0).to.eq(rangeOrderAmount)
	})

	it("Properly quotes pool denominated value", async () => {
		const poolValue = await uniswapV3RangeOrderReactor.getPoolDenominatedValue()
		const { amount0Current, amount1Current } =
			await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		const ethPrice = Number(
			fromWei(await priceFeed.getNormalizedRate(wethContract.address, usdcContract.address))
		)
		const usdcAmount = Number(fromUSDC(amount0Current))
		const wethAmount = Number(fromWei(amount1Current))
		const wethValue = wethAmount * ethPrice
		const computedPoolValue = wethValue + usdcAmount
		const pool_value = Number(fromWei(poolValue))
		expect(pool_value).to.be.eq(computedPoolValue)
	})

	it("Allows the manager to lock range order fulfillment", async () => {
		const isAuthorizedFulfill = await uniswapV3RangeOrderReactor.onlyAuthorizedFulfill()
		expect(isAuthorizedFulfill).to.be.false
		const setAuthorizedFulfillTx = await uniswapV3RangeOrderReactor.setAuthorizedFulfill(true)
		const isAuthorizedFulfillAfter = await uniswapV3RangeOrderReactor.onlyAuthorizedFulfill()
		expect(isAuthorizedFulfillAfter).to.be.true
	})

	it("Prevents fulfillment of range order when only authorized flag is active", async () => {
		const isAuthorizedFulfill = await uniswapV3RangeOrderReactor.onlyAuthorizedFulfill()
		expect(isAuthorizedFulfill).to.be.true
		const fulfillTx = uniswapV3RangeOrderReactor.connect(signers[1]).fulfillActiveRangeOrder()
		await expect(fulfillTx).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"UnauthorizedFulfill"
		)
	})

	it("Prevent changing the pool fee while a range order exists", async () => {
		const setPoolFeeTx = uniswapV3RangeOrderReactor.setPoolFee(10000)
		await expect(setPoolFeeTx).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"InActivePosition"
		)
	})

	it("Allows the manager to exit a range order when not fulfilled", async () => {
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		// non manager attempt should be reverted
		const rejectedExitTx = uniswapV3RangeOrderReactor.connect(signers[1]).exitActiveRangeOrder()
		await expect(rejectedExitTx).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"UNAUTHORIZED"
		)
		const exitTx = await uniswapV3RangeOrderReactor.exitActiveRangeOrder()
		const receipt = await exitTx.wait()
		const { activeLowerTick: activeLowerTickAfter, activeUpperTick: activeUpperTickAfter } =
			await uniswapV3RangeOrderReactor.currentPosition()
		const [burnEvent] = getMatchingEvents(receipt, UNISWAP_POOL_BURN)
		expect(burnEvent.tickLower).to.eq(activeLowerTick)
		expect(burnEvent.tickUpper).to.eq(activeUpperTick)
		expect(activeLowerTickAfter).to.eq(0)
		expect(activeUpperTickAfter).to.eq(0)
	})

	it("Allows the manager to change the pool fee", async () => {
		const rejectedSetPoolFeeTx = uniswapV3RangeOrderReactor.connect(signers[1]).setPoolFee(10000)
		await expect(rejectedSetPoolFeeTx).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"UNAUTHORIZED"
		)
		const setPoolFeeTx = await uniswapV3RangeOrderReactor.setPoolFee(10000)
		const receipt = await setPoolFeeTx.wait()
		const poolFee = await uniswapV3RangeOrderReactor.poolFee()
		expect(poolFee).to.eq(10000)
	})

	// Uniswap Conversions Testing
	it("Converts a usdc/weth (6/18 decimals) to sqrtPriceX96 and back - Uniswap Conversions", async () => {
		const usdcWethPrice = "304794466082623"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(usdcWethPrice, 6)
		const convertBack = await uniswapConversions.sqrtToPrice(sqrtPriceX96, 6)
		const poolSquareRootPrice = BigNumber.from("1383194083266513227538809339896527")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		const conversionDiff = Math.abs(Number(fromWei(convertBack)) - Number(fromWei(usdcWethPrice)))
		const conversionPercentDiff = conversionDiff / Number(fromWei(usdcWethPrice))
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
		expect(conversionPercentDiff).to.be.lt(1e-6)
	})

	it("Converts a weth/usdt (18/6 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const wethUsdtPrice = "3278775459"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(wethUsdtPrice, 18)
		const convertBack = await uniswapConversions.sqrtToPrice(sqrtPriceX96, 18)
		const poolSquareRootPrice = BigNumber.from("4536651532748345691924484")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		const conversionDiff = Math.abs(Number(fromWei(convertBack)) - Number(fromWei(wethUsdtPrice)))
		const conversionPercentDiff = conversionDiff / Number(fromWei(wethUsdtPrice))
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
		expect(conversionPercentDiff).to.be.lt(1e-6)
	})

	it("Converts a DAI/WETH (18/18 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const daiWethPrice = "304873053351706"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(daiWethPrice, 18)
		const convertBack = await uniswapConversions.sqrtToPrice(sqrtPriceX96, 18)
		const poolSquareRootPrice = BigNumber.from("1383372391030930353024001313")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		const conversionDiff = Math.abs(Number(fromWei(convertBack)) - Number(fromWei(daiWethPrice)))
		const conversionPercentDiff = conversionDiff / Number(fromWei(daiWethPrice))
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
		expect(conversionPercentDiff).to.be.lt(1e-6)
	})

	it("Converts a WBTC/USDT (8/6 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const wbtcUsdcPrice = "45149740258"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(wbtcUsdcPrice, 8)
		const convertBack = await uniswapConversions.sqrtToPrice(sqrtPriceX96, 8)
		const poolSquareRootPrice = BigNumber.from("1683477094974729778595779250705")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		const conversionDiff = Math.abs(Number(fromWei(convertBack)) - Number(fromWei(wbtcUsdcPrice)))
		const conversionPercentDiff = conversionDiff / Number(fromWei(wbtcUsdcPrice))
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
		expect(conversionPercentDiff).to.be.lt(1e-6)
	})

	it("Converts a WBTC/USDC (8/6 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const wbtcUsdcPrice = "45165453874"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(wbtcUsdcPrice, 8)
		const convertBack = await uniswapConversions.sqrtToPrice(sqrtPriceX96, 8)
		const poolSquareRootPrice = BigNumber.from("1683770022578357087060958331921")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		const conversionDiff = Math.abs(Number(fromWei(convertBack)) - Number(fromWei(wbtcUsdcPrice)))
		const conversionPercentDiff = conversionDiff / Number(fromWei(wbtcUsdcPrice))
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
		expect(conversionPercentDiff).to.be.lt(1e-6)
	})

	it("Properly gets price to use when inversed and direction is above - Uniswap Conversions", async () => {
		const price0 = BigNumber.from("1000000000000000000")
		const price1 = price0.add(100)
		const priceToUse = await uniswapConversions.mockPriceToUse(price0, price1, true, Direction.ABOVE)
		expect(priceToUse).to.eq(price0)
	})

	it("Properly gets price to use when inversed and direction is below - Uniswap Conversions", async () => {
		const price0 = BigNumber.from("1000000000000000000")
		const price1 = price0.add(100)
		const priceToUse = await uniswapConversions.mockPriceToUse(price0, price1, true, Direction.BELOW)
		expect(priceToUse).to.eq(price1)
	})

	it("Properly gets price to use when not inversed and direction is above - Uniswap Conversions", async () => {
		const price0 = BigNumber.from("1000000000000000000")
		const price1 = price0.add(100)
		const priceToUse = await uniswapConversions.mockPriceToUse(price0, price1, false, Direction.ABOVE)
		expect(priceToUse).to.eq(price1)
	})

	it("Properly gets price to use when not inversed and direction is below - Uniswap Conversions", async () => {
		const price0 = BigNumber.from("1000000000000000000")
		const price1 = price0.add(100)
		const priceToUse = await uniswapConversions.mockPriceToUse(price0, price1, false, Direction.BELOW)
		expect(priceToUse).to.eq(price0)
	})

	it("Properly converts tick to token price USDC/WETH (inversed) - Uniswap Conversions", async () => {
		const tick = "195361"
		// weth/usdc in usdc decimals which is the cost of 1 weth in usdc
		const expectedPrice = "3280981373"
		const price = await uniswapConversions.mockTickToTokenPrice(tick, 6, true)
		const normalizedExpected = utils.formatUnits(expectedPrice, 6)
		const normalizedPrice = utils.formatUnits(price, 6)
		const difference = Math.abs(Number(normalizedExpected) - Number(normalizedPrice))
		const percentDiff = difference / Number(normalizedExpected)
		expect(percentDiff).to.be.lt(0.0001)
		expect(expectedPrice.length).to.eq(price.toString().length)
	})

	it("Properly converts tick to token price WETH/USDT (not inversed) - Uniswap Conversions", async () => {
		const tick = "-195368"
		const expectedPrice = "3278685604"
		const price = await uniswapConversions.mockTickToTokenPrice(tick, 18, false)
		const normalizedExpected = fromWei(expectedPrice)
		const normalizedPrice = fromWei(price)
		const difference = Math.abs(Number(normalizedExpected) - Number(normalizedPrice))
		const percentDiff = difference / Number(normalizedExpected)
		expect(percentDiff).to.be.lt(0.0001)
		expect(expectedPrice.length).to.eq(price.toString().length)
	})

	it("Properly converts tick to token price DAI/WETH (inversed) - Uniswap Conversions", async () => {
		const tick = "-80961"
		const expectedPrice = "3280316602869370632259"
		const price = await uniswapConversions.mockTickToTokenPrice(tick, 18, true)
		const normalizedExpected = utils.formatUnits(expectedPrice, 18)
		const normalizedPrice = utils.formatUnits(price, 18)
		const difference = Math.abs(Number(normalizedExpected) - Number(normalizedPrice))
		const percentDiff = difference / Number(normalizedExpected)
		expect(percentDiff).to.be.lt(0.0001)
		expect(expectedPrice.length).to.eq(price.toString().length)
	})

	it("Properly converts tick to token price WBTC/USDT (not inversed) - Uniswap Conversions", async () => {
		const tick = "61132"
		const expectedPrice = "45164404583"
		const price = await uniswapConversions.mockTickToTokenPrice(tick, 8, false)
		const normalizedExpected = utils.formatUnits(expectedPrice, 6)
		const normalizedPrice = utils.formatUnits(price, 6)
		const difference = Math.abs(Number(normalizedExpected) - Number(normalizedPrice))
		const percentDiff = difference / Number(normalizedExpected)
		expect(percentDiff).to.be.lt(0.0001)
		expect(expectedPrice.length).to.eq(price.toString().length)
	})

	it("Properly converts tick to token price USDC/WBTC (inversed)- Uniswap Conversions", async () => {
		const tick = "61132"
		const expectedPrice = "2214133030719511"
		const price = await uniswapConversions.mockTickToTokenPrice(tick, 8, true)
		const normalizedExpected = utils.formatUnits(expectedPrice, 8)
		const normalizedPrice = utils.formatUnits(price, 8)
		const difference = Math.abs(Number(normalizedExpected) - Number(normalizedPrice))
		const percentDiff = difference / Number(normalizedExpected)
		expect(percentDiff).to.be.lt(0.0001)
		expect(expectedPrice.length).to.eq(price.toString().length)
	})

	it("Converts max sqrtPrice to uint without overflow - Uniswap Conversions", async () => {
		const maxSqrtPrice = "1461446703485210103287273052203988822378723970342"
		const maxSQRTPriceUint = "340256786836388094070642339899681172748067254072799124246"
		const maxSqrtPriceUint = await uniswapConversions.sqrtToPrice(maxSqrtPrice, "18")
		expect(maxSqrtPriceUint).to.eq(maxSQRTPriceUint)
	})

	it("Convert price to sqrtPriceX96 - Uniswap Conversions", async () => {
		const weiPrice = "1603355000000000000000" // 1,603,355 tokens of A per token of B
		const inversed = false
		const token0Decimals = 18

		const sqrtPriceX96 = await uniswapConversions.priceToSqrt(weiPrice, inversed, token0Decimals)
	})
})

const arbitrumChainId = 42161
let arbitrumRyskDHVAddress: string = "0xC10B976C671Ce9bFf0723611F01422ACbAe100A5"
const deployerAddress: string = "0xFBdE2e477Ed031f54ed5Ad52f35eE43CD82cF2A6" // governor multisig address
const funderAddress = "0xf89d7b9c864f589bbF53a82105107622B35EaA40"
const liquidityPoolAddress: string = addresses.liquidityPool
let liquidityPool: LiquidityPool
let deployer: Signer
let funder: Signer
describe("UniswapV3RangeOrderReactor Arbitrum Integration Tests", () => {
	before(async function () {
		await network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						jsonRpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY}`,
						blockNumber: 127117974,
						chainId: arbitrumChainId
					}
				}
			]
		})
	})

	it("Obtains Rysk contracts - Arbitrum", async () => {
		signers = await ethers.getSigners()
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [deployerAddress]
		})
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [funderAddress]
		})
		deployer = await ethers.getSigner(deployerAddress)
		funder = await ethers.getSigner(funderAddress)
		await funder.sendTransaction({ to: deployerAddress, value: utils.parseEther("100") })
		liquidityPool = (await ethers.getContractAt(
			"LiquidityPool",
			liquidityPoolAddress,
			deployer
		)) as LiquidityPool

		expect(liquidityPool).to.have.property("setHedgingReactorAddress")
		expect(liquidityPool).to.have.property("rebalancePortfolioDelta")

		wethContract = (await ethers.getContractAt(
			"contracts/tokens/WETH.sol:WETH",
			WETH_ADDRESS[arbitrumChainId]
		)) as WETH
		const provider = ethers.provider
		bigSignerAddress = await signers[1].getAddress()
		// 100,000 * 1e18
		const ONE_HUNDRED_THOUSAND_HEX = "0x152D02C7E14AF6800000"
		await hre.network.provider.request({
			method: "hardhat_setBalance",
			params: [bigSignerAddress, ONE_HUNDRED_THOUSAND_HEX]
		})
		const signer1BalanceAfter = await provider.getBalance(await signers[1].getAddress())
		expect(signer1BalanceAfter).to.equal(ONE_HUNDRED_THOUSAND_HEX)

		usdcContract = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDC_ADDRESS[arbitrumChainId]
		)) as MintableERC20
		const balance = await usdcContract.balanceOf(funderAddress)
	})

	it("deploys the UniswapV3RangeOrderReactor contract - Arbitrum", async () => {
		const uniswapV3RangeOrderReactorFactory = await ethers.getContractFactory(
			"UniswapV3RangeOrderReactor",
			{
				signer: signers[0]
			}
		)

		const authority = await liquidityPool.authority()
		const POOL_FEE = 500
		uniswapV3RangeOrderReactor = (await uniswapV3RangeOrderReactorFactory.deploy(
			UNISWAP_V3_FACTORY,
			USDC_ADDRESS[arbitrumChainId],
			WETH_ADDRESS[arbitrumChainId],
			liquidityPoolAddress,
			POOL_FEE,
			addresses.priceFeed,
			authority
		)) as UniswapV3RangeOrderReactor
		expect(uniswapV3RangeOrderReactor).to.have.property("hedgeDelta")
		let token0 = await uniswapV3RangeOrderReactor.token0()
	})

	it("adds the UniswapV3RangeOrderReactor contract to the LiquidityPool contract - Arbitrum", async () => {
		const tx = await liquidityPool.setHedgingReactorAddress(uniswapV3RangeOrderReactor.address)
		const receipt = await tx.wait()
		expect(receipt.status).to.eq(1)
		expect(await liquidityPool.hedgingReactors(3)).to.eq(uniswapV3RangeOrderReactor.address)
	})

	it("Enters a range to hedge a negative delta - Arbitrum", async () => {
		const currentPosition = await uniswapV3RangeOrderReactor.currentPosition()
		expect(currentPosition.activeLowerTick).to.eq(0)
		expect(currentPosition.activeUpperTick).to.eq(0)
		const deltaAmount = toWei("-0.1")
		const hedgeDeltaTx = await liquidityPool.rebalancePortfolioDelta(deltaAmount, 3)
		const hedgeDeltaReceipt = await hedgeDeltaTx.wait()
		const [event] = getMatchingEvents(hedgeDeltaReceipt, UNISWAP_POOL_MINT)
		const currentPositionAfter = await uniswapV3RangeOrderReactor.currentPosition()
		expect(currentPositionAfter.activeLowerTick).to.not.eq(0)
		expect(currentPositionAfter.activeLowerTick).to.equal(event.tickLower)
		expect(currentPositionAfter.activeUpperTick).to.equal(event.tickUpper)
	})

	it("Does not allow removing an unfilled negative hedge order", async () => {
		const fulfillAttempt = uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		expect(fulfillAttempt).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"RangeOrderNotFilled"
		)
	})

	it("Does not allow removing a partially filled negative hedge order - Arbitrum", async () => {
		const poolAddress = await uniswapV3RangeOrderReactor.pool()
		uniswapUSDCWETHPool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, funder)
		uniswapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, ISwapRouterABI, funder)

		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const amountToSwap = toWei("50")
		await wethContract.connect(funder).deposit({ value: amountToSwap })
		await wethContract.connect(funder).approve(uniswapRouter.address, amountToSwap)
		// setup swap trade params
		let params = {
			tokenIn: poolInfo.token0.address,
			tokenOut: poolInfo.token1.address,
			fee: poolInfo.fee,
			recipient: funderAddress,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			amountIn: amountToSwap,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0
		}
		const swapTx = await uniswapRouter.exactInputSingle(params)
		const { tick } = await uniswapUSDCWETHPool.slot0()
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		expect(tick).to.be.gt(activeLowerTick)
		expect(tick).to.be.lte(activeUpperTick)
		const fulfillAttempt = uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		expect(fulfillAttempt).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"RangeOrderNotFilled"
		)
	})

	it("Removes a filled negative hedge order when market moves into range- Arbitrum", async () => {
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const amountToSwap = toWei("900")
		await wethContract.connect(funder).deposit({ value: amountToSwap })
		await wethContract.connect(funder).approve(uniswapRouter.address, amountToSwap)
		// setup swap trade params
		let params = {
			tokenIn: poolInfo.token0.address,
			tokenOut: poolInfo.token1.address,
			fee: poolInfo.fee,
			recipient: funderAddress,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			amountIn: amountToSwap,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0
		}
		const swapTx = await uniswapRouter.exactInputSingle(params)
		const { tick } = await uniswapUSDCWETHPool.slot0()
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		expect(tick).to.be.lt(activeLowerTick)
		expect(tick).to.be.lt(activeUpperTick)
		const fullfilledRange = await uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		const fullfilledRangeReceipt = await fullfilledRange.wait()
		const [burnEvent] = getMatchingEvents(fullfilledRangeReceipt, UNISWAP_POOL_BURN)
		const [collectEvent] = getMatchingEvents(fullfilledRangeReceipt, UNISWAP_POOL_COLLECT)
		const burnReceived = burnEvent.amount0
		const collectReceived = collectEvent.amount0
		const feesCollected = collectReceived.sub(burnReceived)
		const estimatedFees = Number(collectReceived) * 0.0005
		const estimatedVsActualFees = Math.abs(estimatedFees - Number(feesCollected))
		expect(estimatedVsActualFees).to.be.lte(1)

		const currentPositionAfter = await uniswapV3RangeOrderReactor.currentPosition()
		expect(currentPositionAfter.activeLowerTick).to.eq(0)
		expect(currentPositionAfter.activeUpperTick).to.eq(0)
		let reactorDelta = Number(fromWei(await uniswapV3RangeOrderReactor.getDelta()))
		expect(reactorDelta).to.be.within(0.09, 0.11)
	})

	it("Enters a range to hedge a positive delta - sell underlying - Arbitrum", async () => {
		const priceFeedAddress = await uniswapV3RangeOrderReactor.priceFeed()
		// swap back to push price above chainlink price
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const amountToSwap = toUSDC("2000000")
		await usdcContract.connect(funder).approve(uniswapRouter.address, amountToSwap)
		let params = {
			tokenIn: poolInfo.token1.address,
			tokenOut: poolInfo.token0.address,
			fee: poolInfo.fee,
			recipient: funderAddress,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			amountIn: amountToSwap,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0
		}
		const swapPriceMoveTx = await uniswapRouter.exactInputSingle(params)

		// ensure no current reactor position
		const currentPosition = await uniswapV3RangeOrderReactor.currentPosition()
		expect(currentPosition.activeLowerTick).to.equal(0)
		expect(currentPosition.activeUpperTick).to.equal(0)
		// enter range below
		const reactorWethBalanceBefore = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const deltaAmount = toWei("0.05")
		const hedgeDeltaTx = await liquidityPool.rebalancePortfolioDelta(deltaAmount, 3)
		const receipt = await hedgeDeltaTx.wait()
		const [mintEvent] = getMatchingEvents(receipt, UNISWAP_POOL_MINT) as unknown as [MintEvent]
		const reactorWethBalance = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		const wethDifference =
			Math.round(
				(Number(fromWei(reactorWethBalanceBefore)) - Number(fromWei(reactorWethBalance))) * 1000
			) / 1000
		expect(activeLowerTick).to.not.eq(currentPosition.activeLowerTick)
		expect(activeUpperTick).to.not.eq(currentPosition.activeUpperTick)
		expect(mintEvent.tickLower).to.eq(activeLowerTick)
		expect(mintEvent.tickUpper).to.eq(activeUpperTick)
		expect(wethDifference).to.eq(0.05)
	})

	it("Enters a new range to adjust a positive delta hedge - arbitrum", async () => {
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		const wethBalanceBefore = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const deltaAmount = toWei("0.1")
		const hedgeDeltaTx = await liquidityPool.rebalancePortfolioDelta(deltaAmount, 3)
		const receipt = await hedgeDeltaTx.wait()
		const [burnEvent] = getMatchingEvents(receipt, UNISWAP_POOL_BURN)
		const [mintEvent] = getMatchingEvents(receipt, UNISWAP_POOL_MINT) as unknown as [MintEvent]
		const { activeLowerTick: lowerTickAfer, activeUpperTick: upperTickAfter } =
			await uniswapV3RangeOrderReactor.currentPosition()
		const wethBalanceAfter = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const wethDifference =
			Math.round((Number(fromWei(wethBalanceAfter)) - Number(fromWei(wethBalanceBefore))) * 1000) /
			1000
		expect(wethDifference).to.eq(-0.05)
		expect(burnEvent.tickLower).to.eq(activeLowerTick)
		expect(burnEvent.tickUpper).to.eq(activeUpperTick)
		// price did not change
		expect(activeLowerTick).to.eq(lowerTickAfer)
		expect(activeUpperTick).to.eq(upperTickAfter)
		expect(mintEvent.tickLower).to.eq(lowerTickAfer)
		expect(mintEvent.tickUpper).to.eq(upperTickAfter)
	})

	// setting up for next series of tests using latest addresses at block height
	const governorAddress = "0xFBdE2e477Ed031f54ed5Ad52f35eE43CD82cF2A6"
	const keeperAddress = "0xC249e74480aEd4F9219b0617Ae09DCeb748571F7"
	const authorityAddress = "0x74948DAf8Beb3d14ddca66d205bE3bc58Df39aC9"
	const nativeUSDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
	const nativeUSDCWhaleAddress = "0x3dd1d15b3c78d6acfd75a254e857cbe5b9ff0af2"
	let governor: Signer
	let keeper: Signer
	let nativeUSDCWhale: Signer
	it("Allows keeper via Manager contract to exit range order before being filled - Arbitrum", async () => {
		let authorityContract = (await ethers.getContractAt(
			"Authority",
			authorityAddress,
			deployer
		)) as Authority

		// deploy new manager contract using same params as current manager at block height
		const managerFactory = await ethers.getContractFactory("Manager")
		manager = (await managerFactory.deploy(
			authorityAddress,
			"0x217749d9017cb87712654422a1f5856aaa147b80",
			"0xc63717c4436043781a63c8c64b02ff774350e8f8",
			"0x44227dc2a1d71fc07dc254dfd42b1c44aff12168",
			"0xc117bf3103bd09552f9a721f0b8bce9843aae1fa",
			"0xea5fb118862876f249ff0b3e7fb25feb38158def"
		)) as Manager

		// impersonate governor
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [governorAddress]
		})
		governor = await ethers.getSigner(governorAddress)
		authorityContract.connect(governor)
		manager = manager.connect(governor)
		await manager.setKeeper(keeperAddress, true)
		const managerPushTx = await authorityContract.pushManager(manager.address)
		const managerPushReceipt = await managerPushTx.wait()
		const newManager = await authorityContract.newManager()
		expect(newManager).to.eq(manager.address)
		// impersonate manager
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [manager.address]
		})
		const managerSigner = await ethers.getSigner(manager.address)
		const ONE_HUNDRED_THOUSAND_HEX = "0x152D02C7E14AF6800000"
		await hre.network.provider.request({
			method: "hardhat_setBalance",
			params: [manager.address, ONE_HUNDRED_THOUSAND_HEX]
		})
		authorityContract = authorityContract.connect(managerSigner)
		const pullManagerTx = await authorityContract.pullManager()
		const pullManagerReceipt = await pullManagerTx.wait()
		const authorityManager = await authorityContract.manager()
		expect(authorityManager).to.eq(manager.address)

		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [keeperAddress]
		})
		keeper = await ethers.getSigner(keeperAddress)
		// use latest reactor as of block number
		uniswapV3RangeOrderReactor = (await ethers.getContractAt(
			"UniswapV3RangeOrderReactor",
			"0x5250F9ab6a6a7CB447dc96cb218cE9E796905852",
			deployer
		)) as UniswapV3RangeOrderReactor

		let { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		// should already be in active range position
		expect(activeLowerTick).to.not.eq(activeUpperTick)
		// fulfill should fail
		const fullExitAttempt = uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		expect(fullExitAttempt).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"RangeOrderNotFilled"
		)

		manager = manager.connect(keeper)
		const deltaLimitBefore = await manager.deltaLimit(keeperAddress)
		await manager.exitActiveRangeOrder(3)
		const deltaLimitAfter = await manager.deltaLimit(keeperAddress)
		let currentPosition = await uniswapV3RangeOrderReactor.currentPosition()
		expect(currentPosition.activeLowerTick).to.eq(0)
		expect(currentPosition.activeUpperTick).to.eq(0)
		// Delta limit should be untouched
		expect(deltaLimitBefore).to.eq(deltaLimitAfter)
	})

	it("Allows a keeper via Manager contract to exit paritally filled range order and reclaim delta - Arbitrum", async () => {
		// give delta allowance to keeper
		manager = manager.connect(governor)
		const deltaLimitBefore = await manager.deltaLimit(keeperAddress)
		const deltaLimitAmount = toWei("50")
		await manager.setDeltaLimit([deltaLimitAmount], [keeperAddress])
		const deltaLimitAfterDeltaGrant = await manager.deltaLimit(keeperAddress)
		expect(deltaLimitBefore).to.eq(deltaLimitAfterDeltaGrant.sub(deltaLimitAmount))
		// impersonate keeper
		manager = manager.connect(keeper)
		// enter a new range order
		const deltaAmount = toWei("1")
		const hedgeDeltaTx = await manager.rebalancePortfolioDelta(deltaAmount, 3)
		const receipt = await hedgeDeltaTx.wait()
		const [mintEvent] = getMatchingEvents(receipt, UNISWAP_POOL_MINT) as unknown as [MintEvent]
		const { activeLowerTick, activeUpperTick } = await uniswapV3RangeOrderReactor.currentPosition()
		const parentPoolAddress = await uniswapV3RangeOrderReactor.pool()
		uniswapUSDCWETHPool = uniswapUSDCWETHPool.attach(parentPoolAddress)
		expect(activeLowerTick).to.not.eq(activeUpperTick)
		expect(mintEvent.tickLower).to.eq(activeLowerTick)
		expect(mintEvent.tickUpper).to.eq(activeUpperTick)
		// move parent pool price in to partial fill of range
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const amountToSwap = toUSDC("100000")
		// needs to be swaping usdc for weth
		usdcContract = usdcContract.attach(nativeUSDC)
		// impersonate whale
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [nativeUSDCWhaleAddress]
		})
		nativeUSDCWhale = await ethers.getSigner(nativeUSDCWhaleAddress)
		await usdcContract.connect(nativeUSDCWhale).approve(uniswapRouter.address, amountToSwap)
		uniswapRouter = uniswapRouter.connect(nativeUSDCWhale)
		// setup swap trade params
		let params = {
			tokenIn: poolInfo.token1.address, // USDC
			tokenOut: poolInfo.token0.address, // WETH
			fee: poolInfo.fee,
			recipient: nativeUSDCWhaleAddress,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10,
			amountIn: amountToSwap,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0
		}

		const swapTx = await uniswapRouter.exactInputSingle(params, { gasLimit: 5000000 })
		const receiptSwap = await swapTx.wait()
		const { tick } = await uniswapUSDCWETHPool.slot0()
		expect(tick).to.be.gt(activeLowerTick)
		expect(tick).to.be.lte(activeUpperTick)
		const deltaLimitAfterSwap = await manager.deltaLimit(keeperAddress)
		const deltaUsed = deltaLimitAfterDeltaGrant.sub(deltaLimitAfterSwap)
		// calculate percentage of delta reclaimed based on current tick and tick range
		const tickRange = activeUpperTick - activeLowerTick
		const tickDifference = tick - activeLowerTick
		const percentageOfRange = tickDifference / tickRange
		// deltaUsed multiply by percentage of range
		let deltaReclaimed = Number(fromWei(deltaUsed)) * percentageOfRange
		let deltaReclaimedBigNum = toWei(deltaReclaimed.toString()).toString()
		const exitRangeTx = await manager.exitActiveRangeOrder(3)
		const deltaLimitAfterExit = await manager.deltaLimit(keeperAddress)
		const expectedAfterExitDeltaLimit = deltaLimitAfterSwap.add(deltaReclaimedBigNum)
		const receiptExit = await exitRangeTx.wait()
		expect(deltaLimitAfterExit).to.eq(expectedAfterExitDeltaLimit)
	})
})
