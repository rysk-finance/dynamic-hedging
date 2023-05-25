import { expect } from "chai"
import dayjs from "dayjs"
import { Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"
import {
	AlphaPortfolioValuesFeed,
	Authority,
	MintableERC20,
	MockChainlinkAggregator,
	OptionRegistry,
	Oracle,
	Protocol,
	Manager,
	LiquidityPool,
	OptionCatalogue,
	OptionExchange,
	AlphaOptionHandler,
	BeyondPricer,
	WETH
} from "../types"

import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { toUSDC, ZERO_ADDRESS, toWei } from "../utils/conversion-helper"
import { deployOpyn } from "../utils/opyn-deployer"
import { CHAINLINK_WETH_PRICER, CONTROLLER_OWNER } from "./constants"
import { setupTestOracle } from "./helpers"
import { send } from "process"

let usd: MintableERC20
let weth: WETH
let wethERC20: MintableERC20
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let managerContract: Manager
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let portfolioValuesFeed: AlphaPortfolioValuesFeed
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let authority: Authority
let liquidityPool: LiquidityPool
let handler: AlphaOptionHandler
let exchange: OptionExchange
let catalogue: OptionCatalogue
let pricer: BeyondPricer

/* --- variables to change --- */

// edit depending on the chain id to be tested on
const chainId = 1

const expiryDate: string = "2022-04-05"
const expiration = dayjs.utc(expiryDate).add(8, "hours").unix()

/* --- end variables to change --- */

describe("Authority tests", async () => {
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
			params: [CHAINLINK_WETH_PRICER[chainId]]
		})
		signers = await ethers.getSigners()
		let opynParams = await deployOpyn(signers)
		oracle = opynParams.oracle
		const [sender] = signers

		const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
		await sender.sendTransaction({
			to: signer.address,
			value: ethers.utils.parseEther("10.0") // Sends exactly 10.0 ether
		})

		const forceSendContract = await ethers.getContractFactory("ForceSend")
		const forceSend = await forceSendContract.deploy() // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
		await forceSend
			.connect(signer)
			.go(CHAINLINK_WETH_PRICER[chainId], { value: utils.parseEther("0.5") })

		// get the oracle
		const res = await setupTestOracle(await sender.getAddress())
		oracle = res[0] as Oracle
		opynAggregator = res[1] as MockChainlinkAggregator
		let deployParams = await deploySystem(signers, oracle, opynAggregator)
		wethERC20 = deployParams.wethERC20
		usd = deployParams.usd
		weth = deployParams.weth
		optionRegistry = deployParams.optionRegistry
		portfolioValuesFeed = deployParams.portfolioValuesFeed
		optionProtocol = deployParams.optionProtocol
		authority = deployParams.authority as Authority
		let lpParams = await deployLiquidityPool(
			signers,
			optionProtocol,
			usd,
			wethERC20,
			optionRegistry,
			portfolioValuesFeed,
			authority.address
		)
		liquidityPool = lpParams.liquidityPool
		handler = lpParams.handler
		pricer = lpParams.pricer
		catalogue = lpParams.catalogue
		exchange = lpParams.exchange
		signers = await hre.ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8"
		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_WHALE]
		})
		const usdcWhale = await ethers.getSigner(USDC_WHALE)
		const usdWhaleConnect = await usd.connect(usdcWhale)
		await usdWhaleConnect.transfer(senderAddress, toUSDC("1000000"))
		await usdWhaleConnect.transfer(receiverAddress, toUSDC("1000000"))
	})
	describe("Authority push effective immediately", async () => {
		it("SUCCEEDS: set governor", async () => {
			await authority.pushGovernor(receiverAddress)
			expect(await authority.newGovernor()).to.equal(receiverAddress)
			expect(await authority.governor()).to.not.equal(receiverAddress)
			await authority.connect(signers[1]).pullGovernor()
			expect(await authority.governor()).to.equal(receiverAddress)
			expect(await authority.newGovernor()).to.equal(ZERO_ADDRESS)
			// reset governer back to original
			await authority.connect(signers[1]).pushGovernor(senderAddress)
			await authority.pullGovernor()
		})
		it("SUCCEEDS: set manager", async () => {
			await authority.pushManager(receiverAddress)
			expect(await authority.newManager()).to.equal(receiverAddress)
			expect(await authority.manager()).to.not.equal(receiverAddress)
			await authority.connect(signers[1]).pullManager()
			expect(await authority.manager()).to.equal(receiverAddress)
			expect(await authority.newManager()).to.equal(ZERO_ADDRESS)
		})
		it("SUCCEEDS: set guardian", async () => {
			await authority.pushGuardian(receiverAddress)
			expect(await authority.guardian(receiverAddress)).to.be.true
		})
		it("SUCCEEDS: revoke guardian", async () => {
			await authority.revokeGuardian(receiverAddress)
			expect(await authority.guardian(receiverAddress)).to.be.false
		})
		it("FAILS: revoke guardian when not auth", async () => {
			await expect(
				authority.connect(signers[1]).revokeGuardian(senderAddress)
			).to.be.revertedWithCustomError(authority, "UNAUTHORIZED")
		})
		it("FAILS: set governor when not auth", async () => {
			await expect(
				authority.connect(signers[1]).pushGovernor(receiverAddress)
			).to.be.revertedWithCustomError(authority, "UNAUTHORIZED")
		})
		it("FAILS: set manager when not auth", async () => {
			await expect(
				authority.connect(signers[1]).pushManager(receiverAddress)
			).to.be.revertedWithCustomError(authority, "UNAUTHORIZED")
		})
		it("FAILS: set guardian when not auth", async () => {
			await expect(
				authority.connect(signers[1]).pushGuardian(receiverAddress)
			).to.be.revertedWithCustomError(authority, "UNAUTHORIZED")
		})
		it("FAILS: rando tries to pull governor rank", async () => {
			await expect(authority.connect(signers[2]).pullGovernor()).to.be.revertedWith("!newGovernor")
		})
		it("FAILS: rando tries to pull manager rank", async () => {
			await expect(authority.connect(signers[2]).pullManager()).to.be.revertedWith("!newManager")
		})
		it("FAILS: set Governor to zero address", async () => {
			await expect(authority.pushGovernor(ZERO_ADDRESS)).to.be.revertedWithCustomError(
				authority,
				"InvalidAddress"
			)
		})
		it("FAILS: set manager to zero address", async () => {
			await expect(authority.pushManager(ZERO_ADDRESS)).to.be.revertedWithCustomError(
				authority,
				"InvalidAddress"
			)
		})
		it("FAILS: set manager to zero address", async () => {
			await expect(authority.pushGuardian(ZERO_ADDRESS)).to.be.revertedWithCustomError(
				authority,
				"InvalidAddress"
			)
		})
	})
	describe("Proxy Manager contract", async () => {
		it("deploys manager contract", async () => {
			const managerContractFactory = await ethers.getContractFactory("Manager")
			managerContract = (await managerContractFactory.deploy(
				authority.address,
				liquidityPool.address,
				handler.address,
				catalogue.address,
				exchange.address,
				pricer.address
			)) as Manager
		})
		it("sets proxy contract to manager", async () => {
			await authority.pushManager(managerContract.address)
			await managerContract.pullManager()
			expect(await authority.manager()).to.eq(managerContract.address)
		})
		it("sets keeper on proxy contract", async () => {
			expect(await managerContract.keeper(receiverAddress)).to.be.false
			await managerContract.setKeeper(receiverAddress, true)
			expect(await managerContract.keeper(receiverAddress)).to.be.true
		})
		it("sets address as proxy manager", async () => {
			expect(await managerContract.proxyManager()).to.eq(ZERO_ADDRESS)
			await managerContract.setProxyManager(await signers[2].getAddress())
			expect(await managerContract.proxyManager()).to.eq(await signers[2].getAddress())
		})
		it("FAILS: set delta limit when not proxy manager", async () => {
			expect(await managerContract.deltaLimit(receiverAddress)).to.eq(0)
			await expect(
				managerContract.connect(signers[3]).setDeltaLimit([1], [receiverAddress])
			).to.be.revertedWithCustomError(managerContract, "NotProxyManager")
		})
		it("SUCCEEDS: sets delta limit", async () => {
			expect(await managerContract.deltaLimit(receiverAddress)).to.eq(0)

			await managerContract
				.connect(signers[2])
				.setDeltaLimit([utils.parseEther("10")], [receiverAddress])

			expect(await managerContract.deltaLimit(receiverAddress)).to.eq(utils.parseEther("10"))
		})
		it("SUCCEEDS: creates an order in option handler", async () => {
			expect(await handler.orderIdCounter()).to.eq(0)

			const proposedSeries = {
				expiration: expiration,
				strike: utils.parseEther("1400"),
				isPut: true,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}
			const createOrder = await managerContract.createOrder(
				proposedSeries,
				toWei("1"),
				toWei("10"),
				10,
				receiverAddress,
				false,
				[toWei("1"), toWei("1")]
			)
			expect(await handler.orderIdCounter()).to.eq(1)
		})
		it("SUCCEEDS: creates a strangle in option handler", async () => {
			expect(await handler.orderIdCounter()).to.eq(1)

			const proposedSeriesCall = {
				expiration: expiration,
				strike: utils.parseEther("2500"),
				isPut: false,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}

			const proposedSeriesPut = {
				expiration: expiration,
				strike: utils.parseEther("1400"),
				isPut: true,
				strikeAsset: usd.address,
				underlying: weth.address,
				collateral: usd.address
			}

			const createStrangle = await managerContract
				.connect(signers[2])
				.createStrangle(
					proposedSeriesCall,
					proposedSeriesPut,
					toWei("1"),
					toWei("1"),
					toWei("10"),
					toWei("10"),
					10,
					receiverAddress,
					[toWei("1"), toWei("1")],
					[toWei("1"), toWei("1")]
				)

			expect(await handler.orderIdCounter()).to.eq(3)
		})
		it("SUCCEEDS: sets new liquidity pool optionParams", async () => {
			await managerContract.setNewOptionParams(
				toWei("100"),
				toWei("1000000"),
				toWei("100"),
				toWei("1000000"),
				0,
				100000000000
			)
			const newParams = await liquidityPool.optionParams()
			expect(newParams[0]).to.eq(toWei("100"))
			expect(newParams[1]).to.eq(toWei("1000000"))
			expect(newParams[2]).to.eq(toWei("100"))
			expect(newParams[3]).to.eq(toWei("1000000"))
			expect(newParams[4]).to.eq(0)
			expect(newParams[5]).to.eq(100000000000)
		})
		it("calls redeem on liquidityPool", async () => {
			await expect(managerContract.redeem([], [1])).to.be.revertedWithCustomError(
				exchange,
				"InvalidInput"
			)
		})
		it("SUCCEEDS: calls issueNewSeries on catalogue", async () => {
			const oHash = ethers.utils.solidityKeccak256(
				["uint64", "uint128", "bool"],
				[expiration, toWei("2500"), false]
			)

			expect(await catalogue.approvedOptions(oHash)).to.be.false
			expect(await catalogue.isSellable(oHash)).to.be.false
			expect(await catalogue.isBuyable(oHash)).to.be.false

			await expect(
				managerContract.issueNewSeries([
					{
						expiration: expiration,
						isPut: false,
						strike: toWei("2500"),
						isSellable: true,
						isBuyable: true
					}
				])
			).to.not.be.reverted

			expect(await catalogue.approvedOptions(oHash)).to.be.true
			expect(await catalogue.isSellable(oHash)).to.be.true
			expect(await catalogue.isBuyable(oHash)).to.be.true
		})
		it("SUCCEEDS: changes series to not buyable", async () => {
			const oHash = ethers.utils.solidityKeccak256(
				["uint64", "uint128", "bool"],
				[expiration, toWei("2500"), false]
			)

			expect(await catalogue.approvedOptions(oHash)).to.be.true
			expect(await catalogue.isSellable(oHash)).to.be.true
			expect(await catalogue.isBuyable(oHash)).to.be.true

			await managerContract.changeOptionBuyOrSell([
				{
					expiration: expiration,
					isPut: false,
					strike: toWei("2500"),
					isSellable: false,
					isBuyable: false
				}
			])

			expect(await catalogue.approvedOptions(oHash)).to.be.true
			expect(await catalogue.isSellable(oHash)).to.be.false
			expect(await catalogue.isBuyable(oHash)).to.be.false
		})
		it("SUCCEEDS: sets slippageGradient in beyond pricer", async () => {
			await managerContract.setSlippageGradient(1000000)
			expect(await pricer.slippageGradient()).to.eq(1000000)
		})
		it("SUCCEEDS: sets collateralLendingRate in beyond pricer", async () => {
			await managerContract.setCollateralLendingRate(1000000)
			expect(await pricer.collateralLendingRate()).to.eq(1000000)
		})
		it("SUCCEEDS: sets DeltaBorrowRate in beyond pricer", async () => {
			await managerContract.setDeltaBorrowRates({
				sellLong: 1000001,
				sellShort: 1000002,
				buyLong: 1000003,
				buyShort: 1000004
			})
			expect((await pricer.deltaBorrowRates()).sellLong).to.eq(1000001)
			expect((await pricer.deltaBorrowRates()).sellShort).to.eq(1000002)
			expect((await pricer.deltaBorrowRates()).buyLong).to.eq(1000003)
			expect((await pricer.deltaBorrowRates()).buyShort).to.eq(1000004)
		})

		it("SUCCEEDS: sets slippageMultipliers in beyond pricer", async () => {
			expect((await pricer.getCallSlippageGradientMultipliers(0))[0]).to.eq(utils.parseEther("1"))
			await managerContract.setSlippageGradientMultipliers(
				0,
				[
					utils.parseEther("10"),
					utils.parseEther("20"),
					utils.parseEther("30"),
					utils.parseEther("40"),
					utils.parseEther("50"),
					utils.parseEther("60"),
					utils.parseEther("70"),
					utils.parseEther("80"),
					utils.parseEther("90"),
					utils.parseEther("100"),
					utils.parseEther("110"),
					utils.parseEther("120"),
					utils.parseEther("130"),
					utils.parseEther("140"),
					utils.parseEther("150"),
					utils.parseEther("160"),
					utils.parseEther("170"),
					utils.parseEther("180"),
					utils.parseEther("190"),
					utils.parseEther("200")
				],
				[
					utils.parseEther("10"),
					utils.parseEther("20"),
					utils.parseEther("30"),
					utils.parseEther("40"),
					utils.parseEther("50"),
					utils.parseEther("60"),
					utils.parseEther("70"),
					utils.parseEther("80"),
					utils.parseEther("90"),
					utils.parseEther("100"),
					utils.parseEther("110"),
					utils.parseEther("120"),
					utils.parseEther("130"),
					utils.parseEther("140"),
					utils.parseEther("150"),
					utils.parseEther("160"),
					utils.parseEther("170"),
					utils.parseEther("180"),
					utils.parseEther("190"),
					utils.parseEther("200")
				]
			)
			expect((await pricer.getCallSlippageGradientMultipliers(0))[7]).to.eq(utils.parseEther("80"))
		})
	})
})
