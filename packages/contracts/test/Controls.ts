import { expect } from "chai"
import { Signer, utils } from "ethers"
import hre, { ethers, network } from "hardhat"
import { AlphaPortfolioValuesFeed, Authority, MintableERC20, MockChainlinkAggregator, OptionRegistry, Oracle, Protocol } from "../types"

import { deployLiquidityPool, deploySystem } from "../utils/generic-system-deployer"
import { toUSDC, ZERO_ADDRESS } from "../utils/conversion-helper"
import { deployOpyn } from "../utils/opyn-deployer"
import { CHAINLINK_WETH_PRICER, CONTROLLER_OWNER } from "./constants"
import { setupTestOracle} from "./helpers"

let usd: MintableERC20
let wethERC20: MintableERC20
let optionRegistry: OptionRegistry
let optionProtocol: Protocol
let signers: Signer[]
let senderAddress: string
let receiverAddress: string
let portfolioValuesFeed: AlphaPortfolioValuesFeed
let oracle: Oracle
let opynAggregator: MockChainlinkAggregator
let authority: Authority

/* --- variables to change --- */

// edit depending on the chain id to be tested on
const chainId = 1

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
})
