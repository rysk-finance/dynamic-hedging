import hre, { ethers, network, Contract } from "hardhat"
import { Signer, BigNumber } from "ethers"
import { expect } from "chai"
import { MintableERC20 } from "../types/MintableERC20"
import { UniswapV3HedgingReactor } from "../types/UniswapV3HedgingReactor"
import { UniswapV3RangeOrderReactor } from "../types/UniswapV3RangeOrderReactor"
import { UniswapV3HedgingTest } from "../types/UniswapV3HedgingTest"
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER } from "./constants"
import { PriceFeed } from "../types/PriceFeed"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import { abi as ISwapRouterABI } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json"
import { quoterContract, tickToPrice, getPoolInfo } from "../utils/uniswap"
import { Route, Trade } from "@uniswap/v3-sdk"
import { CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core"
import { fromUSDC, fromWei, toUSDC, toWei } from "../utils/conversion-helper"
import { WETH } from "../types/WETH"
let signers: Signer[]
let usdcWhale: Signer
let usdcWhaleAddress: string
let liquidityPoolDummy: UniswapV3HedgingTest
let liquidityPoolDummyAddress: string
let uniswapV3HedgingReactor: UniswapV3HedgingReactor
let uniswapV3RangeOrderReactor: UniswapV3RangeOrderReactor
let usdcContract: MintableERC20
let wethContract: WETH
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
let uniswapUSDCWETHPool: Contract
let uniswapRouter: Contract
let bigSignerAddress: string
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
// edit depending on the chain id to be tested on
const chainId = 1

describe("UniswapV3HedgingReactor", () => {
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

	it("deploys the UniswapV3HedgingReactor contract", async () => {
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
	})

	it("sets up a uniswap pool, router and large swapper", async () => {
		wethContract = (await ethers.getContractAt(
			"contracts/tokens/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		const provider = ethers.provider
		bigSignerAddress = await signers[1].getAddress()
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
	let authority: string

	it("Sets a range one tick above USDC/WETH market", async () => {
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

		// buy weth in usdc/weth pool means price went up into the limit order range
		expect(tick).to.be.gt(activeLowerTick)
		expect(tick).to.be.gt(activeUpperTick)
		const balances = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
		const averagePricePaid =
			Number(fromUSDC(balancesBefore.amount0Current)) / Number(fromWei(balances.amount1Current))
		expect(averagePricePaid).to.lt(Number(weth_usdc_price_before))
	})

	it("yanks pool liquidity", async () => {
		//const amounts = await uniswapV3RangeOrderReactor.getAmountsForLiquidity()
		//console.log({ amounts })
		await uniswapV3RangeOrderReactor.yankRangeOrderLiquidity()
	})
	/* 	it("updates minAmount parameter", async () => {
		await uniswapV3HedgingReactor.setMinAmount(1e10)
		const minAmount = await uniswapV3HedgingReactor.minAmount()
		expect(minAmount).to.equal(ethers.utils.parseUnits("1", 10))
	}) */

	it("sets reactor address on LP contract", async () => {
		const reactorAddress = uniswapV3RangeOrderReactor.address

		await liquidityPoolDummy.setHedgingReactorAddress(reactorAddress)

		expect(await liquidityPoolDummy.uniswapV3HedgingReactor()).to.equal(reactorAddress)
	})

	/* 	it("changes nothing if no ETH balance and hedging positive delta", async () => {
		wethContract = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			WETH_ADDRESS[chainId]
		)) as MintableERC20
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
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
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
	}) */

	it("hedges a negative delta", async () => {
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("-0.5"))
		await hedgeDeltaTx.wait()
		const reactorWethBalance = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
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
		expect(reactorDelta).to.equal(0.5)
		expect(reactorWethBalance).to.equal(0.5)
		expect(LpUsdcBalanceBefore).to.be.above(LpUsdcBalanceAfter)
	})
	it("getDelta returns correct value", async () => {
		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		expect(reactorDelta).to.equal(0.5)
	})
	it("gets the portfolio value", async () => {
		const usdBalance = await usdcContract.balanceOf(uniswapV3HedgingReactor.address)
		const wethBalance = await wethContract.balanceOf(uniswapV3HedgingReactor.address)
		const val = await uniswapV3HedgingReactor.getPoolDenominatedValue()
		const usdValue = usdBalance.mul(1000000000000)
		const wethValue = wethBalance.mul(rate).div(1000000)
		expect(usdValue.add(wethValue)).to.eq(val)
	})
	it("hedges a positive delta with sufficient funds", async () => {
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("0.3"))
		await hedgeDeltaTx.wait()

		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const reactorWethBalance = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)

		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)

		// no funds being withdrawn to LP so balance should be unchanged
		expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.be.within(0, 5000)
		expect(reactorDelta).to.equal(0.2)
		expect(reactorWethBalance).to.equal(0.2)
	})
	it("hedges a positive delta with insufficient funds", async () => {
		// has a balance of 5 wETH at this point
		// try to hedge another 15 delta
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("15"))

		await hedgeDeltaTx.wait()

		const reactorWethBalance = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)
		const reactorDelta = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.be.within(0, 700)
		expect(reactorWethBalance).to.equal(0)
		expect(reactorDelta).to.equal(0)
	})

	it("withdraws funds without liquidation", async () => {
		// give it ETH balance
		const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther("-0.5"))
		await hedgeDeltaTx.wait()

		let reactorUsdcBalance = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
				6
			)
		)

		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)

		const reactorDeltaBefore = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)

		expect(reactorWethBalanceBefore).to.equal(0.5)

		const withdrawAmount = "500"

		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const withdrawTx = await liquidityPoolDummy.withdraw(ethers.utils.parseUnits(withdrawAmount, 18))
		let reactorUsdcBalanceOld = reactorUsdcBalance
		reactorUsdcBalance = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
				6
			)
		)
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)
		const reactorDeltaAfter = parseFloat(
			ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta()))
		)
		// expect LP balance to go up by withdrawAmount
		expect(LpUsdcBalanceAfter).to.equal(LpUsdcBalanceBefore)
		// expect reactor balance to go down by withdrawAmount
		expect(reactorUsdcBalance.toFixed(6)).to.equal(reactorUsdcBalanceOld.toFixed(6))
		// expect reactor wETH balance to be unchanged
		expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
		expect(reactorDeltaAfter).to.equal(reactorWethBalanceAfter)
		expect(reactorDeltaBefore).to.equal(reactorDeltaAfter)
	})

	it("liquidates WETH and withdraws sufficient funds", async () => {
		const reactorUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
				6
			)
		)
		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const withdrawAmount = "9000"

		expect(reactorWethBalanceBefore).to.equal(0.5)
		expect(parseFloat(withdrawAmount)).to.be.above(reactorUsdcBalanceBefore)
		// withdraw more than current balance
		await liquidityPoolDummy.withdraw(ethers.utils.parseUnits(withdrawAmount, 18))
		await liquidityPoolDummy.getDelta()
		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)
		const reactorUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
				6
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

		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore - reactorUsdcBalanceBefore).to.be.within(
			-0.001,
			0.001
		)
		expect(reactorUsdcBalanceAfter).to.equal(0)
		expect(reactorDelta).to.equal(reactorWethBalanceAfter)
	})

	it("liquidates all ETH and withdraws but does not have enough funds", async () => {
		// If withdraw amount is greater than the value of assets in the reactor, it should liquidate everything and send all to the LP
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)
		expect(reactorWethBalanceBefore).to.be.above(0)
		const withdrawAmount = "100000000" //100 million
		const tx = await liquidityPoolDummy.withdraw(ethers.utils.parseUnits(withdrawAmount, 18))

		await tx.wait()
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)

		const reactorUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
				6
			)
		)
		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)

		expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.be.below(parseFloat(withdrawAmount))
		expect(reactorWethBalanceAfter).to.equal(reactorWethBalanceBefore)
		expect(reactorUsdcBalanceAfter).to.equal(0)
	})

	it("update changes no balances", async () => {
		const reactorUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
				6
			)
		)
		const reactorWethBalanceBefore = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)
		const LpUsdcBalanceBefore = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		const tx = await liquidityPoolDummy.update()
		const reactorUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
				6
			)
		)
		const reactorWethBalanceAfter = parseFloat(
			ethers.utils.formatEther(
				BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address))
			)
		)
		const LpUsdcBalanceAfter = parseFloat(
			ethers.utils.formatUnits(
				BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
				6
			)
		)
		expect(reactorUsdcBalanceBefore).to.equal(reactorUsdcBalanceAfter)
		expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
		expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
	})

	it("updates poolFee", async () => {
		let poolFee = await uniswapV3HedgingReactor.poolFee()
		expect(poolFee).to.equal(3000)
		const tx = await uniswapV3HedgingReactor.changePoolFee(1000)
		poolFee = await uniswapV3HedgingReactor.poolFee()
		expect(poolFee).to.equal(1000)
	})

	it("update pool fee reverts if not owner", async () => {
		await expect(uniswapV3HedgingReactor.connect(signers[1]).changePoolFee(10000)).to.be.reverted
		let poolFee = await uniswapV3HedgingReactor.poolFee()
		expect(poolFee).to.equal(1000)
	})

	it("withdraw reverts if not called form liquidity pool", async () => {
		await expect(uniswapV3HedgingReactor.withdraw(100000000000)).to.be.revertedWith("!vault")
	})

	it("hedgeDelta reverts if not called from liquidity pool", async () => {
		await expect(
			uniswapV3HedgingReactor.hedgeDelta(ethers.utils.parseEther("-10"))
		).to.be.revertedWith("!vault")
	})
})
