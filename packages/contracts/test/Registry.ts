import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Contract, Signer, utils } from "ethers"
import { AbiCoder } from "ethers/lib/utils"
import hre, { ethers, network } from "hardhat"

import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import { ERC20Interface, MintableERC20, NewController, NewMarginCalculator, OpynInteractions, Oracle, Otoken as IOToken, WETH } from "../types"
import { OptionRegistry, OptionSeriesStruct } from "../types/OptionRegistry"
import { call, createValidExpiry, MAX_BPS, put, toOpyn, toWei, ZERO_ADDRESS } from "../utils/conversion-helper"
import { deployOpyn } from "../utils/opyn-deployer"
import {
	ADDRESS_BOOK,
	CHAINLINK_WETH_PRICER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS
} from "./constants"
import { setOpynOracleExpiryPrice, setupOracle } from "./helpers"

dayjs.extend(utc)

let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let controller: NewController
let newCalculator: NewMarginCalculator
let oracle: Oracle
let optionRegistry: OptionRegistry
let optionRegistryETH: OptionRegistry
let optionTokenUSDC: IOToken
let optionTokenETH: IOToken
let erc20CallOptionUSDC: IOToken
let erc20CallOptionETH: IOToken
let erc20PutOptionUSDC: IOToken
let erc20PutOptionETH: IOToken
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let proposedSeries: OptionSeriesStruct
let proposedSeriesETH: OptionSeriesStruct
let interactions: OpynInteractions

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2022-02-27 19:05 UTC
const expiryDate: string = "2022-04-05"
// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
const usdDecimalShift18 = 1000000000000
const strike = toWei("3500")

// handles the conversion of expiryDate to a unix timestamp
let expiration = dayjs.utc(expiryDate).add(8, "hours").unix()

describe("Options protocol", function () {
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
		signers = await ethers.getSigners()
		let opynParams = await deployOpyn(signers)
		controller = opynParams.controller
		oracle = opynParams.oracle
		newCalculator = opynParams.newCalculator
	})

	it("Deploys the Option Registry", async () => {
		signers = await ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		const authorityFactory = await hre.ethers.getContractFactory("Authority")
		const authority = await authorityFactory.deploy(senderAddress, senderAddress, senderAddress)
		// get and transfer weth
		weth = (await ethers.getContractAt(
			"contracts/interfaces/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		usd = (await ethers.getContractAt(
			"contracts/tokens/ERC20.sol:ERC20",
			USDC_ADDRESS[chainId]
		)) as MintableERC20
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		await usd.connect(signer).transfer(senderAddress, toWei("1000000").div(usdDecimalShift18))
		await usd.connect(signer).transfer(receiverAddress, toWei("1000000").div(usdDecimalShift18))
		await weth.deposit({ value: utils.parseEther("99") })
		// deploy libraries
		const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
		interactions = (await interactionsFactory.deploy())
		const computeFactory = await hre.ethers.getContractFactory("contracts/libraries/OptionsCompute.sol:OptionsCompute")
		const compute = await computeFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
			libraries: {
				OpynInteractions: interactions.address,
				OptionsCompute: compute.address
						}
			})
		const _optionRegistry = (await optionRegistryFactory.deploy(
			USDC_ADDRESS[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId],
			authority.address
		)) as OptionRegistry
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")
		const _optionRegistryETH = (await optionRegistryFactory.deploy(
			WETH_ADDRESS[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId],
			authority.address
		)) as OptionRegistry
		optionRegistryETH = _optionRegistryETH
		expect(optionRegistryETH).to.have.property("deployTransaction")
	})

	it("Creates a USDC collataralised call option token series", async () => {
		const [sender] = signers
		proposedSeries = {
			expiration: expiration,
			strike: strike,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issue = await optionRegistry.issue(proposedSeries)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	it("Reverts: Tries to close oToken series that doesnt have a vault", async () => {
		await expect(
			optionRegistry.close(optionTokenUSDC.address, toWei("2"))
		).to.be.revertedWithCustomError(optionRegistry, "NoVault")
	})
	it("Returns correct oToken when calling getOrDeployOtoken", async () => {
		const [sender] = signers
		const issue = await optionRegistry.issue(proposedSeries)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		expect(seriesAddress).to.equal(optionTokenUSDC.address)
	})
	it("Returns correct oToken when calling getOToken", async () => {
		const [sender] = signers
		const issue = await optionRegistry.getOtoken(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			call,
			strike,
			USDC_ADDRESS[chainId]
		)
		expect(issue).to.equal(optionTokenUSDC.address)
	})
	it("Returns zero addy if option doesnt exist", async () => {
		const [sender] = signers
		const issue = await optionRegistry.getOtoken(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			put,
			strike,
			USDC_ADDRESS[chainId]
		)
		expect(issue).to.equal(ZERO_ADDRESS)
	})
	it("Creates a ETH collataralised call option token series", async () => {
		const [sender] = signers
		proposedSeriesETH = {
			expiration: expiration,
			strike: strike,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: WETH_ADDRESS[chainId]
		}
		const issue = await optionRegistryETH.issue(proposedSeriesETH)
		await expect(issue).to.emit(optionRegistryETH, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenETH = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	let marginReqUSD: BigNumber
	let marginReqETH: BigNumber
	it("opens call option token with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		marginReqUSD = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		marginReqUSD = (await optionRegistry.callUpperHealthFactor()).mul(marginReqUSD).div(MAX_BPS)
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC.address, value, collatAmount)
		const USDbalance = await usd.balanceOf(senderAddress)
		const balance = await optionTokenUSDC.balanceOf(senderAddress)
		expect(balance).to.equal(value.div(oTokenDecimalShift18))
		expect(USDbalanceBefore.sub(USDbalance)).to.equal(marginReqUSD)
	})

	it("opens call option token with ETH", async () => {
		const value = toWei("4")

		wethERC20 = (await ethers.getContractAt(
			"ERC20Interface",
			WETH_ADDRESS[chainId]
		)) as ERC20Interface
		const ETHbalanceBefore = await wethERC20.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		marginReqETH = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		marginReqETH = (await optionRegistry.callUpperHealthFactor()).mul(marginReqETH).div(MAX_BPS)
		await wethERC20.approve(optionRegistryETH.address, value)
		const collatAmount = await optionRegistryETH.getCollateral(
			await optionRegistryETH.seriesInfo(optionTokenETH.address),
			value
		)
		await optionRegistryETH.open(optionTokenETH.address, value, collatAmount)
		const ETHbalance = await wethERC20.balanceOf(senderAddress)
		const balance = await optionTokenETH.balanceOf(senderAddress)
		expect(balance).to.equal(value.div(oTokenDecimalShift18))
		expect(ETHbalanceBefore.sub(ETHbalance)).to.equal(marginReqETH)
	})

	it("writer transfers part of balance to new account", async () => {
		const sender1Address = receiverAddress
		const transferAmount = toWei("1").div(oTokenDecimalShift18)
		await optionTokenUSDC.transfer(sender1Address, transferAmount)
		const balance = await optionTokenUSDC.balanceOf(sender1Address)
		expect(balance).to.equal(transferAmount)
		await optionTokenETH.transfer(sender1Address, transferAmount)
		const newBalance = await optionTokenETH.balanceOf(sender1Address)
		expect(newBalance).to.equal(transferAmount)
	})

	it("receiver attempts to close and transaction should revert", async () => {
		const [sender, receiver] = signers
		const optionRegistryReceiver = optionRegistry.connect(receiver)
		await expect(
			optionRegistryReceiver.close(optionTokenUSDC.address, toWei("1"))
		).to.be.revertedWithCustomError(optionRegistry, "NotLiquidityPool")
		const optionRegistryReceiverETH = optionRegistryETH.connect(receiver)
		await expect(
			optionRegistryReceiverETH.close(optionTokenETH.address, toWei("1"))
		).to.be.revertedWithCustomError(optionRegistry, "NotLiquidityPool")
	})

	it("opens call option again with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		const oBalanceBef = await optionTokenUSDC.balanceOf(senderAddress)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		marginReq = (await optionRegistry.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC.address),
			value
		)
		await optionRegistry.open(optionTokenUSDC.address, value, collatAmount)
		const USDbalance = await usd.balanceOf(senderAddress)
		const balance = await optionTokenUSDC.balanceOf(senderAddress)
		expect(balance).to.equal(oBalanceBef.add(value.div(oTokenDecimalShift18)))
		expect(USDbalanceBefore.sub(USDbalance)).to.equal(marginReq)
		expect(marginReqUSD).to.equal(marginReq)
	})

	it("opens call option again with ETH", async () => {
		const value = toWei("4")
		const ETHbalanceBefore = await wethERC20.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		const oBalanceBef = await optionTokenETH.balanceOf(senderAddress)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		marginReq = (await optionRegistryETH.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		await wethERC20.approve(optionRegistryETH.address, value)
		const collatAmount = await optionRegistryETH.getCollateral(
			await optionRegistryETH.seriesInfo(optionTokenETH.address),
			value
		)
		await optionRegistryETH.open(optionTokenETH.address, value, collatAmount)
		const ETHbalance = await wethERC20.balanceOf(senderAddress)
		const balance = await optionTokenETH.balanceOf(senderAddress)
		expect(balance).to.equal(oBalanceBef.add(value.div(oTokenDecimalShift18)))
		expect(ETHbalanceBefore.sub(ETHbalance)).to.equal(marginReq)
		expect(marginReqETH).to.equal(marginReq)
	})

	it("liquidityPool close and transaction succeeds", async () => {
		const [sender, receiver] = signers
		const value = toWei("1")
		const balanceBef = await optionTokenUSDC.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistry.connect(sender)
		await optionTokenUSDC.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		const usdBalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		marginReq = (await optionRegistryETH.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		await optionRegistrySender.close(optionTokenUSDC.address, value)
		const balance = await optionTokenUSDC.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const usdBalance = await usd.balanceOf(senderAddress)
		expect(usdBalance.sub(usdBalanceBefore).sub(marginReq)).to.be.within(-1, 1)
	})
	it("reverts liquidityPool because of non-existent series", async () => {
		const [sender, receiver] = signers
		const value = toWei("1")
		const balanceBef = await optionTokenUSDC.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistry.connect(sender)
		await optionTokenUSDC.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		const usdBalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false
		)
		marginReq = (await optionRegistryETH.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		await expect(optionRegistrySender.close(weth.address, value)).to.be.revertedWithCustomError(
			optionRegistry,
			"NonExistentSeries"
		)
	})
	it("liquidityPool close and transaction succeeds ETH options", async () => {
		const [sender, receiver] = signers
		const value = toWei("1")
		const balanceBef = await optionTokenETH.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistryETH.connect(sender)
		await optionTokenETH.approve(optionRegistryETH.address, value.div(oTokenDecimalShift18))
		const ethBalanceBefore = await wethERC20.balanceOf(senderAddress)
		const underlyingPrice = await oracle.getPrice(weth.address)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false
		)
		marginReq = (await optionRegistryETH.callUpperHealthFactor()).mul(marginReq).div(MAX_BPS)
		await optionRegistrySender.close(optionTokenETH.address, value)
		const balance = await optionTokenETH.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const ethBalance = await wethERC20.balanceOf(senderAddress)
		const diff = ethBalance.sub(ethBalanceBefore)
		expect(diff.sub(marginReq)).to.be.within(-1, 1)
	})
	it("should not allow anyone outside liquidityPool to open", async () => {
		const value = toWei("2")
		const [sender, receiver] = signers
		await usd.connect(receiver).approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionTokenUSDC.address),
			value
		)
		await expect(
			optionRegistry.connect(receiver).open(optionTokenUSDC.address, value, collatAmount)
		).to.be.revertedWithCustomError(optionRegistry, "NotLiquidityPool")
	})
	it("Fails to settle early", async () => {
		await expect(optionRegistry.settle(optionTokenUSDC.address)).to.be.revertedWithCustomError(
			optionRegistry,
			"NotExpired"
		)
	})
	it("Fails to redeem early", async () => {
		await expect(optionRegistry.redeem(optionTokenUSDC.address)).to.be.revertedWithCustomError(
			optionRegistry,
			"NotExpired"
		)
	})
	it("Fails to settle non-existent option", async () => {
		await expect(optionRegistry.settle(ZERO_ADDRESS)).to.be.revertedWithCustomError(
			optionRegistry,
			"NonExistentSeries"
		)
	})
	it("Fails to redeem non-existent option", async () => {
		await expect(optionRegistry.redeem(ZERO_ADDRESS)).to.be.revertedWithCustomError(
			optionRegistry,
			"NonExistentSeries"
		)
	})
	it("SUCCEED: sets operator on registry", async () => {
		await optionRegistry.setOperator(receiverAddress, true)
		expect(await controller.isOperator(optionRegistry.address, receiverAddress)).to.be.true
	})
	it("SUCCEED: theoretical new option registry operates on old option registry behalf", async () => {
		const [sender, receiver] = signers
		const abiCode = new AbiCoder()
		const currentPrice = await oracle.getPrice(weth.address)
		const vaultId = await (await controller.getAccountVaultCounter(optionRegistry.address)).add(1)
		let marginReq = await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			toOpyn("1"),
			strike.div(oTokenDecimalShift18),
			currentPrice,
			expiration,
			6,
			false
		)
		await usd.connect(receiver).approve(MARGIN_POOL[chainId], marginReq.add(1))
		const mintArgs = [
			{
				actionType: 0,
				owner: optionRegistry.address,
				secondAddress: receiverAddress,
				asset: ZERO_ADDRESS,
				vaultId: vaultId,
				amount: "0",
				index: 0,
				data: abiCode.encode(["uint256"], ["1"])
			},
			{
				actionType: 5,
				owner: optionRegistry.address,
				secondAddress: receiverAddress,
				asset: usd.address,
				vaultId: vaultId,
				amount: marginReq,
				index: 0,
				data: ZERO_ADDRESS
			},
			{
				actionType: 1,
				owner: optionRegistry.address,
				secondAddress: receiverAddress,
				asset: optionTokenUSDC.address,
				vaultId: vaultId,
				amount: toOpyn("1"),
				index: 0,
				data: ZERO_ADDRESS
			}
		]
		await controller.connect(receiver).operate(mintArgs)

	})
	it("#fastforwards time and sets oracle price", async () => {
		const diff = 200
		// get the desired settlement price
		const settlePrice = strike.add(toWei(diff.toString())).div(oTokenDecimalShift18)
		// get the oracle
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)
	})
	it("Fails to create a USDC collataralised call option token series when expired", async () => {
		const [sender] = signers
		await expect(optionRegistry.issue(proposedSeries)).to.be.revertedWithCustomError(
			optionRegistry,
			"AlreadyExpired"
		)
	})
	it("Fails to open a USDC collataralised call option token series when expired", async () => {
		const [sender] = signers
		await expect(
			optionRegistry.open(optionTokenUSDC.address, toWei("1"), toWei("1"))
		).to.be.revertedWithCustomError(optionRegistry, "AlreadyExpired")
	})
	it("Fails to close a USDC collataralised call option token series when expired", async () => {
		const [sender] = signers
		await expect(
			optionRegistry.close(optionTokenUSDC.address, toWei("1"))
		).to.be.revertedWithCustomError(optionRegistry, "AlreadyExpired")
	})
	it("settles when option expires ITM USD collateral", async () => {
		const [sender, receiver] = signers
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		const diff = 200
		const opUSDbal = (
			await controller.getVault(optionRegistry.address, await optionRegistry.vaultCount())
		).shortAmounts[0]
		const collatBal = (
			await controller.getVault(optionRegistry.address, await optionRegistry.vaultCount())
		).collateralAmounts[0]
		// call redeem from the options registry
		await optionRegistry.settle(optionTokenUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenUSDC.balanceOf(optionRegistry.address)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(collatBal.sub(opUSDbal.mul(diff).div(100)))
	})
	it("reverts when attempt to settle again", async () => {
		await expect(optionRegistry.settle(optionTokenUSDC.address)).to.be.revertedWithCustomError(
			interactions,
			"NoShort"
		)
	})
	it("settles when option expires ITM ETH collateral", async () => {
		const [sender, receiver] = signers
		// get balance before
		const balanceETH = await wethERC20.balanceOf(senderAddress)
		await optionTokenETH.approve(
			optionRegistryETH.address,
			await optionTokenETH.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistryETH.settle(optionTokenETH.address)
		// check balances are in order
		const newBalanceETH = await wethERC20.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenETH.balanceOf(optionRegistryETH.address)
		const ethBalRegistry = await wethERC20.balanceOf(optionRegistryETH.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceETH > balanceETH).to.be.true
	})

	it("writer redeems when option expires ITM USD collateral", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		const opUSDbal = await optionTokenUSDC.balanceOf(senderAddress)
		const diff = 200
		await optionTokenUSDC.approve(
			optionRegistry.address,
			await optionTokenUSDC.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistry.redeem(optionTokenUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenUSDC.balanceOf(optionRegistry.address)
		const opBalSender = await optionTokenUSDC.balanceOf(senderAddress)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(opUSDbal.mul(diff).div(100))
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})
	it("Fails when writer redeems twice", async () => {
		await expect(optionRegistry.redeem(optionTokenUSDC.address)).to.be.revertedWithCustomError(
			optionRegistry,
			"InsufficientBalance"
		)
	})
	it("writer redeems when option expires ITM ETH collateral", async () => {
		// get balance before
		const balanceETH = await wethERC20.balanceOf(senderAddress)
		await optionTokenETH.approve(
			optionRegistryETH.address,
			await optionTokenETH.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistryETH.redeem(optionTokenETH.address)
		// check balances are in order
		const newBalanceETH = await wethERC20.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenETH.balanceOf(optionRegistryETH.address)
		const opBalSender = await optionTokenETH.balanceOf(senderAddress)
		const ethBalRegistry = await wethERC20.balanceOf(optionRegistryETH.address)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceETH > balanceETH).to.be.true
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})

	it("creates a USDC collateralised call option token series", async () => {
		const [sender] = signers
		// fast forward expiryPeriod length of time
		expiration = createValidExpiry(expiration, 14)
		proposedSeries = {
			expiration: expiration,
			strike: strike,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issueCall = await optionRegistry.issue(proposedSeries)
		await expect(issueCall).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issueCall.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		erc20CallOptionUSDC = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})

	it("creates a ETH collateralised call option token series", async () => {
		const [sender] = signers
		proposedSeriesETH = {
			expiration: expiration,
			strike: strike,
			isPut: call,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: WETH_ADDRESS[chainId]
		}
		const issueCall = await optionRegistryETH.issue(proposedSeriesETH)
		await expect(issueCall).to.emit(optionRegistryETH, "OptionTokenCreated")
		const receipt = await issueCall.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		erc20CallOptionETH = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})

	it("creates a USDC put option token series", async () => {
		const [sender] = signers
		proposedSeries = {
			expiration: expiration,
			strike: strike,
			isPut: put,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: USDC_ADDRESS[chainId]
		}
		const issuePut = await optionRegistry.issue(proposedSeries)
		await expect(issuePut).to.emit(optionRegistry, "OptionTokenCreated")
		let receipt = await (await issuePut).wait(1)
		let events = receipt.events
		//@ts-ignore
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const address = removeEvent?.args?.token
		erc20PutOptionUSDC = new Contract(address, Otoken.abi, sender) as IOToken
	})

	it("creates a ETH put option token series", async () => {
		const [sender] = signers
		proposedSeriesETH = {
			expiration: expiration,
			strike: strike,
			isPut: put,
			underlying: WETH_ADDRESS[chainId],
			strikeAsset: USDC_ADDRESS[chainId],
			collateral: WETH_ADDRESS[chainId]
		}
		const issuePut = await optionRegistryETH.issue(proposedSeriesETH)
		await expect(issuePut).to.emit(optionRegistryETH, "OptionTokenCreated")
		let receipt = await (await issuePut).wait(1)
		let events = receipt.events
		//@ts-ignore
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const address = removeEvent?.args?.token
		erc20PutOptionETH = new Contract(address, Otoken.abi, sender) as IOToken
	})

	it("opens put option token position", async () => {
		const [sender] = signers
		const amount = strike.mul(4)
		await usd.approve(optionRegistry.address, toWei(amount.toString()))
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(erc20PutOptionUSDC.address),
			toWei("4")
		)
		await optionRegistry.open(erc20PutOptionUSDC.address, toWei("4"), collatAmount)
		const balance = await erc20PutOptionUSDC.balanceOf(senderAddress)
		expect(balance).to.be.equal(toWei("4").div(oTokenDecimalShift18))
		await weth.approve(optionRegistryETH.address, toWei(amount.toString()))
		const collatAmountETH = await optionRegistryETH.getCollateral(
			await optionRegistryETH.seriesInfo(erc20PutOptionETH.address),
			toWei("4")
		)
		await optionRegistryETH.open(erc20PutOptionETH.address, toWei("4"), collatAmountETH)
		const newBalance = await erc20PutOptionETH.balanceOf(senderAddress)
		expect(newBalance).to.be.equal(toWei("4").div(oTokenDecimalShift18))
	})
	it("opens an ERC20 call option", async () => {
		const value = toWei("4")
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(erc20CallOptionUSDC.address),
			value
		)
		await optionRegistry.open(erc20CallOptionUSDC.address, value, collatAmount)
		const balance = await erc20CallOptionUSDC.balanceOf(senderAddress)
		expect(balance).to.be.equal(value.div(oTokenDecimalShift18))
		await wethERC20.approve(optionRegistryETH.address, value)
		const collatAmountETH = await optionRegistryETH.getCollateral(
			await optionRegistryETH.seriesInfo(erc20CallOptionETH.address),
			value
		)
		await optionRegistryETH.open(erc20CallOptionETH.address, value, collatAmountETH)
		const newBalance = await erc20CallOptionETH.balanceOf(senderAddress)
		expect(newBalance).to.be.equal(value.div(oTokenDecimalShift18))
	})

	it("writer transfers part of erc20 call balance to new account", async () => {
		const [sender, receiver] = signers
		const value = toWei("1").div(oTokenDecimalShift18)
		await erc20CallOptionUSDC.transfer(receiverAddress, value)
		const balance = await erc20CallOptionUSDC.balanceOf(receiverAddress)
		expect(balance).to.be.equal(value)
		await erc20CallOptionETH.transfer(receiverAddress, value)
		const newBalance = await erc20CallOptionETH.balanceOf(receiverAddress)
		expect(newBalance).to.be.equal(value)
	})

	it("writer closes not transfered balance on ERC20 call option", async () => {
		const [sender] = signers
		const balanceBef = await erc20CallOptionUSDC.balanceOf(senderAddress)
		const value = toWei("1")
		await erc20CallOptionUSDC.approve(optionRegistry.address, value)
		await optionRegistry.close(erc20CallOptionUSDC.address, value)
		const balance = await erc20CallOptionUSDC.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
	})

	it("writer transfers part of put balance to new account", async () => {
		const [sender, receiver] = signers
		await erc20PutOptionUSDC.transfer(receiverAddress, toWei("1").div(oTokenDecimalShift18))
		const balance = await erc20PutOptionUSDC.balanceOf(receiverAddress)
		expect(balance).to.eq(toWei("1").div(oTokenDecimalShift18))
		await erc20PutOptionETH.transfer(receiverAddress, toWei("1").div(oTokenDecimalShift18))
		const newBalance = await erc20PutOptionETH.balanceOf(receiverAddress)
		expect(newBalance).to.eq(toWei("1").div(oTokenDecimalShift18))
	})

	it("writer closes not transfered balance on put option token", async () => {
		const value = toWei("1")
		const balanceBef = await erc20PutOptionUSDC.balanceOf(senderAddress)
		await erc20PutOptionUSDC.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		await optionRegistry.close(erc20PutOptionUSDC.address, value)
		const balance = await erc20PutOptionUSDC.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const balanceBefore = await erc20PutOptionETH.balanceOf(senderAddress)
		await erc20PutOptionETH.approve(optionRegistryETH.address, value.div(oTokenDecimalShift18))
		await optionRegistryETH.close(erc20PutOptionETH.address, value)
		const newBalance = await erc20PutOptionETH.balanceOf(senderAddress)
		expect(balanceBefore.sub(newBalance)).to.equal(value.div(oTokenDecimalShift18))
	})

	it("settles call when option expires OTM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		// get the desired settlement price
		const settlePrice = strike.sub(toWei("200")).div(oTokenDecimalShift18)
		// collateralBalance
		const collatBalance = (
			await controller.getVault(optionRegistry.address, (await (await optionRegistry.vaultCount()).add(1)))
		).collateralAmounts[0]
		// get the oracle
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)
		// call settle from the options registry
		await optionRegistry.settle(erc20CallOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20CallOptionUSDC.balanceOf(optionRegistry.address)
		const ethBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(collatBalance)
	})

	it("writer redeems call when option expires OTM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		await erc20CallOptionUSDC.approve(
			optionRegistry.address,
			await erc20CallOptionUSDC.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistry.redeem(erc20CallOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20CallOptionUSDC.balanceOf(optionRegistry.address)
		const opBalSender = await erc20CallOptionUSDC.balanceOf(senderAddress)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(0)
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})

	it("settles put when option expires ITM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		const diff = 200
		// get the desired settlement price
		const settlePrice = strike.sub(toWei(diff.toString())).div(oTokenDecimalShift18)
		const opUSDbal = (
			await controller.getVault(optionRegistry.address, (await optionRegistry.vaultCount()))
		).shortAmounts[0]
		const collatBal = (
			await controller.getVault(optionRegistry.address, (await optionRegistry.vaultCount()))
		).collateralAmounts[0]
		// call settle from the options registry
		await optionRegistry.settle(erc20PutOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20PutOptionUSDC.balanceOf(optionRegistry.address)
		const ethBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(collatBal.sub(opUSDbal.mul(diff).div(100)))
	})

	it("writer redeems put when option expires ITM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		const diff = 200
		// get the desired settlement price
		const settlePrice = strike.sub(toWei(diff.toString())).div(oTokenDecimalShift18)
		await erc20PutOptionUSDC.approve(
			optionRegistry.address,
			await erc20PutOptionUSDC.balanceOf(senderAddress)
		)
		const opUSDbal = await erc20PutOptionUSDC.balanceOf(senderAddress)
		// call redeem from the options registry
		await optionRegistry.redeem(erc20PutOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20PutOptionUSDC.balanceOf(optionRegistry.address)
		const opBalSender = await erc20PutOptionUSDC.balanceOf(senderAddress)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD.sub(balanceUSD)).to.equal(opUSDbal.mul(diff).div(100))
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})

	it("sets the health threshold", async () => {
		await optionRegistry.setHealthThresholds(1000, 1000, 1000, 1000)
		expect(await optionRegistry.putLowerHealthFactor()).to.equal(1000)
		expect(await optionRegistry.putUpperHealthFactor()).to.equal(1000)
		expect(await optionRegistry.callLowerHealthFactor()).to.equal(1000)
		expect(await optionRegistry.callUpperHealthFactor()).to.equal(1000)
		await expect(optionRegistry.connect(signers[1]).setHealthThresholds(1000, 1000, 1000, 1000)).to.be
			.reverted
	})
	it("gets the series via issuance hash", async () => {
		const issuance = await optionRegistry.getIssuanceHash(
			await optionRegistry.getSeriesInfo(optionTokenUSDC.address)
		)
		const series = await optionRegistry.getSeriesAddress(issuance)
		expect(series).to.equal(optionTokenUSDC.address)
	})
	it("gets the series via series", async () => {
		const series = await optionRegistry.getSeries(
			await optionRegistry.getSeriesInfo(optionTokenUSDC.address)
		)
		expect(series).to.equal(optionTokenUSDC.address)
	})
})
