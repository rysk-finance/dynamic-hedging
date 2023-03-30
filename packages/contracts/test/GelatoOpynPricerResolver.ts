import { expect } from "chai"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { BigNumber, Contract, Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"

import Otoken from "../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json"
import {
	AddressBook,
	ERC20Interface,
	MintableERC20,
	NewController,
	NewMarginCalculator,
	OpynInteractions,
	OpynPricerResolver,
	Oracle,
	Otoken as IOToken,
	WETH
} from "../types"
import { OptionRegistry, OptionSeriesStruct } from "../types/OptionRegistry"
import {
	call,
	createValidExpiry,
	MAX_BPS,
	put,
	toWei,
	ZERO_ADDRESS
} from "../utils/conversion-helper"
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
let addressBook: AddressBook
let oracle: Oracle
let resolver: OpynPricerResolver
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

function hexToUtf8(hexEncodedMessage: any) {
	return decodeURIComponent(
		hexEncodedMessage
			.slice(2) // remove 0x
			.replace(/\s+/g, "")
			.replace(/[0-9a-f]{2}/g, "%$&")
	)
}

describe("Gelato option registry tests", function () {
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
		addressBook = opynParams.addressBook
		controller = opynParams.controller
		oracle = opynParams.oracle
		newCalculator = opynParams.newCalculator
	})

	it("Deploys the Option Registry", async () => {
		signers = await ethers.getSigners()
		senderAddress = await signers[0].getAddress()
		receiverAddress = await signers[1].getAddress()
		// deploy libraries
		const interactionsFactory = await ethers.getContractFactory("OpynInteractions")
		interactions = (await interactionsFactory.deploy()) as OpynInteractions
		const computeFactory = await hre.ethers.getContractFactory("contracts/libraries/OptionsCompute.sol:OptionsCompute")
		const compute = await computeFactory.deploy()
		// deploy options registry
		const optionRegistryFactory = await ethers.getContractFactory("OptionRegistry", {
			libraries: {
				OpynInteractions: interactions.address,
				OptionsCompute: compute.address
			}
		})
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
		await weth.deposit({ value: utils.parseEther("99") })
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
	it("deploys the Gelato Resolver and returns false due to incorrect time", async () => {
		const resolverFactory = await ethers.getContractFactory("OpynPricerResolver")
		resolver = (await resolverFactory.deploy(
			CHAINLINK_WETH_PRICER[chainId],
			addressBook.address
		)) as OpynPricerResolver

		const blockNum = await ethers.provider.getBlockNumber()
		const timestamp = (await ethers.provider.getBlock(blockNum)).timestamp
		const date = new Date(timestamp * 1000)
		// time is 19:05 UTC.
		expect(date.getUTCHours()).to.not.eq(8)

		const checkerResult = await resolver.checker()
		const decodedResult = hexToUtf8(checkerResult.execPayload)

		expect(decodedResult).to.eq("Incorrect time")
	})
	it("returns false due to most recent chainlink price being before expiry time", async () => {
		// fast forward 13 hours
		await ethers.provider.send("evm_increaseTime", [46800])
		await ethers.provider.send("evm_mine")
		const blockNum = await ethers.provider.getBlockNumber()
		const timestamp = (await ethers.provider.getBlock(blockNum)).timestamp
		const date = new Date(timestamp * 1000)
		// time is 19:05 UTC.
		expect(date.getUTCHours()).to.eq(8)
		const checkerResult = await resolver.checker()
		const decodedResult = hexToUtf8(checkerResult.execPayload)
		expect(decodedResult).to.eq("latest chainlink price before expiry")

	})
	it("re-forks network at between 8am and 9am", async () => {
		// fork network shortly after 8am when a price will have been set already
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [
				{
					forking: {
						chainId: 1,
						jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
						blockNumber: 14293600 // Feb-28-2022 08:41:44 AM +UTC
					}
				}
			]
		})
		signers = await ethers.getSigners()
		let opynParams = await deployOpyn(signers)
		addressBook = opynParams.addressBook
		controller = opynParams.controller
		oracle = opynParams.oracle
		newCalculator = opynParams.newCalculator
	})
	it("deploys the Gelato Resolver and returns true when time is correct and price has not been set already", async () => {
		const resolverFactory = await ethers.getContractFactory("OpynPricerResolver")
		resolver = (await resolverFactory.deploy(
			CHAINLINK_WETH_PRICER[chainId],
			addressBook.address
		)) as OpynPricerResolver

		const checkerResult = await resolver.checker()
		expect(checkerResult.canExec).to.eq(true)
	})
	it("returns false due to price already set ", async () => {
		const oracleOwner = await oracle.owner()

		await hre.network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [oracleOwner]
		})

		const oracleSigner = await ethers.getSigner(oracleOwner)
		await oracle.connect(oracleSigner).setAssetPricer(weth.address, signers[0].getAddress())
		// manually set price for this expiry timestamp before calling resovler
		await oracle.setExpiryPrice(weth.address, 1646035200, utils.parseUnits("3000", 6))

		const blockNum = await ethers.provider.getBlockNumber()
		const timestamp = (await ethers.provider.getBlock(blockNum)).timestamp
		const date = new Date(timestamp * 1000)
		expect(date.getUTCHours()).to.eq(8)
		const checkerResult = await resolver.checker()
		const decodedResult = hexToUtf8(checkerResult.execPayload)
		expect(decodedResult).to.eq("Price already set")
	})
})
