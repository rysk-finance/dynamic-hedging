import { TickMath, Pool } from "@uniswap/v3-sdk"
import { Token } from "@uniswap/sdk-core"
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json"
import { ethers, Contract, Signer } from "ethers"
import { ethers as hhEthers } from "hardhat"
import { MintableERC20 } from "../types/MintableERC20"
import JSBI from "jsbi"

const quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"

interface Immutables {
	factory: string
	token0: string
	token1: string
	fee: number
	tickSpacing: number
	maxLiquidityPerTick: ethers.BigNumber
}

export interface State {
	liquidity: ethers.BigNumber
	sqrtPriceX96: ethers.BigNumber
	tick: number
	observationIndex: number
	observationCardinality: number
	observationCardinalityNext: number
	feeProtocol: number
	unlocked: boolean
}

async function getPoolImmutables(poolContract: Contract): Promise<Immutables> {
	const fac = await poolContract.factory()
	const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] = await Promise.all([
		poolContract.factory(),
		poolContract.token0(),
		poolContract.token1(),
		poolContract.fee(),
		poolContract.tickSpacing(),
		poolContract.maxLiquidityPerTick()
	])

	const immutables: Immutables = {
		factory,
		token0,
		token1,
		fee,
		tickSpacing,
		maxLiquidityPerTick
	}
	return immutables
}

async function getPoolState(poolContract: Contract): Promise<State> {
	const [liquidity, slot] = await Promise.all([poolContract.liquidity(), poolContract.slot0()])

	const PoolState: State = {
		liquidity,
		sqrtPriceX96: slot[0],
		tick: slot[1],
		observationIndex: slot[2],
		observationCardinality: slot[3],
		observationCardinalityNext: slot[4],
		feeProtocol: slot[5],
		unlocked: slot[6]
	}

	return PoolState
}

async function getErc20Contract(tokenAddress: string) {
	const c = (await hhEthers.getContractAt(
		"contracts/tokens/ERC20.sol:ERC20",
		tokenAddress
	)) as MintableERC20
	return c
}

export async function getPoolInfo(poolContract: Contract) {
	const [immutables, state] = await Promise.all([
		getPoolImmutables(poolContract),
		getPoolState(poolContract)
	])
	const { chainId } = await poolContract.provider.getNetwork()
	const token0Address = await poolContract.token0()
	const token1Address = await poolContract.token1()
	const token0 = await getErc20Contract(token0Address)
	const token1 = await getErc20Contract(token1Address)
	const t0sym = await token0.symbol()
	const [token0Symbol, token1Symbol, token0Name, token1Name, token0Decimals, token1Decimals] =
		await Promise.all([
			token0.symbol(),
			token1.symbol(),
			token0.name(),
			token1.name(),
			token0.decimals(),
			token1.decimals()
		])

	const TokenA = new Token(chainId, immutables.token0, token0Decimals, token0Symbol, token0Name)

	const TokenB = new Token(chainId, immutables.token1, token1Decimals, token1Symbol, token1Name)

	const pool = new Pool(
		TokenA,
		TokenB,
		immutables.fee,
		state.sqrtPriceX96.toString(),
		state.liquidity.toString(),
		state.tick
	)
	return pool
}

export const quoterContract = (signer: Signer) =>
	new ethers.Contract(quoterAddress, QuoterABI, signer)

// used in liquidity amount math
export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))
export const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2))

export function uniTickToPrice(tick: number, baseToken: string, quoteToken: string) {
	const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick)

	const ratioX192 = JSBI.multiply(sqrtRatioX96, sqrtRatioX96)
	const baseIsLessThanQuote = baseToken.toLowerCase() < quoteToken.toLowerCase()
}

export function tickToPrice(
	tick: number,
	token0Decimals: number,
	token1Decimals: number,
	inverse: boolean = true
) {
	const numerator = 1.0001 ** Math.abs(tick)
	const denominator = 10 ** Math.abs(token1Decimals - token0Decimals)
	// Token0 price in relation to Token1
	const price = numerator / denominator
	// to reverse and get value  token1 price in relation to token0 10**token1decimals/tickPrice
	const inversePrice = 10 ** token1Decimals / price
	return inverse ? inversePrice : price
}
