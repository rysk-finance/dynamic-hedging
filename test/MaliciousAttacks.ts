import hre, { ethers, network } from "hardhat"
import { BigNumberish, Contract, utils, Signer, BigNumber } from "ethers"
import {
	toWei,
	call,
	put,
	fromWei,
	convertRounded,
	toUSDC,
	fmtExpiration,
	fromOpyn,
	scaleNum
} from "../utils/conversion-helper"
import { MockChainlinkAggregator } from "../types/MockChainlinkAggregator"
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract"
import { Oracle } from "../types/Oracle"
import moment from "moment"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
//@ts-ignore
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { ERC20Interface } from "../types/ERC20Interface"
import { Controller } from "../types/Controller"
import { AddressBook } from "../types/AddressBook"
import { NewMarginCalculator } from "../types/NewMarginCalculator"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistry } from "../types/OptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPools } from "../types/LiquidityPools"
import { LiquidityPool } from "../types/LiquidityPool"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import { setupOracle, setOpynOracleExpiryPrice, setupTestOracle, increase } from "./helpers"
import {
	ADDRESS_BOOK,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	WETH_ADDRESS,
	GAMMA_ORACLE_NEW,
	CONTROLLER_OWNER
} from "./constants"
let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let controller: Controller
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let oracle: Contract
let signers: Signer[]
let liquidityProviderAddress: string
let attackerAddress: string
let liquidityPools: LiquidityPools
let liquidityPool: LiquidityPool
let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let opynAggregator: MockChainlinkAggregator
let rate: string
const IMPLIED_VOL = "60"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
const expiryDate: string = "2022-04-30"
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

const minCallStrikePrice = utils.parseEther("500")
const maxCallStrikePrice = utils.parseEther("20000")
const minPutStrikePrice = utils.parseEther("500")
const maxPutStrikePrice = utils.parseEther("20000")
const minExpiry = moment.utc().add(1, "week").valueOf() / 1000
const maxExpiry = moment.utc().add(1, "year").valueOf() / 1000

const productSpotShockValue = scaleNum("0.6", 27)
// array of time to expiry
const day = 60 * 60 * 24
const timeToExpiry = [day * 7, day * 14, day * 28, day * 42, day * 56]
// array of upper bound value correspond to time to expiry
const expiryToValue = [
	scaleNum("0.1678", 27),
	scaleNum("0.237", 27),
	scaleNum("0.3326", 27),
	scaleNum("0.4032", 27),
	scaleNum("0.4603", 27)
]

/* --- end variables to change --- */

const expiration = moment.utc(expiryDate).add(8, "h").valueOf() / 1000

const CALL_FLAVOR = false
const PUT_FLAVOR = true

let putSeriesAddress: string
describe("Expiry attack", function () {
	before(async function () {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						chainId: 1,
						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
						blockNumber: 14290000
					}
				}
			]
		})
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [CONTROLLER_OWNER[chainId]]
		})
		signers = await ethers.getSigners()
		const [sender] = signers

		const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
		await sender.sendTransaction({
			to: signer.address,
			value: ethers.utils.parseEther("1.0") // Sends exactly 1.0 ether
		})
		// get the oracle
		const res = await setupTestOracle(await signers[0].getAddress())
		//@ts-ignore
		oracle = res[0]
		//@ts-ignore
		opynAggregator = res[1]
		//@ts-ignore
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
			liquidityProviderAddress,
			ADDRESS_BOOK[chainId]
		)) as OptionRegistry
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")
	})

	it("Should deploy price feed", async () => {
		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(ZERO_ADDRESS, usd.address, opynAggregator.address)
		await priceFeed.addPriceFeed(weth.address, usd.address, opynAggregator.address)
		// oracle returns price denominated in 1e8
		const oraclePrice = await oracle.getPrice(weth.address)
		// pricefeed returns price denominated in 1e18
		const priceFeedPrice = await priceFeed.getNormalizedRate(weth.address, usd.address)
		expect(oraclePrice.mul(10_000_000_000)).to.equal(priceFeedPrice)
		// expect(await priceFeed.getNormalizedRate(weth.address, usd.address)).to.equal(oraclePrice)
		// const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, usd.address)
		// expect(feedAddress).to.eq(opynAggregator.address)
		// rate = "1280000000000" //12800
		// await ethUSDAggregator.mock.latestRoundData.returns(
		// 	"55340232221128660932",
		// 	rate,
		// 	"1607534965",
		// 	"1607535064",
		// 	"55340232221128660932"
		// )
		// await ethUSDAggregator.mock.decimals.returns("8")
	})
	it("Should deploy option protocol and link to registry/price feed", async () => {
		const protocolFactory = await ethers.getContractFactory("Protocol")
		optionProtocol = (await protocolFactory.deploy(
			optionRegistry.address,
			priceFeed.address
		)) as Protocol
		expect(await optionProtocol.optionRegistry()).to.equal(optionRegistry.address)
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

		const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
			libraries: {
				BlackScholes: blackScholesDeploy.address
			}
		})
		const lp = (await liquidityPoolFactory.deploy(
			optionProtocol.address,
			usd.address,
			weth.address,
			usd.address,
			toWei(rfr),
			coefs,
			coefs,
			"ETH/USDC",
			"EDP",
			{
				minCallStrikePrice,
				maxCallStrikePrice,
				minPutStrikePrice,
				maxPutStrikePrice,
				minExpiry: fmtExpiration(minExpiry),
				maxExpiry: fmtExpiration(maxExpiry)
			},
			await signers[0].getAddress()
		)) as LiquidityPool

		const lpAddress = lp.address
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
		// send honest LP / option buyer the deposit amount plus funds to buy options
		await usdWhaleConnect.transfer(
			liquidityProviderAddress,
			toUSDC(liquidityPoolUsdcDeposit).add(toUSDC("100000"))
		)
		// send attacker 10 million USDC
		await usdWhaleConnect.transfer(attackerAddress, toUSDC("10000000"))
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

	// it("Attacker adds liquidity", async () => {
	// 	const [liquidityProvider, attacker] = await ethers.getSigners()
	// 	const usdAttacker = usd.connect(attacker)
	// 	await usdAttacker.approve(liquidityPool.address, toUSDC(attackerUsdcDeposit))
	// 	const wethAttacker = weth.connect(attacker)
	// 	const wethDeposit = await wethAttacker.deposit({ value: toWei("99") })
	// 	await wethDeposit.wait(1)
	// 	const lpAttacker = liquidityPool.connect(attacker)
	// 	await wethAttacker.approve(liquidityPool.address, toWei("1"))
	// 	const totalSupply = await liquidityPool.totalSupply()
	// 	await lpAttacker.deposit(toUSDC(attackerUsdcDeposit), attackerAddress)
	// 	const newTotalSupply = await liquidityPool.totalSupply()

	// 	const lpBalance = await lpAttacker.balanceOf(attackerAddress)
	// 	const difference = newTotalSupply.sub(lpBalance)

	// 	const supplyRatio = convertRounded(newTotalSupply) / convertRounded(totalSupply)
	// 	// expect(supplyRatio).to.eq(1.1)
	// 	expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))
	// })

	let lpPutOption: IOToken
	it("LP Writes a WETH/USD put collateralized by WETH for premium to a buyer", async () => {
		const [liquidityProvider, attacker] = signers
		// registry requires liquidity pool to be owner
		optionRegistry.setLiquidityPool(liquidityPool.address)
		const amount = toWei("10")
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
			isPut: true,
			strike: BigNumber.from(strikePrice),
			strikeAsset: usd.address,
			underlying: weth.address,
			collateral: usd.address
		}
		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
		const write = await liquidityPool.issueAndWriteOption(proposedSeries, amount)
		const receipt = await write.wait(1)
		const events = receipt.events
		const writeEvent = events?.find(x => x.event == "WriteOption")
		putSeriesAddress = writeEvent?.args?.series
		const putOptionToken = new Contract(putSeriesAddress, Otoken.abi, liquidityProvider) as IOToken
		lpPutOption = putOptionToken
		const buyerOptionBalance = await putOptionToken.balanceOf(liquidityProviderAddress)
		//@ts-ignore
		const totalInterest = await putOptionToken.totalSupply()
		const writersBalance = await optionRegistry.writers(putSeriesAddress, liquidityPool.address)
		const lpUSDBalance = await usd.balanceOf(liquidityPool.address)
		const lpEthBalance = await liquidityProvider.getBalance()
		const balanceDiff = lpUSDBalanceBefore.sub(lpUSDBalance)
		expect(writersBalance).to.eq(amount)
		expect(fromOpyn(buyerOptionBalance)).to.eq(fromWei(amount))
		expect(fromOpyn(totalInterest)).to.eq(fromWei(amount))
	})
	it("attack adds liquidity moments before expiry", async () => {
		const [liquidityProvider, attacker] = signers
		// fast forward time to 10s before options expiry
		await ethers.provider.send("evm_mine", [expiration - 10])
		await usd.connect(attacker).approve(liquidityPool.address, toUSDC("10000000"))
		const oraclePrice = await oracle.getPrice(weth.address)
		console.log("old price:", oraclePrice)
		// add $5000 to ETH value to make puts expire OTM
		await opynAggregator.setLatestAnswer(oraclePrice.add(utils.parseUnits("5000", 8)))
		await opynAggregator.setRoundAnswer(0, oraclePrice.add(utils.parseUnits("5000", 8)))
		// pricefeed returns price denominated in 1e18
		const priceFeedPrice = await priceFeed.getNormalizedRate(weth.address, usd.address)
		console.log({ oraclePrice, priceFeedPrice })
		const deposit = await liquidityPool.connect(attacker).deposit(toUSDC("10000000"), attackerAddress)
		const tx = await deposit.wait()
		const block = await ethers.provider.getBlock(tx.blockNumber)
		console.log(block.timestamp)
		expect(block.timestamp).to.be.lt(expiration)
	})

	it("options expire worthless and attacker withdraws liquidity", async () => {
		const [liquidityProvider, attacker] = signers
		const attackerBalanceBefore = await usd.balanceOf(attackerAddress)
		const writersBalance = await optionRegistry.writers(putSeriesAddress, liquidityPool.address)
		expect(writersBalance).to.eq(toWei("10"))
		await ethers.provider.send("evm_mine", [expiration])
		const shares = await liquidityPool.balanceOf(attackerAddress)
		await liquidityPool.connect(attacker).withdraw(shares, attackerAddress)
		const attackerBalanceAfter = await usd.balanceOf(attackerAddress)

		expect(attackerBalanceAfter).to.equal(attackerBalanceBefore.add(toUSDC("10000000")))
	})

	// it("attacker withdraws liquidity", async () => {
	// 	const [liquidityProvider, attacker] = signers
	// 	const shares = await liquidityPool.balanceOf(attackerAddress)
	// 	const usdcBalanceBefore = await usd.balanceOf(attackerAddress)
	// 	const wethBalanceBefore = await wethERC20.balanceOf(attackerAddress)
	// 	const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
	// 	await liquidityPool.connect(attacker).withdraw(shares, attackerAddress)
	// 	const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
	// 	const usdcBalanceAfter = await usd.balanceOf(attackerAddress)
	// 	const wethBalanceAfter = await wethERC20.balanceOf(attackerAddress)
	// 	expect(
	// 		lpBalanceAfter.sub(lpBalanceBefore.sub(utils.parseUnits(attackerUsdcDeposit, 6)))
	// 	).to.be.within(-10, 10)
	// 	expect(
	// 		usdcBalanceAfter.sub(usdcBalanceBefore.add(utils.parseUnits(attackerUsdcDeposit, 6)))
	// 	).to.be.within(-10, 10)
	// })
})

// describe("Hegic Attack", function () {
// 	before(async function () {
// 		await hre.network.provider.request({
// 			method: "hardhat_reset",
// 			params: [
// 				{
// 					forking: {
// 						chainId: 1,
// 						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
// 						blockNumber: 12821000
// 					}
// 				}
// 			]
// 		})
// 	})

// 	it("Deploys the Option Registry", async () => {
// 		signers = await ethers.getSigners()
// 		liquidityProviderAddress = await signers[0].getAddress()
// 		attackerAddress = await signers[1].getAddress()
// 		// deploy libraries
// 		const constantsFactory = await ethers.getContractFactory("Constants")
// 		const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
// 		const constants = await constantsFactory.deploy()
// 		const interactions = await interactionsFactory.deploy()
// 		// deploy options registry
// 		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
// 			libraries: {
// 				OpynInteractions: interactions.address
// 			}
// 		})
// 		// get and transfer weth
// 		weth = (await ethers.getContractAt(
// 			"contracts/interfaces/WETH.sol:WETH",
// 			WETH_ADDRESS[chainId]
// 		)) as WETH
// 		wethERC20 = (await ethers.getContractAt(
// 			"ERC20Interface",
// 			WETH_ADDRESS[chainId]
// 		)) as ERC20Interface
// 		usd = (await ethers.getContractAt("ERC20", USDC_ADDRESS[chainId])) as MintableERC20
// 		await weth.deposit({ value: utils.parseEther("99") })
// 		const _optionRegistry = (await optionRegistryFactory.deploy(
// 			USDC_ADDRESS[chainId],
// 			OTOKEN_FACTORY[chainId],
// 			GAMMA_CONTROLLER[chainId],
// 			MARGIN_POOL[chainId],
// 			liquidityProviderAddress,
// 			ADDRESS_BOOK[chainId]
// 		)) as OptionRegistry
// 		optionRegistry = _optionRegistry
// 		expect(optionRegistry).to.have.property("deployTransaction")
// 	})

// 	it("Should deploy price feed", async () => {
// 		ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)

// 		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
// 		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
// 		priceFeed = _priceFeed
// 		await priceFeed.addPriceFeed(ZERO_ADDRESS, usd.address, ethUSDAggregator.address)
// 		await priceFeed.addPriceFeed(weth.address, usd.address, ethUSDAggregator.address)
// 		const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, usd.address)
// 		expect(feedAddress).to.eq(ethUSDAggregator.address)
// 		rate = "1280000000000" //12800
// 		await ethUSDAggregator.mock.latestRoundData.returns(
// 			"55340232221128660932",
// 			rate,
// 			"1607534965",
// 			"1607535064",
// 			"55340232221128660932"
// 		)
// 		await ethUSDAggregator.mock.decimals.returns("8")
// 	})
// 	it("Should deploy option protocol and link to registry/price feed", async () => {
// 		const protocolFactory = await ethers.getContractFactory("Protocol")
// 		optionProtocol = (await protocolFactory.deploy(
// 			optionRegistry.address,
// 			priceFeed.address
// 		)) as Protocol
// 		expect(await optionProtocol.optionRegistry()).to.equal(optionRegistry.address)
// 	})

// 	it("Creates a liquidity pool with USDC (erc20) as strikeAsset", async () => {
// 		type int7 = [
// 			BigNumberish,
// 			BigNumberish,
// 			BigNumberish,
// 			BigNumberish,
// 			BigNumberish,
// 			BigNumberish,
// 			BigNumberish
// 		]
// 		type number7 = [number, number, number, number, number, number, number]
// 		const coefInts: number7 = [
// 			1.42180236,
// 			0,
// 			-0.08626792,
// 			0.07873822,
// 			0.00650549,
// 			0.02160918,
// 			-0.1393287
// 		]
// 		//@ts-ignore
// 		const coefs: int7 = coefInts.map(x => toWei(x.toString()))

// 		const normDistFactory = await ethers.getContractFactory("NormalDist", {
// 			libraries: {}
// 		})
// 		const normDist = await normDistFactory.deploy()

// 		const blackScholesFactory = await ethers.getContractFactory("BlackScholes", {
// 			libraries: {
// 				NormalDist: normDist.address
// 			}
// 		})
// 		const blackScholesDeploy = await blackScholesFactory.deploy()

// 		const liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool", {
// 			libraries: {
// 				BlackScholes: blackScholesDeploy.address
// 			}
// 		})
// 		const lp = (await liquidityPoolFactory.deploy(
// 			optionProtocol.address,
// 			usd.address,
// 			weth.address,
// 			usd.address,
// 			toWei(rfr),
// 			coefs,
// 			coefs,
// 			"ETH/USDC",
// 			"EDP",
// 			{
// 				minCallStrikePrice,
// 				maxCallStrikePrice,
// 				minPutStrikePrice,
// 				maxPutStrikePrice,
// 				minExpiry: fmtExpiration(minExpiry),
// 				maxExpiry: fmtExpiration(maxExpiry)
// 			},
// 			await signers[0].getAddress()
// 		)) as LiquidityPool

// 		const lpAddress = lp.address
// 		liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
// 		optionRegistry.setLiquidityPool(liquidityPool.address)
// 	})

// 	it("Adds liquidity to the liquidityPool", async () => {
// 		const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"
// 		await hre.network.provider.request({
// 			method: "hardhat_impersonateAccount",
// 			params: [USDC_WHALE]
// 		})
// 		const usdcWhale = await ethers.getSigner(USDC_WHALE)
// 		const usdWhaleConnect = await usd.connect(usdcWhale)
// 		await usdWhaleConnect.transfer(liquidityProviderAddress, toUSDC(liquidityPoolUsdcDeposit))
// 		await usdWhaleConnect.transfer(attackerAddress, toUSDC("50000"))
// 		const balance = await usd.balanceOf(liquidityProviderAddress)
// 		await usd.approve(liquidityPool.address, toWei(liquidityPoolUsdcDeposit))
// 		const deposit = await liquidityPool.deposit(
// 			toUSDC(liquidityPoolUsdcDeposit),
// 			liquidityProviderAddress
// 		)
// 		const liquidityPoolBalanceUSDC = await usd.balanceOf(liquidityPool.address)
// 		const receipt = await deposit.wait(1)
// 		const event = receipt?.events?.find(x => x.event == "Deposit")
// 		const newBalance = await usd.balanceOf(liquidityProviderAddress)
// 		expect(event?.event).to.eq("Deposit")
// 		expect(balance.sub(newBalance)).to.eq(toUSDC(liquidityPoolUsdcDeposit))
// 		expect(liquidityPoolBalanceUSDC).to.equal(utils.parseUnits(liquidityPoolUsdcDeposit, 6))
// 	})

// 	it("Attacker adds liquidity", async () => {
// 		const [liquidityProvider, attacker] = await ethers.getSigners()
// 		const usdAttacker = usd.connect(attacker)
// 		await usdAttacker.approve(liquidityPool.address, toUSDC(attackerUsdcDeposit))
// 		const wethAttacker = weth.connect(attacker)
// 		const wethDeposit = await wethAttacker.deposit({ value: toWei("99") })
// 		await wethDeposit.wait(1)
// 		const lpAttacker = liquidityPool.connect(attacker)
// 		await wethAttacker.approve(liquidityPool.address, toWei("1"))
// 		const totalSupply = await liquidityPool.totalSupply()
// 		await lpAttacker.deposit(toUSDC(attackerUsdcDeposit), attackerAddress)
// 		const newTotalSupply = await liquidityPool.totalSupply()

// 		const lpBalance = await lpAttacker.balanceOf(attackerAddress)
// 		const difference = newTotalSupply.sub(lpBalance)

// 		const supplyRatio = convertRounded(newTotalSupply) / convertRounded(totalSupply)
// 		// expect(supplyRatio).to.eq(1.1)
// 		expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))
// 	})

// 	let lpCallOption: IOToken
// 	it("LP Writes a WETH/USD put collateralized by WETH for premium to the attacker", async () => {
// 		const [liquidityProvider, attacker] = signers
// 		// registry requires liquidity pool to be owner
// 		optionRegistry.setLiquidityPool(liquidityPool.address)
// 		const amount = toWei("1")
// 		const blockNum = await ethers.provider.getBlockNumber()
// 		const block = await ethers.provider.getBlock(blockNum)
// 		const { timestamp } = block

// 		// opyn contracts require expiration to be at 8:00 UTC

// 		const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
// 		const strikePrice = priceQuote.sub(toWei(strike))
// 		// await usd.connect(attacker).approve(liquidityPool.address, toUSDC("2000"))
// 		// await weth.deposit({ value: amount.mul("5") })
// 		// await weth.approve(liquidityPool.address, amount.mul("5"))
// 		// await liquidityPool.addLiquidity(toUSDC("6000"), amount.mul("4"), 0, 0)
// 		const lpUSDBalanceBefore = await usd.balanceOf(liquidityPool.address)
// 		const proposedSeries = {
// 			expiration: fmtExpiration(expiration),
// 			isPut: true,
// 			strike: BigNumber.from(strikePrice),
// 			strikeAsset: usd.address,
// 			underlying: weth.address,
// 			collateral: usd.address
// 		}
// 		const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
// 		await usd.connect(attacker).approve(liquidityPool.address, toWei("10000000000"))
// 		const write = await liquidityPool.connect(attacker).issueAndWriteOption(proposedSeries, amount)
// 		const receipt = await write.wait(1)
// 		const events = receipt.events
// 		const writeEvent = events?.find(x => x.event == "WriteOption")
// 		const seriesAddress = writeEvent?.args?.series
// 		const callOptionToken = new Contract(seriesAddress, Otoken.abi, attacker) as IOToken
// 		lpCallOption = callOptionToken
// 		const buyerOptionBalance = await callOptionToken.balanceOf(attackerAddress)
// 		//@ts-ignore
// 		const totalInterest = await callOptionToken.totalSupply()
// 		const writersBalance = await optionRegistry.writers(seriesAddress, liquidityPool.address)
// 		const lpUSDBalance = await usd.balanceOf(liquidityPool.address)
// 		const attackerEthBalance = await attacker.getBalance()
// 		const balanceDiff = lpUSDBalanceBefore.sub(lpUSDBalance)
// 		expect(writersBalance).to.eq(amount)
// 		expect(fromOpyn(buyerOptionBalance)).to.eq(fromWei(amount))
// 		expect(fromOpyn(totalInterest)).to.eq(fromWei(amount))
// 	})

// 	it("attacker withdraws liquidity", async () => {
// 		const [liquidityProvider, attacker] = signers
// 		const shares = await liquidityPool.balanceOf(attackerAddress)
// 		const usdcBalanceBefore = await usd.balanceOf(attackerAddress)
// 		const wethBalanceBefore = await wethERC20.balanceOf(attackerAddress)
// 		const lpBalanceBefore = await usd.balanceOf(liquidityPool.address)
// 		await liquidityPool.connect(attacker).withdraw(shares, attackerAddress)
// 		const lpBalanceAfter = await usd.balanceOf(liquidityPool.address)
// 		const usdcBalanceAfter = await usd.balanceOf(attackerAddress)
// 		const wethBalanceAfter = await wethERC20.balanceOf(attackerAddress)
// 		expect(
// 			lpBalanceAfter.sub(lpBalanceBefore.sub(utils.parseUnits(attackerUsdcDeposit, 6)))
// 		).to.be.within(-10, 10)
// 		expect(
// 			usdcBalanceAfter.sub(usdcBalanceBefore.add(utils.parseUnits(attackerUsdcDeposit, 6)))
// 		).to.be.within(-10, 10)
// 	})
// })
