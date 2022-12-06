import hre, { ethers, network, Contract } from "hardhat"
import { Signer, BigNumber } from "ethers"
import { expect } from "chai"
import { MintableERC20 } from "../types/MintableERC20"
import { UniswapV3HedgingReactor } from "../types/UniswapV3HedgingReactor"
import { UniswapV3RangeOrderReactor } from "../types/UniswapV3RangeOrderReactor"
import { UniswapV3HedgingTest } from "../types/UniswapV3HedgingTest"
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER } from "./constants"
import { PriceFeed } from "../types/PriceFeed"
import { MintEvent } from "../types/IUniswapV3PoolEvents"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import { abi as ISwapRouterABI } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json"
import { quoterContract, tickToPrice, getPoolInfo } from "../utils/uniswap"
import { Route, Trade } from "@uniswap/v3-sdk"
import { CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core"
import { fromUSDC, fromWei, toUSDC, toWei } from "../utils/conversion-helper"
import {
	getMatchingEvents,
	UNISWAP_POOL_MINT,
	UNISWAP_POOL_BURN,
	UNISWAP_POOL_COLLECT
} from "../utils/events"
import { WETH } from "../types/WETH"
let signers: Signer[]
let usdcWhale: Signer
let usdcWhaleAddress: string
let liquidityPoolDummy: UniswapV3HedgingTest
let liquidityPoolDummyAddress: string
let uniswapV3RangeOrderReactor: UniswapV3RangeOrderReactor
let usdcContract: MintableERC20
let wethContract: WETH
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
let uniswapUSDCWETHPool: Contract
let uniswapRouter: Contract
let bigSignerAddress: string
let authority: string
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
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
	it("deploys the dummy LP contract", async () => {
		signers = await ethers.getSigners()
		const liquidityPoolDummyFactory = await ethers.getContractFactory("UniswapV3HedgingTest")
		liquidityPoolDummy = (await liquidityPoolDummyFactory.deploy()) as UniswapV3HedgingTest
		liquidityPoolDummyAddress = liquidityPoolDummy.address

		expect(liquidityPoolDummy).to.have.property("setHedgingReactorAddress")
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

	it("Should deploy price feed", async () => {
		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)
		const authorityFactory = await hre.ethers.getContractFactory("Authority")
		const senderAddress = await signers[0].getAddress()
		authority = (await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)).address
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy(authority)) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, USDC_ADDRESS[chainId], ethUSDAggregator.address)
		await priceFeed.addPriceFeed(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			ethUSDAggregator.address
		)
		const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, USDC_ADDRESS[chainId])
		expect(feedAddress).to.eq(ethUSDAggregator.address)
		rate = "3455720000"
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
			"0x1F98431c8aD98523631AE4a59f267346ea31F984", // v3 factory address
			USDC_ADDRESS[chainId],
			WETH_ADDRESS[chainId],
			liquidityPoolDummyAddress,
			3000,
			priceFeed.address,
			authority
		)) as UniswapV3RangeOrderReactor
		expect(uniswapV3RangeOrderReactor).to.have.property("hedgeDelta")
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
		const fullfillAttempt = uniswapV3RangeOrderReactor.fullfillActiveRangeOrder()
		expect(fullfillAttempt).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"RangeOrderNotFilled"
		)
	})

	it("Does not allow removing a partially filled negative hedge order", async () => {
		liquidityPoolDummy
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
		const fullfillAttempt = uniswapV3RangeOrderReactor.fullfillActiveRangeOrder()
		expect(fullfillAttempt).to.be.revertedWithCustomError(
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
		const fullfilledRange = await rangePoolWithNewSigner.fullfillActiveRangeOrder()
		const receipt = await fullfilledRange.wait()
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
		console.log({ mintEvent })
		expect(activeLowerTick).to.not.eq(lowerTickAfer)
		expect(activeUpperTick).to.not.eq(upperTickAfter)
		expect(mintEvent.tickLower).to.eq(lowerTickAfer)
		expect(mintEvent.tickUpper).to.eq(upperTickAfter)
		expect(wethDifference).to.eq(0.3)
	})

	// adjusts a range order to hedge a new delta
	////////// Legacy Testing Starts Here //////////

	/* 	it("Sets a range one tick above USDC/WETH market", async () => {
		const ticks = await uniswapV3RangeOrderReactor.getTicks()
		const price = tickToPrice(ticks.tick, 6, 18)
		const normalizedPrice = price / 10 ** 18
		const latestPrice = await priceFeed.getRate(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId])
		const chainPrice = tickToPrice(205343, 6, 8)
		const amountToDeploy = toUSDC("100000")
		await usdcContract.connect(usdcWhale).transfer(uniswapV3RangeOrderReactor.address, amountToDeploy)
		// cache pool balances before enter range order
		const poolWethBalance = await wethContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const poolUsdcBalance = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		await uniswapV3RangeOrderReactor.createUniswapRangeOrderOneTickAboveMarket(amountToDeploy)
		const activeUpperTick = await uniswapV3RangeOrderReactor.activeUpperTick()
		const activeLowerTick = await uniswapV3RangeOrderReactor.activeLowerTick()
		expect(activeUpperTick).to.be.gt(ticks.tick)
		expect(activeLowerTick).to.be.gt(ticks.tick)
		expect(activeUpperTick).to.be.gt(activeLowerTick)

		//checks balances
		const balances = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		const difference = poolUsdcBalance.sub(balances.amount0Current)
		expect(difference).to.be.lte("1")
		expect(uniswapV3RangeOrderReactor).to.have.property("hedgeDelta")
	})

	it("Fills when price moves into range", async () => {
		const balancesBefore = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		let poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_before = poolInfo.token1Price.toFixed()
		// pool is usdc/weth due to uniswap v3 pool address ordering
		const amountToSwap = toWei("10000")
		await wethContract.connect(signers[1]).approve(uniswapRouter.address, amountToSwap)

		// generate price quote
		const quoter = quoterContract(signers[1])
		const quotedAmountOut = await quoter.callStatic.quoteExactInputSingle(
			poolInfo.token1.address,
			poolInfo.token0.address,
			poolInfo.fee,
			amountToSwap.toString(),
			0
		)
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
		const balanceBefore = await wethContract.balanceOf(bigSignerAddress)
		const swapTx = await uniswapRouter.exactInputSingle(params)
		await swapTx.wait(1)
		poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const balanceAfter = await wethContract.balanceOf(bigSignerAddress)
		const weth_usdc_price_after = poolInfo.token1Price.toFixed()
		const { tick } = await uniswapUSDCWETHPool.slot0()
		const activeUpperTick = await uniswapV3RangeOrderReactor.activeUpperTick()
		const activeLowerTick = await uniswapV3RangeOrderReactor.activeLowerTick()
		console.log({ weth_usdc_price_after, weth_usdc_price_before })

		// buy weth in usdc/weth pool means price went up into the limit order range
		expect(tick).to.be.gt(activeLowerTick)
		expect(tick).to.be.gt(activeUpperTick)
		const balances = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		const averagePricePaid =
			Number(fromUSDC(balancesBefore.amount0Current)) / Number(fromWei(balances.amount1Current))
		expect(averagePricePaid).to.lt(Number(weth_usdc_price_before))
	})

	it("should properly get current price from the pool", async () => {
		const poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const prices = await uniswapV3RangeOrderReactor.getPoolPrice()
		const weth_usdc_price = poolInfo.token1Price.toFixed()
		const usdc_weth_price = poolInfo.token0Price.toFixed(9)
		const chainlinkPrice = await priceFeed.getNormalizedRate(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId]
		)
		const usdcDifference = Number(fromWei(prices.price)) - Number(usdc_weth_price)
		const wethDifference = Number(fromWei(prices.inversed)) - Number(weth_usdc_price)
		expect(usdcDifference).to.be.lt(0.0001)
		expect(wethDifference).to.be.lt(1)
	})

	it("hedges delta", async () => {
		console.log("hedge delta", toWei("-2").toString())
		const res = await uniswapV3RangeOrderReactor.hedgeDelta(toWei("-2"))
	})

	it("yanks pool liquidity", async () => {
		//await uniswapV3RangeOrderReactor.yankRangeOrderLiquidity()
		const poolInfo = await getPoolInfo(uniswapUSDCWETHPool)
		const weth_usdc_price_after = poolInfo.token1Price.toFixed()
		const usdc_weth_price = Number(poolInfo.token0Price.toFixed(18))
		const reversed_price = 1 / usdc_weth_price
		const price = await uniswapV3RangeOrderReactor.getPoolPrice()
		console.log({ price, weth_usdc_price_after, usdc_weth_price, reversed_price })
	}) */
	/* 	it("updates minAmount parameter", async () => {
		await uniswapV3HedgingReactor.setMinAmount(1e10)
		const minAmount = await uniswapV3HedgingReactor.minAmount()
		expect(minAmount).to.equal(ethers.utils.parseUnits("1", 10))
	}) */
})
