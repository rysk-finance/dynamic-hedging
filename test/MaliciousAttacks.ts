import hre, { ethers } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber } from "ethers"
import {
	toWei,
	call,
	put,
	fromWei,
	convertRounded,
	toUSDC,
	fmtExpiration,
	fromOpyn
} from "../utils/conversion-helper"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import moment from "moment"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
//@ts-ignore
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { ERC20Interface } from "../types/ERC20Interface"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPools } from "../types/LiquidityPools"
import { LiquidityPool } from "../types/LiquidityPool"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import {
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	WETH_ADDRESS
} from "./constants"
let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let liquidityProviderAddress: string
let attackerAddress: string
let liquidityPools: LiquidityPools
let liquidityPool: LiquidityPool
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string
const IMPLIED_VOL = "60"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
const expiryDate: string = "2022-03-12"
// decimal representation of a percentage
const rfr: string = "0.03"
// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = "-5000"

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = "1000000"

// attacker deposit LP70839675
const attackerUsdcDeposit = "1000"

// balance to withdraw after deposit
const liquidityPoolWethWidthdraw = "0.1"

/* --- end variables to change --- */

const expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000

const CALL_FLAVOR = BigNumber.from(call)
const PUT_FLAVOR = BigNumber.from(put)

describe("Hegic Attack", function () {
	before(async function () {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						chainId: 1,
						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
						blockNumber: 12821000
					}
				}
			]
		})
	})

	it("Deploys the Option Registry", async () => {
		signers = await ethers.getSigners()
		liquidityProviderAddress = await signers[0].getAddress()
		attackerAddress = await signers[1].getAddress()
		// deploy libraries
		const constantsFactory = await ethers.getContractFactory("Constants")
		const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
		const constants = await constantsFactory.deploy()
		const interactions = await interactionsFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
			libraries: {
				OpynInteractions: interactions.address
			}
		})
		// get and transfer weth
		weth = (await ethers.getContractAt(
			"contracts/interfaces/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		wethERC20 = (await ethers.getContractAt(
			"ERC20Interface",
			WETH_ADDRESS[chainId]
		)) as ERC20Interface
		usd = (await ethers.getContractAt("ERC20", USDC_ADDRESS[chainId])) as MintableERC20
		await weth.deposit({ value: utils.parseEther("99") })
		const _optionRegistry = (await optionRegistryFactory.deploy(
			USDC_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			liquidityProviderAddress
		)) as OptionRegistry
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")
	})

	it("Should deploy price feed", async () => {
		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)

		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, usd.address, ethUSDAggregator.address)
		await priceFeed.addPriceFeed(weth.address, usd.address, ethUSDAggregator.address)
		const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, usd.address)
		expect(feedAddress).to.eq(ethUSDAggregator.address)
		rate = "1280000000000" //12800
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			rate,
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		await ethUSDAggregator.mock.decimals.returns("8")
	})

	it("Should deploy liquidity pools", async () => {
		const normDistFactory = await ethers.getContractFactory("NormalDist", {
			libraries: {}
		})
		const normDist = await normDistFactory.deploy()
		const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
			libraries: {
				NormalDist: normDist.address
			}
		})
		const blackScholesDeploy = await blackScholesFactory.deploy()
		const constFactory = await ethers.getContractFactory(
			"contracts/libraries/Constants.sol:Constants"
		)
		const constants = await constFactory.deploy()
		const optComputeFactory = await ethers.getContractFactory(
			"contracts/libraries/OptionsCompute.sol:OptionsCompute",
			{
				libraries: {}
			}
		)
		await optComputeFactory.deploy()
		const liquidityPoolsFactory = await ethers.getContractFactory("LiquidityPools", {
			libraries: {
				BlackScholes: blackScholesDeploy.address
			}
		})
		const _liquidityPools: LiquidityPools = (await liquidityPoolsFactory.deploy()) as LiquidityPools
		liquidityPools = _liquidityPools
	})
	it("Should deploy option protocol and link to liquidity pools", async () => {
		const protocolFactory = await ethers.getContractFactory("Protocol")
		optionProtocol = (await protocolFactory.deploy(
			optionRegistry.address,
			liquidityPools.address,
			priceFeed.address
		)) as Protocol
		await liquidityPools.setup(optionProtocol.address)
		const lpProtocol = await liquidityPools.protocol()
		expect(optionProtocol.address).to.eq(lpProtocol)
	})

	it("Creates a liquidity pool with USDC (erc20) as strikeAsset", async () => {
		type int7 = [
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish,
			BigNumberish
		]
		type number7 = [number, number, number, number, number, number, number]
		const coefInts: number7 = [
			1.42180236,
			0,
			-0.08626792,
			0.07873822,
			0.00650549,
			0.02160918,
			-0.1393287
		]
		//@ts-ignore
		const coefs: int7 = coefInts.map(x => toWei(x.toString()))
		const lp = await liquidityPools.createLiquidityPool(
			usd.address,
			weth.address,
			usd.address,
			toWei(rfr),
			coefs,
			coefs,
			"ETH/USDC",
			"EDP"
		)
		const lpReceipt = await lp.wait(1)
		const events = lpReceipt.events
		const createEvent = events?.find(x => x.event == "LiquidityPoolCreated")
		const strikeAsset = createEvent?.args?.strikeAsset
		const lpAddress = createEvent?.args?.lp
		expect(createEvent?.event).to.eq("LiquidityPoolCreated")
		expect(strikeAsset).to.eq(usd.address)
		liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
		optionRegistry.setLiquidityPool(liquidityPool.address)
	})

	it("Adds liquidity to the liquidityPool", async () => {
		const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_WHALE]
		})
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		await usdWhaleConnect.transfer(liquidityProviderAddress, toUSDC(liquidityPoolUsdcDeposit))
		await usdWhaleConnect.transfer(attackerAddress, toUSDC("50000"))
		const balance = await usd.balanceOf(liquidityProviderAddress)
		await usd.approve(liquidityPool.address, toWei(liquidityPoolUsdcDeposit))
		const deposit = await liquidityPool.deposit(
			toUSDC(liquidityPoolUsdcDeposit),
			liquidityProviderAddress
		)
		const liquidityPoolBalanceUSDC = await usd.balanceOf(liquidityPool.address)
		const receipt = await deposit.wait(1)
		const event = receipt?.events?.find(x => x.event == "Deposit")
		const newBalance = await usd.balanceOf(liquidityProviderAddress)
		expect(event?.event).to.eq("Deposit")
		expect(balance.sub(newBalance)).to.eq(toUSDC(liquidityPoolUsdcDeposit))
		expect(liquidityPoolBalanceUSDC).to.equal(utils.parseUnits(liquidityPoolUsdcDeposit, 6))
	})

	it("Attacker adds liquidity", async () => {
		const [liquidityProvider, attacker] = await ethers.getSigners()
		const usdAttacker = usd.connect(attacker)
		await usdAttacker.approve(liquidityPool.address, toUSDC(attackerUsdcDeposit))
		const wethAttacker = weth.connect(attacker)
		const wethDeposit = await wethAttacker.deposit({ value: toWei("99") })
		await wethDeposit.wait(1)
		const lpAttacker = liquidityPool.connect(attacker)
		await wethAttacker.approve(liquidityPool.address, toWei("1"))
		const totalSupply = await liquidityPool.totalSupply()
		await lpAttacker.deposit(toUSDC(attackerUsdcDeposit), attackerAddress)
		const newTotalSupply = await liquidityPool.totalSupply()

		const lpBalance = await lpAttacker.balanceOf(attackerAddress)
		const difference = newTotalSupply.sub(lpBalance)

		const supplyRatio = convertRounded(newTotalSupply) / convertRounded(totalSupply)
		// expect(supplyRatio).to.eq(1.1)
		expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))
	})

	let lpCallOption: IOToken
	it("LP Writes a WETH/USD put collateralized by WETH for premium to the attacker", async () => {
		const [liquidityProvider, attacker] = signers
		// registry requires liquidity pool to be owner
		optionRegistry.setLiquidityPool(liquidityPool.address)
		const amount = toWei("1")
		const blockNum = await ethers.provider.getBlockNumber()
		const block = await ethers.provider.getBlock(blockNum)
		const { timestamp } = block

		// opyn contracts require expiration to be at 8:00 UTC

		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
		const strikePrice = priceQuote.sub(toWei(strike))
		// await usd.connect(attacker).approve(liquidityPool.address, toUSDC("2000"))
		// await weth.deposit({ value: amount.mul("5") })
		// await weth.approve(liquidityPool.address, amount.mul("5"))
		// await liquidityPool.addLiquidity(toUSDC("6000"), amount.mul("4"), 0, 0)
		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
		const proposedSeries = {
			expiration: fmtExpiration(expiration),
			flavor: BigNumber.from(put),
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address
		}
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		await usd.connect(attacker).approve(liquidityPool.address, toWei("10000000000"))
		const write = await liquidityPool.connect(attacker).issueAndWriteOption(proposedSeries, amount)
		const receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		const seriesAddress = writeEvent?.args?.series
		const callOptionToken = new Contract(seriesAddress, Otoken.abi, attacker) as IOToken
		lpCallOption = callOptionToken
		const buyerOptionBalance = await callOptionToken.balanceOf(attackerAddress)
		//@ts-ignore
		const totalInterest = await callOptionToken.totalSupply()
		const writersBalance = await optionRegistry.writers(seriesAddress, liquidityPool.address)
		const lpUSDBalance = await usd.balanceOf(liquidityPool.address)
		const attackerEthBalance = await attacker.getBalance()
		const balanceDiff = lpUSDBalanceBefore.sub(lpUSDBalance)
		expect(writersBalance).to.eq(amount)
		expect(fromOpyn(buyerOptionBalance)).to.eq(fromWei(amount))
		expect(fromOpyn(totalInterest)).to.eq(fromWei(amount))
	})

	it("attacker withdraws liquidity", async () => {
		const [liquidityProvider, attacker] = signers
		const shares = await liquidityPool.balanceOf(attackerAddress)
		const usdcBalanceBefore = await usd.balanceOf(attackerAddress)
		const wethBalanceBefore = await wethERC20.balanceOf(attackerAddress)
		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
		await liquidityPool.connect(attacker).withdraw(shares, attackerAddress)
		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
		const usdcBalanceAfter = await usd.balanceOf(attackerAddress)
		const wethBalanceAfter = await wethERC20.balanceOf(attackerAddress)
		expect(lpBalanceAfter.sub(lpBalanceBefore.sub(utils.parseUnits(attackerUsdcDeposit, 6)))).to.be.within(-10, 10)
		expect(usdcBalanceAfter.sub(usdcBalanceBefore.add(utils.parseUnits(attackerUsdcDeposit, 6)))).to.be.within(-10, 10)
	})
})
