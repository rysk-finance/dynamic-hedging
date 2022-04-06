import hre, { ethers, network } from "hardhat"
import { Contract, utils, Signer } from "ethers"
import { toWei, call, put, createValidExpiry } from "../utils/conversion-helper"
import { expect } from "chai"
import moment from "moment"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import { ERC20Interface } from "../types/ERC20Interface"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistryV0 } from "../types/OptionRegistryV0"
import { Otoken as IOToken } from "../types/Otoken"
import { WETH } from "../types/WETH"
import {
	CHAINLINK_WETH_PRICER,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS,
	ADDRESS_BOOK
} from "./constants"
import { setupOracle, setOpynOracleExpiryPrice } from "./helpers"
let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let optionRegistry: OptionRegistryV0
let optionToken: IOToken
let putOption: IOToken
let erc20CallOption: IOToken
let signers: Signer[]
let senderAddress: string
let receiverAddress: string

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
// First mined block will be timestamped 2021-07-13 20:44 UTC
const expiryDate: string = "2021-08-05"

// time travel period between each expiry
const expiryPeriod = {
	days: 0,
	weeks: 0,
	months: 1,
	years: 0
}

// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
const strike = toWei("3500")

// handles the conversion of expiryDate to a unix timestamp
const now = moment().utc().unix()
let expiration = createValidExpiry(now, 21)

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
	})

	it("Deploys the Option Registry", async () => {
		signers = await ethers.getSigners()
		const [sender] = signers
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		// deploy libraries
		const constantsFactory = await ethers.getContractFactory("Constants")
		const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
		const constants = await constantsFactory.deploy()
		const interactions = await interactionsFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistryV0", {
			libraries: {
				OpynInteractions: interactions.address
			}
		})
		// get and transfer weth
		weth = (await ethers.getContractAt(
			"contracts/interfaces/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		usd = (await ethers.getContractAt("contracts/tokens/ERC20.sol:ERC20", USDC_ADDRESS[chainId])) as MintableERC20
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		await sender.sendTransaction({
			to: signer.address,
			value: ethers.utils.parseEther("1.0") // Sends exactly 1.0 ether
		})
		await usd.connect(signer).transfer(senderAddress, toWei("1000").div(oTokenDecimalShift18))
		await weth.deposit({ value: utils.parseEther("99") })
		const _optionRegistry = (await optionRegistryFactory.deploy(
			USDC_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId]
		)) as OptionRegistryV0
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")
	})

	it("Creates an option token series", async () => {
		const [sender] = signers
		const issue = await optionRegistry.issue(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			call,
			strike,
			WETH_ADDRESS[chainId]
		)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})

	it("opens option token with ETH", async () => {
		const value = toWei("4")

		wethERC20 = (await ethers.getContractAt(
			"ERC20Interface",
			WETH_ADDRESS[chainId]
		)) as ERC20Interface
		const ETHbalanceBefore = await wethERC20.balanceOf(senderAddress)
		await wethERC20.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionToken.address),
			value
		)
		await optionRegistry.open(optionToken.address, value, collatAmount)
		const ETHbalance = await wethERC20.balanceOf(senderAddress)
		const balance = await optionToken.balanceOf(senderAddress)
		expect(balance).to.equal(value.div(oTokenDecimalShift18))
	})

	it("writer transfers part of balance to new account", async () => {
		const sender1Address = receiverAddress
		const transferAmount = toWei("1").div(oTokenDecimalShift18)
		await optionToken.transfer(sender1Address, transferAmount)
		const balance = await optionToken.balanceOf(sender1Address)
		expect(balance).to.equal(transferAmount)
	})

	it("receiver attempts to close and transaction should revert", async () => {
		const [sender, receiver] = signers
		const optionRegistryReceiver = optionRegistry.connect(receiver)
		await expect(optionRegistryReceiver.close(optionToken.address, toWei("1"))).to.be.revertedWith(
			"!liquidityPool"
		)
	})

	it("liquidityPool close and transaction succeeds", async () => {
		const [sender, receiver] = signers
		const value = toWei("1")
		const balanceBef = await optionToken.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistry.connect(sender)
		await optionToken.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		const wethBalanceBefore = await wethERC20.balanceOf(senderAddress)
		await optionRegistrySender.close(optionToken.address, value)
		const balance = await optionToken.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const wethBalance = await wethERC20.balanceOf(senderAddress)
		expect(wethBalance.sub(wethBalanceBefore)).to.equal(toWei("1"))
	})

	it("should not allow anyone outside liquidityPool to open", async () => {
		const value = toWei("2")
		const [sender, receiver] = signers
		await wethERC20.connect(receiver).approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(optionToken.address),
			value
		)
		await expect(
			optionRegistry.connect(receiver).open(optionToken.address, value, collatAmount)
		).to.be.revertedWith("!liquidityPool")
	})

	it("receiver transfers to liquidityPool and closes option token", async () => {
		const value = toWei("1")
		const [sender, receiver] = signers
		await optionToken.connect(receiver).transfer(senderAddress, value.div(oTokenDecimalShift18))
		await optionToken.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		const wethBalanceBefore = await wethERC20.balanceOf(receiverAddress)
		const senderBalanceBefore = await optionToken.balanceOf(senderAddress)
		await optionRegistry.close(optionToken.address, value)
		const senderBalance = await optionToken.balanceOf(senderAddress)
		expect(senderBalanceBefore.sub(senderBalance)).to.equal(toWei("1").div(oTokenDecimalShift18))
		await wethERC20.transfer(receiverAddress, toWei("1"))
		const wethBalance = await wethERC20.balanceOf(receiverAddress)
		expect(wethBalance.sub(wethBalanceBefore)).to.equal(toWei("1"))
	})

	it("settles when option expires ITM", async () => {
		// get balance before
		const balanceWETH = await wethERC20.balanceOf(senderAddress)
		// get the desired settlement price
		const settlePrice = strike.add(toWei("200")).div(oTokenDecimalShift18)
		// get the oracle
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)

		await optionToken.approve(optionRegistry.address, await optionToken.balanceOf(senderAddress))
		// call redeem from the options registry
		await optionRegistry.settle(optionToken.address)
		// check balances are in order
		const newBalanceWETH = await wethERC20.balanceOf(senderAddress)
		const opBalRegistry = await optionToken.balanceOf(optionRegistry.address)
		const ethBalRegistry = await wethERC20.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceWETH > balanceWETH).to.be.true
	})

	it("writer redeems when option expires ITM", async () => {
		// get balance before
		const balanceWETH = await wethERC20.balanceOf(senderAddress)
		await optionToken.approve(optionRegistry.address, await optionToken.balanceOf(senderAddress))
		// call redeem from the options registry
		await optionRegistry.redeem(optionToken.address)
		// check balances are in order
		const newBalanceWETH = await wethERC20.balanceOf(senderAddress)
		const opBalRegistry = await optionToken.balanceOf(optionRegistry.address)
		const opBalSender = await optionToken.balanceOf(senderAddress)
		const ethBalRegistry = await wethERC20.balanceOf(optionRegistry.address)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceWETH > balanceWETH).to.be.true
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})

	it("creates an ERC20 call option token series", async () => {
		const [sender] = signers
		// fast forward expiryPeriod length of time
		expiration = createValidExpiry(expiration, 14)
		const issueCall = await optionRegistry.issue(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			call,
			strike,
			WETH_ADDRESS[chainId]
		)
		await expect(issueCall).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issueCall.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		erc20CallOption = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	it("creates a put option token series", async () => {
		const [sender] = signers
		const issuePut = await optionRegistry.issue(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			put,
			strike,
			USDC_ADDRESS[chainId]
		)
		await expect(issuePut).to.emit(optionRegistry, "OptionTokenCreated")
		let receipt = await (await issuePut).wait(1)
		let events = receipt.events
		//@ts-ignore
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const address = removeEvent?.args?.token
		putOption = new Contract(address, Otoken.abi, sender) as IOToken
	})

	it("opens an ERC20 call option", async () => {
		const value = toWei("4")
		await wethERC20.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(erc20CallOption.address),
			value
		)
		await optionRegistry.open(erc20CallOption.address, value, collatAmount)
		const balance = await erc20CallOption.balanceOf(senderAddress)
		expect(balance).to.be.equal(value.div(oTokenDecimalShift18))
	})
	it("opens put option token position with ETH", async () => {
		const [sender] = signers
		const amount = strike.mul(4)
		await usd.approve(optionRegistry.address, toWei(amount.toString()))
		const collatAmount = await optionRegistry.getCollateral(
			await optionRegistry.seriesInfo(putOption.address),
			toWei("4")
		)
		await optionRegistry.open(putOption.address, toWei("4"), collatAmount)
		const balance = await putOption.balanceOf(senderAddress)
		expect(balance).to.be.equal(toWei("4").div(oTokenDecimalShift18))
	})
	it("writer transfers part of erc20 call balance to new account", async () => {
		const [sender, receiver] = signers
		const value = toWei("1").div(oTokenDecimalShift18)
		await erc20CallOption.transfer(receiverAddress, value)
		const balance = await erc20CallOption.balanceOf(receiverAddress)
		expect(balance).to.be.equal(value)
	})

	it("writer closes not transfered balance on ERC20 call option", async () => {
		const [sender] = signers
		const balanceBef = await erc20CallOption.balanceOf(senderAddress)
		const value = toWei("1")
		await erc20CallOption.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		await optionRegistry.close(erc20CallOption.address, value)
		const balance = await erc20CallOption.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
	})
	it("writer transfers part of put balance to new account", async () => {
		const [sender, receiver] = signers
		await putOption.transfer(receiverAddress, toWei("1").div(oTokenDecimalShift18))
		const balance = await putOption.balanceOf(receiverAddress)
		expect(balance).to.eq(toWei("1").div(oTokenDecimalShift18))
	})

	it("writer closes not transfered balance on put option token", async () => {
		const value = toWei("1")
		const balanceBef = await putOption.balanceOf(senderAddress)
		await putOption.approve(optionRegistry.address, value.div(oTokenDecimalShift18))
		await optionRegistry.close(putOption.address, value)
		const balance = await putOption.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
	})
	it("settles call when option expires OTM", async () => {
		// get balance before
		const balanceWETH = await wethERC20.balanceOf(senderAddress)
		// get the desired settlement price
		const settlePrice = strike.sub(toWei("200")).div(oTokenDecimalShift18)
		// get the oracle
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)

		await erc20CallOption.approve(
			optionRegistry.address,
			await erc20CallOption.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistry.settle(erc20CallOption.address)
		// check balances are in order
		const newBalanceWETH = await wethERC20.balanceOf(senderAddress)
		const opBalRegistry = await erc20CallOption.balanceOf(optionRegistry.address)
		const ethBalRegistry = await wethERC20.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceWETH > balanceWETH).to.be.true
	})

	it("writer redeems call when option expires OTM", async () => {
		// get balance before
		const balanceWETH = await wethERC20.balanceOf(senderAddress)
		await erc20CallOption.approve(
			optionRegistry.address,
			await erc20CallOption.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistry.redeem(erc20CallOption.address)
		// check balances are in order
		const newBalanceWETH = await wethERC20.balanceOf(senderAddress)
		const opBalRegistry = await erc20CallOption.balanceOf(optionRegistry.address)
		const opBalSender = await erc20CallOption.balanceOf(senderAddress)
		const ethBalRegistry = await wethERC20.balanceOf(optionRegistry.address)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceWETH.sub(balanceWETH)).to.equal(0)
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})

	it("settles put when option expires ITM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		// get the desired settlement price
		const settlePrice = strike.sub(toWei("200")).div(oTokenDecimalShift18)
		await putOption.approve(optionRegistry.address, await putOption.balanceOf(senderAddress))
		// call settle from the options registry
		await optionRegistry.settle(putOption.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await putOption.balanceOf(optionRegistry.address)
		const ethBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceUSD > balanceUSD).to.be.true
	})

	it("writer redeems put when option expires ITM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		await putOption.approve(optionRegistry.address, await putOption.balanceOf(senderAddress))
		// call redeem from the options registry
		await optionRegistry.redeem(putOption.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await putOption.balanceOf(optionRegistry.address)
		const opBalSender = await putOption.balanceOf(senderAddress)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD > balanceUSD).to.be.true
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})
})
