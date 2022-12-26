import hre, { ethers, network, Contract } from "hardhat"
import { Signer, BigNumber } from "ethers"
import { expect } from "chai"
import { MintableERC20 } from "../types/MintableERC20"
import {
	UniswapV3RangeOrderReactor,
	RangeOrderParamsStruct
} from "../types/UniswapV3RangeOrderReactor"
import { UniswapV3HedgingTest } from "../types/UniswapV3HedgingTest"
import {
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS,
	UNISWAP_V3_FACTORY,
	USDT_ADDRESS
} from "./constants"
import { PriceFeed } from "../types/PriceFeed"
import { MintEvent } from "../types/IUniswapV3PoolEvents"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
import { abi as ISwapRouterABI } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json"
import { getPoolInfo } from "../utils/uniswap"
import { fromUSDC, fromWei, toUSDC, toWei } from "../utils/conversion-helper"
import {
	getMatchingEvents,
	UNISWAP_POOL_MINT,
	UNISWAP_POOL_BURN,
	UNISWAP_POOL_COLLECT
} from "../utils/events"
import { WETH } from "../types/WETH"

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
let uniswapConversions: Contract
let uniswapRouter: Contract
let bigSignerAddress: string
let authority: string
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
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy(authority)) as PriceFeed
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
		expect(priceDifference).to.be.eq(0)
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
			WBTC,
			USDT_ADDRESS[chainId],
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
			WBTC,
			USDC_ADDRESS[chainId],
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
		const balancesBefore = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
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
		expect(fulfillAttempt).to.be.revertedWithCustomError(
			uniswapV3RangeOrderReactor,
			"RangeOrderNotFilled"
		)
		expect(tick).to.be.gt(activeLowerTick)
		expect(tickAfter).to.be.lt(activeUpperTick)
		expect(reactorDeltaAfter).to.be.lt(reactorDelta)
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
		const balancesBefore = await uniswapV3RangeOrderReactor.getUnderlyingBalances()
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
		const reactorDeltaAfter = Number(fromWei(await liquidityPoolDummy.getDelta()))

		const fulfillAttempt = await uniswapV3RangeOrderReactor.fulfillActiveRangeOrder()
		const receipt = await fulfillAttempt.wait()
		const [collectEvent] = getMatchingEvents(receipt, UNISWAP_POOL_COLLECT)
		const { activeLowerTick: activeLowerAfter, activeUpperTick: activeUpperAfter } =
			await uniswapV3RangeOrderReactor.currentPosition()
		const deltaDifference = Math.round((reactorDelta - reactorDeltaAfter) * 100) / 100
		const average = Math.sqrt(Number(weth_usdc_price_before) * Number(weth_usdc_price_after))
		// USDC amount
		const amountOut = Number(fromUSDC(collectEvent.amount0))
		const fillPrice = amountOut / 0.3
		// Amount of delta hedged
		expect(deltaDifference).to.eq(0.3)
		expect(fillPrice).to.be.gt(average)
		expect(tickAfter).to.be.lt(activeLowerTick)
		expect(activeLowerAfter).to.be.eq(0)
		expect(activeUpperAfter).to.be.eq(0)
	})

	it("withdraws partial excess USDC to liquidity pool", async () => {
		const usdcBalance = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const usdcBalanceLp = await usdcContract.balanceOf(liquidityPoolDummy.address)
		const withdrawAmount = toUSDC("1000")
		const withdrawTx = await liquidityPoolDummy.withdraw(withdrawAmount)
		const receipt = await withdrawTx.wait()
		const usdcBalanceAfter = await usdcContract.balanceOf(uniswapV3RangeOrderReactor.address)
		const usdcBalanceLpAfter = await usdcContract.balanceOf(liquidityPoolDummy.address)
		expect(usdcBalanceAfter).to.eq(usdcBalance.sub(withdrawAmount))
		expect(usdcBalanceLpAfter).to.eq(usdcBalanceLp.add(withdrawAmount))
	})

	it("Allows the guardian to recover an erc20 token directly", async () => {
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
	it("Converts a usdc/weth (6/18 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const usdcWethPrice = "304794466082623"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(usdcWethPrice, 6)
		const poolSquareRootPrice = BigNumber.from("1383194083266513227538809339896527")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
	})

	it("Converts a weth/usdt (18/6 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const wethUsdtPrice = "3278775459"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(wethUsdtPrice, 18)
		const poolSquareRootPrice = BigNumber.from("4536651532748345691924484")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
	})

	it("Converts a DAI/WETH (18/18 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const daiWethPrice = "304873053351706"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(daiWethPrice, 18)
		const poolSquareRootPrice = BigNumber.from("1383372391030930353024001313")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
	})

	it("Converts a WBTC/USDT (8/6 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const wbtcUsdcPrice = "45149740258"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(wbtcUsdcPrice, 8)
		const poolSquareRootPrice = BigNumber.from("1683477094974729778595779250705")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
	})

	it("Converts a WBTC/USDC (8/6 decimals) to sqrtPriceX96 - Uniswap Conversions", async () => {
		const wbtcUsdcPrice = "45165453874"
		const sqrtPriceX96 = await uniswapConversions.priceToSqrtX96(wbtcUsdcPrice, 8)
		const poolSquareRootPrice = BigNumber.from("1683770022578357087060958331921")
		const poolLength = poolSquareRootPrice.toString().length
		const sqrtPriceLength = sqrtPriceX96.toString().length
		const difference = sqrtPriceX96.sub(poolSquareRootPrice)
		const poolPriceFromWei = Number(fromWei(poolSquareRootPrice))
		const difFromWei = Math.abs(Number(fromWei(difference)))
		const percentDifferece = difFromWei / poolPriceFromWei
		expect(sqrtPriceLength).to.eq(poolLength)
		expect(percentDifferece).to.be.lt(1e-6)
	})
})
