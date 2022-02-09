import hre, { ethers, network } from "hardhat"
import {
	BigNumberish,
	Contract,
	ContractFactory,
	utils,
	Signer,
	BigNumber
} from "ethers"
import { MockProvider } from "@ethereum-waffle/provider"
import {
	toWei,
	truncate,
	tFormatEth,
	call,
	put,
	genOptionTimeFromUnix,
	fromWei,
	fromUSDC,
	getDiffSeconds,
	convertRounded,
	percentDiffArr,
	percentDiff,
	toUSDC,
	fmtExpiration,
	fromOpyn,
	toOpyn,
	tFormatUSDC
} from "../utils"
import {
	deployMockContract,
	MockContract
} from "@ethereum-waffle/mock-contract"
import moment from "moment"
import AggregatorV3Interface from "../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json"
import { AggregatorV3Interface as IAggregatorV3 } from "../types/AggregatorV3Interface"
//@ts-ignore
import bs from "black-scholes"
import { expect } from "chai"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import LiquidityPoolSol from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json"
import { ERC20 } from "../types/ERC20"
import { ERC20Interface } from "../types/ERC20Interface"
import { MintableERC20 } from "../types/MintableERC20"
import { OpynOptionRegistry } from "../types/OpynOptionRegistry"
import { Otoken as IOToken } from "../types/Otoken"
import { PriceFeed } from "../types/PriceFeed"
import { LiquidityPools } from "../types/LiquidityPools"
import { LiquidityPool } from "../types/LiquidityPool"
import { Volatility } from "../types/Volatility"
import { WETH } from "../types/WETH"
import { Protocol } from "../types/Protocol"
import {
	CHAINLINK_WETH_PRICER,
	CHAINID,
	ETH_PRICE_ORACLE,
	USDC_PRICE_ORACLE,
	GAMMA_CONTROLLER,
	MARGIN_POOL,
	OTOKEN_FACTORY,
	USDC_ADDRESS,
	USDC_OWNER_ADDRESS,
	WETH_ADDRESS,
	ORACLE_LOCKING_PERIOD
} from "./constants"
import { setupOracle, setOpynOracleExpiryPrice } from "./helpers"
import { send } from "process"
import { convertDoubleToDec } from "../utils/math"
import { OptionRegistry } from "../types/OptionRegistry"

const IMPLIED_VOL = "60"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
// Aug 13th 2021 8am
// TODO: figure out better way to do this
let expiration = 1628841600

// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
const strike = toWei("3500")

let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let currentTime: moment.Moment
let optionRegistry: OpynOptionRegistry
let optionToken: IOToken
let putOption: IOToken
let erc20PutOption: IOToken
let erc20CallOption: IOToken
let optionProtocol: Protocol
let erc20CallExpiration: moment.Moment
let putOptionExpiration: moment.Moment
let erc20PutOptionExpiration: moment.Moment
let erc20Token: ERC20
let signers: Signer[]
let volatility: Volatility
let senderAddress: string
let receiverAddress: string

describe("Options protocol", function () {
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
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		// deploy libraries
		const constantsFactory = await ethers.getContractFactory("Constants")
		const interactionsFactory = await ethers.getContractFactory(
			"OpynInteractions"
		)
		const constants = await constantsFactory.deploy()
		const interactions = await interactionsFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await ethers.getContractFactory(
			"OpynOptionRegistry",
			{
				libraries: {
					Constants: constants.address,
					OpynInteractions: interactions.address
				}
			}
		)
		// get and transfer weth
		weth = (await ethers.getContractAt(
			"contracts/interfaces/WETH.sol:WETH",
			WETH_ADDRESS[chainId]
		)) as WETH
		usd = (await ethers.getContractAt(
			"ERC20",
			USDC_ADDRESS[chainId]
		)) as MintableERC20
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_OWNER_ADDRESS[chainId]]
		})
		const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
		await usd
			.connect(signer)
			.transfer(senderAddress, toWei("1000").div(oTokenDecimalShift18))
		await weth.deposit({ value: utils.parseEther("99") })
		const _optionRegistry = (await optionRegistryFactory.deploy(
			USDC_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			senderAddress
		)) as OpynOptionRegistry
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
		await optionRegistry.open(optionToken.address, value)
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
		await expect(
			optionRegistryReceiver.close(
				optionToken.address,
				toWei("1").div(oTokenDecimalShift18)
			)
		).to.be.revertedWith("!liquidityPool")
	})

	it("liquidityPool close and transaction succeeds", async () => {
		const [sender, receiver] = signers
		const value = toWei("1").div(oTokenDecimalShift18)
		const balanceBef = await optionToken.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistry.connect(sender)
		await optionToken.approve(optionRegistry.address, value)
		const wethBalanceBefore = await wethERC20.balanceOf(senderAddress)
		await optionRegistrySender.close(optionToken.address, value)
		const balance = await optionToken.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value)
		const wethBalance = await wethERC20.balanceOf(senderAddress)
		expect(wethBalance.sub(wethBalanceBefore)).to.equal(toWei("1"))
	})

	it("should not allow anyone outside liquidityPool to open", async () => {
		const value = toWei("2")
		const [sender, receiver] = signers
		await wethERC20.connect(receiver).approve(optionRegistry.address, value)
		await expect(
			optionRegistry.connect(receiver).open(optionToken.address, value)
		).to.be.revertedWith("!liquidityPool")
	})

	it("receiver transfers to liquidityPool and closes option token", async () => {
		const value = toWei("1").div(oTokenDecimalShift18)
		const [sender, receiver] = signers
		await optionToken.connect(receiver).transfer(senderAddress, value)
		await optionToken.approve(optionRegistry.address, value)
		const wethBalanceBefore = await wethERC20.balanceOf(receiverAddress)
		const senderBalanceBefore = await optionToken.balanceOf(senderAddress)
		await optionRegistry.close(optionToken.address, value)
		const senderBalance = await optionToken.balanceOf(senderAddress)
		expect(senderBalanceBefore.sub(senderBalance)).to.equal(
			toWei("1").div(oTokenDecimalShift18)
		)
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
		const oracle = await setupOracle(
			CHAINLINK_WETH_PRICER[chainId],
			senderAddress,
			true
		)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(
			WETH_ADDRESS[chainId],
			oracle,
			expiration,
			settlePrice
		)

		await optionToken.approve(
			optionRegistry.address,
			await optionToken.balanceOf(senderAddress)
		)
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
		await optionToken.approve(
			optionRegistry.address,
			await optionToken.balanceOf(senderAddress)
		)
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
		expiration = 1640678400
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

	it("opens an ERC20 call option", async () => {
		const value = toWei("4")
		await wethERC20.approve(optionRegistry.address, value)
		await optionRegistry.open(erc20CallOption.address, value)
		const balance = await erc20CallOption.balanceOf(senderAddress)
		expect(balance).to.be.equal(value.div(oTokenDecimalShift18))
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
		const value = toWei("1").div(oTokenDecimalShift18)
		await erc20CallOption.approve(optionRegistry.address, value)
		await optionRegistry.close(erc20CallOption.address, value)
		const balance = await erc20CallOption.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value)
	})

	it("settles call when option expires OTM", async () => {
		// get balance before
		const balanceWETH = await wethERC20.balanceOf(senderAddress)
		// get the desired settlement price
		const settlePrice = strike.sub(toWei("200")).div(oTokenDecimalShift18)
		// get the oracle
		const oracle = await setupOracle(
			CHAINLINK_WETH_PRICER[chainId],
			senderAddress,
			true
		)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(
			WETH_ADDRESS[chainId],
			oracle,
			expiration,
			settlePrice
		)

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

	it("creates a put option token series", async () => {
		const [sender] = signers
		expiration = 1643356800
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

	it("opens put option token position with ETH", async () => {
		const [sender] = signers
		const amount = strike.mul(4)
		await usd.approve(optionRegistry.address, toWei(amount.toString()))
		await optionRegistry.open(putOption.address, toWei("4"))
		const balance = await putOption.balanceOf(senderAddress)
		expect(balance).to.be.equal(toWei("4").div(oTokenDecimalShift18))
	})

	it("writer transfers part of put balance to new account", async () => {
		const [sender, receiver] = signers
		await putOption.transfer(
			receiverAddress,
			toWei("1").div(oTokenDecimalShift18)
		)
		const balance = await putOption.balanceOf(receiverAddress)
		expect(balance).to.eq(toWei("1").div(oTokenDecimalShift18))
	})

	it("writer closes not transfered balance on put option token", async () => {
		const value = toWei("1").div(oTokenDecimalShift18)
		const balanceBef = await putOption.balanceOf(senderAddress)
		await putOption.approve(optionRegistry.address, value)
		await optionRegistry.close(putOption.address, value)
		const balance = await putOption.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value)
	})

	it("settles put when option expires ITM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		// get the desired settlement price
		const settlePrice = strike.sub(toWei("200")).div(oTokenDecimalShift18)
		// get the oracle
		const oracle = await setupOracle(
			CHAINLINK_WETH_PRICER[chainId],
			senderAddress,
			true
		)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(
			WETH_ADDRESS[chainId],
			oracle,
			expiration,
			settlePrice
		)

		await putOption.approve(
			optionRegistry.address,
			await putOption.balanceOf(senderAddress)
		)
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
		await putOption.approve(
			optionRegistry.address,
			await putOption.balanceOf(senderAddress)
		)
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

let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
describe("Price Feed", async () => {
	it("Should deploy price feed", async () => {
		//const Weth = await ethers.getContractFactory(
		//  'contracts/tokens/WETH.sol:WETH',
		// )
		//const wethContract = (await Weth.deploy()) as WETH
		//weth = wethContract
		ethUSDAggregator = await deployMockContract(
			signers[0],
			AggregatorV3Interface.abi
		)

		const priceFeedFactory = await ethers.getContractFactory("PriceFeed")
		const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
		priceFeed = _priceFeed
		await priceFeed.addPriceFeed(
			ZERO_ADDRESS,
			usd.address,
			ethUSDAggregator.address
		)
		await priceFeed.addPriceFeed(
			weth.address,
			usd.address,
			ethUSDAggregator.address
		)
		const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, usd.address)
		expect(feedAddress).to.eq(ethUSDAggregator.address)
	})

	let rate: string
	it("Should return a price quote", async () => {
		// 567.70 - Chainlink uses 8 decimal places for this pair
		rate = "56770839675"
		await ethUSDAggregator.mock.latestRoundData.returns(
			"55340232221128660932",
			rate,
			"1607534965",
			"1607535064",
			"55340232221128660932"
		)
		const quote = await priceFeed.getRate(ZERO_ADDRESS, usd.address)
		expect(quote).to.eq(rate)
	})

	it("Should return a normalized price quote", async () => {
		await ethUSDAggregator.mock.decimals.returns("8")
		const quote = await priceFeed.getNormalizedRate(ZERO_ADDRESS, usd.address)
		// get decimal to 18 places
		const expected = BigNumber.from(rate).mul(BigNumber.from(10 ** 10))
		expect(quote).to.eq(expected)
	})
})
