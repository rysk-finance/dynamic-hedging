import hre, { ethers, network } from "hardhat"
import { Contract, utils, Signer, BigNumber } from "ethers"
import { toWei, call, put, fromOpyn, scaleNum, createValidExpiry, MAX_BPS } from "../utils/conversion-helper"
import { expect } from "chai"
import moment from "moment"
import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import {Controller} from "../types/Controller"
import {AddressBook} from "../types/AddressBook";
import {Oracle} from "../types/Oracle";
import {NewMarginCalculator} from "../types/NewMarginCalculator";
import {NewWhitelist} from "../types/NewWhitelist";
import { ERC20Interface } from "../types/ERC20Interface"
import { MintableERC20 } from "../types/MintableERC20"
import { OptionRegistryV2 } from "../types/OptionRegistryV2"
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
    CONTROLLER_OWNER,
    ADDRESS_BOOK,
    GAMMA_ORACLE_NEW,
} from "./constants"
import { setupOracle, setOpynOracleExpiryPrice } from "./helpers"
import { create } from "domain"
let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let controller: Controller
let addressBook: AddressBook
let newCalculator: NewMarginCalculator
let oracle: Oracle
let optionRegistry: OptionRegistryV2
let optionRegistryETH: OptionRegistryV2
let optionTokenUSDC: IOToken
let optionTokenETH: IOToken
let erc20CallOptionUSDC: IOToken
let erc20CallOptionETH: IOToken
let erc20PutOptionUSDC: IOToken
let erc20PutOptionETH: IOToken
let signers: Signer[]
let senderAddress: string
let receiverAddress: string

// time travel period between each expiry
const expiryPeriod = {
	days: 0,
	weeks: 0,
	months: 1,
	years: 0
}
const productSpotShockValue = scaleNum('0.6', 27)
// array of time to expiry
const day = 60 * 60 * 24
const timeToExpiry = [day * 7, day * 14, day * 28, day * 42, day * 56]
// array of upper bound value correspond to time to expiry
const expiryToValue = [
  scaleNum('0.1678', 27),
  scaleNum('0.237', 27),
  scaleNum('0.3326', 27),
  scaleNum('0.4032', 27),
  scaleNum('0.4603', 27),
]
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
        // impersonate the opyn controller owner
        await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [CONTROLLER_OWNER[chainId]]
		})
        signers = await ethers.getSigners()
        const [sender] = signers

		const signer = await ethers.getSigner(CONTROLLER_OWNER[chainId])
        await sender.sendTransaction({
            to: signer.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        // get an instance of the controller
        controller = (await ethers.getContractAt(
            "contracts/packages/opyn/core/Controller.sol:Controller",
            GAMMA_CONTROLLER[chainId]
        )) as Controller
        // get an instance of the addressbook
        addressBook = (await ethers.getContractAt(
            "contracts/packages/opyn/core/AddressBook.sol:AddressBook",
            ADDRESS_BOOK[chainId]
        )) as AddressBook
		// get the oracle
		oracle = (await ethers.getContractAt(
			"contracts/packages/opyn/core/Oracle.sol:Oracle",
			GAMMA_ORACLE_NEW[chainId]
		)) as Oracle
        // deploy the new calculator
        const newCalculatorInstance = await ethers.getContractFactory("NewMarginCalculator");
        newCalculator = (await newCalculatorInstance.deploy(
            GAMMA_ORACLE_NEW[chainId],
            ADDRESS_BOOK[chainId]
        )) as NewMarginCalculator
        // deploy the new whitelist
        const newWhitelistInstance = await ethers.getContractFactory("NewWhitelist");
        const newWhitelist = (await newWhitelistInstance.deploy(
            ADDRESS_BOOK[chainId]
        ))
        // update the addressbook with the new calculator and whitelist addresses
        await addressBook.connect(signer).setMarginCalculator(newCalculator.address)
        await addressBook.connect(signer).setWhitelist(newWhitelist.address)
        // update the whitelist and calculator in the controller
        await controller.connect(signer).refreshConfiguration();
        // whitelist collateral
        await newWhitelist.whitelistCollateral(WETH_ADDRESS[chainId])
        await newWhitelist.whitelistCollateral(USDC_ADDRESS[chainId])
        // whitelist products
        // normal calls
        await newWhitelist.whitelistProduct(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
        // normal puts
        await newWhitelist.whitelistProduct(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], USDC_ADDRESS[chainId], true)
        // usd collateralised calls
        await newWhitelist.whitelistProduct(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], USDC_ADDRESS[chainId], false)
		// eth collateralised puts
		await newWhitelist.whitelistProduct(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
        // whitelist vault type 0 collateral
        await newWhitelist.whitelistCoveredCollateral(WETH_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
        await newWhitelist.whitelistCoveredCollateral(USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
		// whitelist vault type 1 collateral
		await newWhitelist.whitelistNakedCollateral(USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], false)
		await newWhitelist.whitelistNakedCollateral(WETH_ADDRESS[chainId], WETH_ADDRESS[chainId], true)
        // set product spot shock values
        // usd collateralised calls
        await newCalculator.setSpotShock(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], USDC_ADDRESS[chainId], false, productSpotShockValue)
        // usd collateralised puts
        await newCalculator.setSpotShock(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], USDC_ADDRESS[chainId], true, productSpotShockValue)
		// eth collateralised calls
		await newCalculator.setSpotShock(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], false, productSpotShockValue)
        // eth collateralised puts
        await newCalculator.setSpotShock(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], true, productSpotShockValue)
        // set expiry to value values
        // usd collateralised calls
        await newCalculator.setUpperBoundValues(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], USDC_ADDRESS[chainId], false, timeToExpiry, expiryToValue)
        // usd collateralised puts
        await newCalculator.setUpperBoundValues(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], USDC_ADDRESS[chainId], true, timeToExpiry, expiryToValue)
		// eth collateralised calls
		await newCalculator.setUpperBoundValues(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], false, timeToExpiry, expiryToValue)
		// eth collateralised puts
		await newCalculator.setUpperBoundValues(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], WETH_ADDRESS[chainId], true, timeToExpiry, expiryToValue)
    })

	it("Deploys the Option Registry", async () => {
		signers = await ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		// deploy libraries
		const constantsFactory = await ethers.getContractFactory("Constants")
		const interactionsFactory = await ethers.getContractFactory("OpynInteractionsV2")
		const constants = await constantsFactory.deploy()
		const interactions = await interactionsFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistryV2", {
			libraries: {
				OpynInteractionsV2: interactions.address
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
		await usd.connect(signer).transfer(senderAddress, toWei("1000000").div(oTokenDecimalShift18))
		await weth.deposit({ value: utils.parseEther("99") })
		const _optionRegistry = (await optionRegistryFactory.deploy(
			USDC_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId],
		)) as OptionRegistryV2
		optionRegistry = _optionRegistry
		expect(optionRegistry).to.have.property("deployTransaction")
		const _optionRegistryETH = (await optionRegistryFactory.deploy(
			WETH_ADDRESS[chainId],
			OTOKEN_FACTORY[chainId],
			GAMMA_CONTROLLER[chainId],
			MARGIN_POOL[chainId],
			senderAddress,
			ADDRESS_BOOK[chainId],
		)) as OptionRegistryV2
		optionRegistryETH = _optionRegistryETH
		expect(optionRegistryETH).to.have.property("deployTransaction")
	})

	it("Creates a USDC collataralised call option token series", async () => {
		const [sender] = signers
		const issue = await optionRegistry.issue(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			call,
			strike,
			USDC_ADDRESS[chainId]
		)
		await expect(issue).to.emit(optionRegistry, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenUSDC = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	it("Creates a ETH collataralised call option token series", async () => {
		const [sender] = signers
		const issue = await optionRegistryETH.issue(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			call,
			strike,
			WETH_ADDRESS[chainId]
		)
		await expect(issue).to.emit(optionRegistryETH, "OptionTokenCreated")
		const receipt = await issue.wait(1)
		const events = receipt.events
		const removeEvent = events?.find(x => x.event == "OptionTokenCreated")
		const seriesAddress = removeEvent?.args?.token
		// save the option token address
		optionTokenETH = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
	})
	let marginReqUSD : BigNumber
	let marginReqETH : BigNumber
    it("opens call option token with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = (await oracle.getPrice(weth.address))
		marginReqUSD = (await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false,
		))
		marginReqUSD = ((await optionRegistry.callUpperHealthFactor()).mul(marginReqUSD)).div(MAX_BPS)  
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral((await optionRegistry.seriesInfo(optionTokenUSDC.address)), value)
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
		const underlyingPrice = (await oracle.getPrice(weth.address))
		marginReqETH = (await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false,
		))
		marginReqETH = ((await optionRegistry.callUpperHealthFactor()).mul(marginReqETH)).div(MAX_BPS)
		await wethERC20.approve(optionRegistryETH.address, value)
		const collatAmount = await optionRegistryETH.getCollateral((await optionRegistryETH.seriesInfo(optionTokenETH.address)), value)
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
		).to.be.revertedWith("!liquidityPool")
		const optionRegistryReceiverETH = optionRegistryETH.connect(receiver)
		await expect(
			optionRegistryReceiverETH.close(optionTokenETH.address, toWei("1"))
		).to.be.revertedWith("!liquidityPool")
	})

	it("opens call option again with USDC", async () => {
		const value = toWei("4")
		const USDbalanceBefore = await usd.balanceOf(senderAddress)
		const underlyingPrice = (await oracle.getPrice(weth.address))
		const oBalanceBef = await optionTokenUSDC.balanceOf(senderAddress)
		let marginReq = (await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false,
		))
		marginReq = ((await optionRegistry.callUpperHealthFactor()).mul(marginReq)).div(MAX_BPS)  
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral((await optionRegistry.seriesInfo(optionTokenUSDC.address)), value)
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
		const underlyingPrice = (await oracle.getPrice(weth.address))
		const oBalanceBef = await optionTokenETH.balanceOf(senderAddress)
		let marginReq = (await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false,
		))
		marginReq = ((await optionRegistryETH.callUpperHealthFactor()).mul(marginReq)).div(MAX_BPS) 
		await wethERC20.approve(optionRegistryETH.address, value)
		const collatAmount = await optionRegistryETH.getCollateral((await optionRegistryETH.seriesInfo(optionTokenETH.address)), value)
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
		const underlyingPrice = (await oracle.getPrice(weth.address))
		let marginReq = (await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			usd.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			6,
			false,
		))
		marginReq = ((await optionRegistryETH.callUpperHealthFactor()).mul(marginReq)).div(MAX_BPS)
		await optionRegistrySender.close(optionTokenUSDC.address, value)
		const balance = await optionTokenUSDC.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const usdBalance = await usd.balanceOf(senderAddress)
		expect((usdBalance.sub(usdBalanceBefore)).sub(marginReq)).to.be.within(-1,1)
	})

	it("liquidityPool close and transaction succeeds ETH options", async () => {
		const [sender, receiver] = signers
		const value = toWei("1")
		const balanceBef = await optionTokenETH.balanceOf(senderAddress)
		const optionRegistrySender = optionRegistryETH.connect(sender)
		await optionTokenETH.approve(optionRegistryETH.address, value.div(oTokenDecimalShift18))
		const ethBalanceBefore = await wethERC20.balanceOf(senderAddress)
		const underlyingPrice = (await oracle.getPrice(weth.address))
		let marginReq = (await newCalculator.getNakedMarginRequired(
			weth.address,
			usd.address,
			weth.address,
			value.div(oTokenDecimalShift18),
			strike.div(oTokenDecimalShift18),
			underlyingPrice,
			expiration,
			18,
			false,
		))
		marginReq = ((await optionRegistryETH.callUpperHealthFactor()).mul(marginReq)).div(MAX_BPS)
		await optionRegistrySender.close(optionTokenETH.address, value)
		const balance = await optionTokenETH.balanceOf(senderAddress)
		expect(balanceBef.sub(balance)).to.equal(value.div(oTokenDecimalShift18))
		const ethBalance = (await wethERC20.balanceOf(senderAddress));
		const diff = ethBalance.sub(ethBalanceBefore);
		expect(diff.sub(marginReq)).to.be.within(-1,1);
	})
	it("should not allow anyone outside liquidityPool to open", async () => {
		const value = toWei("2")
		const [sender, receiver] = signers
		await usd.connect(receiver).approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral((await optionRegistry.seriesInfo(optionTokenUSDC.address)), value)
		await expect(
			optionRegistry.connect(receiver).open(optionTokenUSDC.address, value, collatAmount)
		).to.be.revertedWith("!liquidityPool")
	})

	it("settles when option expires ITM USD collateral", async () => {
		const [sender, receiver] = signers
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		// get the desired settlement price
		const settlePrice = strike.add(toWei("200")).div(oTokenDecimalShift18)
		// get the oracle
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)
		await optionTokenUSDC.approve(optionRegistry.address, await optionTokenUSDC.balanceOf(senderAddress))
		// call redeem from the options registry
		await optionRegistry.settle(optionTokenUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenUSDC.balanceOf(optionRegistry.address)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD > balanceUSD).to.be.true
	})

	it("settles when option expires ITM ETH collateral", async () => {
		const [sender, receiver] = signers
		// get balance before
		const balanceETH = await wethERC20.balanceOf(senderAddress)
		await optionTokenETH.approve(optionRegistryETH.address, await optionTokenETH.balanceOf(senderAddress))
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
		await optionTokenUSDC.approve(optionRegistry.address, await optionTokenUSDC.balanceOf(senderAddress))
		// call redeem from the options registry
		await optionRegistry.redeem(optionTokenUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await optionTokenUSDC.balanceOf(optionRegistry.address)
		const opBalSender = await optionTokenUSDC.balanceOf(senderAddress)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD.toNumber()).to.be.greaterThan(balanceUSD.toNumber())
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})

	it("writer redeems when option expires ITM ETH collateral", async () => {
		// get balance before
		const balanceETH = await wethERC20.balanceOf(senderAddress)
		await optionTokenETH.approve(optionRegistryETH.address, await optionTokenETH.balanceOf(senderAddress))
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
		const issueCall = await optionRegistry.issue(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			call,
			strike,
			USDC_ADDRESS[chainId]
		)
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
		const issueCall = await optionRegistryETH.issue(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			call,
			strike,
			WETH_ADDRESS[chainId]
		)
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
		erc20PutOptionUSDC = new Contract(address, Otoken.abi, sender) as IOToken
	})

	it("creates a ETH put option token series", async () => {
		const [sender] = signers
		const issuePut = await optionRegistryETH.issue(
			WETH_ADDRESS[chainId],
			USDC_ADDRESS[chainId],
			expiration,
			put,
			strike,
			WETH_ADDRESS[chainId]
		)
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
		const collatAmount = await optionRegistry.getCollateral((await optionRegistry.seriesInfo(erc20PutOptionUSDC.address)), toWei("4"))
		await optionRegistry.open(erc20PutOptionUSDC.address, toWei("4"), collatAmount)
		const balance = await erc20PutOptionUSDC.balanceOf(senderAddress)
		expect(balance).to.be.equal(toWei("4").div(oTokenDecimalShift18))
		await weth.approve(optionRegistryETH.address, toWei(amount.toString()))
		const collatAmountETH = await optionRegistryETH.getCollateral((await optionRegistryETH.seriesInfo(erc20PutOptionETH.address)), toWei("4"))
		await optionRegistryETH.open(erc20PutOptionETH.address, toWei("4"), collatAmountETH)
		const newBalance = await erc20PutOptionETH.balanceOf(senderAddress)
		expect(newBalance).to.be.equal(toWei("4").div(oTokenDecimalShift18))
	})
	it("opens an ERC20 call option", async () => {
		const value = toWei("4")
		await usd.approve(optionRegistry.address, value)
		const collatAmount = await optionRegistry.getCollateral((await optionRegistry.seriesInfo(erc20CallOptionUSDC.address)), value)
		await optionRegistry.open(erc20CallOptionUSDC.address, value, collatAmount)
		const balance = await erc20CallOptionUSDC.balanceOf(senderAddress)
		expect(balance).to.be.equal(value.div(oTokenDecimalShift18))
		await wethERC20.approve(optionRegistryETH.address, value)
		const collatAmountETH = await optionRegistryETH.getCollateral((await optionRegistryETH.seriesInfo(erc20CallOptionETH.address)), value)
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
		// get the oracle
		const oracle = await setupOracle(CHAINLINK_WETH_PRICER[chainId], senderAddress, true)
		// set the option expiry price, make sure the option has now expired
		await setOpynOracleExpiryPrice(WETH_ADDRESS[chainId], oracle, expiration, settlePrice)
		await erc20CallOptionUSDC.approve(
			optionRegistry.address,
			await erc20CallOptionUSDC.balanceOf(senderAddress)
		)
		// call redeem from the options registry
		await optionRegistry.settle(erc20CallOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20CallOptionUSDC.balanceOf(optionRegistry.address)
		const ethBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceUSD).to.be.gt(balanceUSD)
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
		// get the desired settlement price
		const settlePrice = strike.sub(toWei("200")).div(oTokenDecimalShift18)
		await erc20PutOptionUSDC.approve(optionRegistry.address, await erc20PutOptionUSDC.balanceOf(senderAddress))
		// call settle from the options registry
		await optionRegistry.settle(erc20PutOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20PutOptionUSDC.balanceOf(optionRegistry.address)
		const ethBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(opBalRegistry).to.equal(0)
		expect(ethBalRegistry).to.equal(0)
		expect(newBalanceUSD > balanceUSD).to.be.true
	})

	it("writer redeems put when option expires ITM", async () => {
		// get balance before
		const balanceUSD = await usd.balanceOf(senderAddress)
		await erc20PutOptionUSDC.approve(optionRegistry.address, await erc20PutOptionUSDC.balanceOf(senderAddress))
		// call redeem from the options registry
		await optionRegistry.redeem(erc20PutOptionUSDC.address)
		// check balances are in order
		const newBalanceUSD = await usd.balanceOf(senderAddress)
		const opBalRegistry = await erc20PutOptionUSDC.balanceOf(optionRegistry.address)
		const opBalSender = await erc20PutOptionUSDC.balanceOf(senderAddress)
		const usdBalRegistry = await usd.balanceOf(optionRegistry.address)
		expect(usdBalRegistry).to.equal(0)
		expect(newBalanceUSD > balanceUSD).to.be.true
		expect(opBalRegistry).to.equal(0)
		expect(opBalSender).to.equal(0)
	})
})
