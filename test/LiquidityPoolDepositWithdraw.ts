import hre, { ethers, network } from 'hardhat'
import { BigNumberish, Contract, ContractFactory, utils, Signer, BigNumber } from 'ethers'
import { MockProvider } from '@ethereum-waffle/provider'
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
  tFormatUSDC,
  toWeiFromUSDC
} from '../utils/conversion-helper'
import { deployMockContract, MockContract } from '@ethereum-waffle/mock-contract'
import moment from 'moment'
import AggregatorV3Interface from '../artifacts/contracts/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json'
import { AggregatorV3Interface as IAggregatorV3 } from '../types/AggregatorV3Interface'
//@ts-ignore
import bs from 'black-scholes'
import { expect } from 'chai'
import Otoken from '../artifacts/contracts/packages/opyn/core/Otoken.sol/Otoken.json'
import LiquidityPoolSol from '../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json'
import { ERC20 } from '../types/ERC20'
import { ERC20Interface } from '../types/ERC20Interface'
import { MintableERC20 } from '../types/MintableERC20'
import { OptionRegistry } from '../types/OptionRegistry'
import { Otoken as IOToken } from '../types/Otoken'
import { PriceFeed } from '../types/PriceFeed'
import { LiquidityPools } from '../types/LiquidityPools'
import { LiquidityPool } from '../types/LiquidityPool'
import { Volatility } from '../types/Volatility'
import { WETH } from '../types/WETH'
import { Protocol } from '../types/Protocol'
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
  ORACLE_LOCKING_PERIOD,
} from './constants'
import { setupOracle, setOpynOracleExpiryPrice } from './helpers'
import { send } from 'process'
import { convertDoubleToDec } from '../utils/math'

const IMPLIED_VOL = '60'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/* --- variables to change --- */

// Date for option to expire on format yyyy-mm-dd
// Will automatically convert to 08:00 UTC timestamp
const expiryDate: string = '2022-03-12'
// decimal representation of a percentage
const rfr: string = '0.03'
// edit depending on the chain id to be tested on
const chainId = 1
const oTokenDecimalShift18 = 10000000000
// amount of dollars OTM written options will be (both puts and calls)
// use negative numbers for ITM options
const strike = '20'

// balances to deposit into the LP
const liquidityPoolUsdcDeposit = '10000'
const liquidityPoolWethDeposit = '1'

// balance to withdraw after deposit
const liquidityPoolWethWithdraw = '0.1'
const liquidityPoolUsdcWithdraw = '10000'

/* --- end variables to change --- */

const expiration = moment(expiryDate).add(8, 'h').valueOf() / 1000

let usd: MintableERC20
let wethERC20: ERC20Interface
let weth: WETH
let currentTime: moment.Moment
let optionRegistry: OptionRegistry
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
let liquidityPools: LiquidityPools
let liquidityPool: LiquidityPool
let ethLiquidityPool: LiquidityPool

let priceFeed: PriceFeed
let ethUSDAggregator: MockContract
let rate: string

const CALL_FLAVOR = BigNumber.from(call)
const PUT_FLAVOR = BigNumber.from(put)

describe('Liquidity Pools Deposit Withdraw', async () => {
  before(async function () {
    await hre.network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            chainId: 1,
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
            blockNumber: 12821000,
          },
        },
      ],
    })
  })
  //   after(async function () {
  //     await network.provider.request({
  //       method: 'hardhat_reset',
  //       params: [],
  //     })
  //   })
  it('Deploys the Option Registry', async () => {
    signers = await ethers.getSigners()
    senderAddress = await signers[0].getAddress()
    receiverAddress = await signers[1].getAddress()
    // deploy libraries
    const constantsFactory = await ethers.getContractFactory('Constants')
    const interactionsFactory = await ethers.getContractFactory('OpynInteractions')
    const constants = await constantsFactory.deploy()
    const interactions = await interactionsFactory.deploy()
    // deploy options registry
    const optionRegistryFactory = await ethers.getContractFactory('OptionRegistry', {
      libraries: {
        OpynInteractions: interactions.address,
      },
    })
    // get and transfer weth
    weth = (await ethers.getContractAt(
      'contracts/interfaces/WETH.sol:WETH',
      WETH_ADDRESS[chainId],
    )) as WETH
    usd = (await ethers.getContractAt('ERC20', USDC_ADDRESS[chainId])) as MintableERC20
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [USDC_OWNER_ADDRESS[chainId]],
    })
    const signer = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
    await usd.connect(signer).transfer(senderAddress, toWei('1000').div(oTokenDecimalShift18))
    await weth.deposit({ value: utils.parseEther('99') })
    const _optionRegistry = (await optionRegistryFactory.deploy(
      USDC_ADDRESS[chainId],
      OTOKEN_FACTORY[chainId],
      GAMMA_CONTROLLER[chainId],
      MARGIN_POOL[chainId],
      senderAddress,
    )) as OptionRegistry
    optionRegistry = _optionRegistry
    expect(optionRegistry).to.have.property('deployTransaction')
  })
  it('Should deploy price feed', async () => {

    ethUSDAggregator = await deployMockContract(signers[0], AggregatorV3Interface.abi)

    const priceFeedFactory = await ethers.getContractFactory('PriceFeed')
    const _priceFeed = (await priceFeedFactory.deploy()) as PriceFeed
    priceFeed = _priceFeed
    await priceFeed.addPriceFeed(ZERO_ADDRESS, usd.address, ethUSDAggregator.address)
    await priceFeed.addPriceFeed(weth.address, usd.address, ethUSDAggregator.address)
    const feedAddress = await priceFeed.priceFeeds(ZERO_ADDRESS, usd.address)
    expect(feedAddress).to.eq(ethUSDAggregator.address)
    rate = '56770839675'
    await ethUSDAggregator.mock.latestRoundData.returns(
      '55340232221128660932',
      rate,
      '1607534965',
      '1607535064',
      '55340232221128660932',
    )
    await ethUSDAggregator.mock.decimals.returns('8')
  })

  it('Should deploy liquidity pools', async () => {
    const normDistFactory = await ethers.getContractFactory('NormalDist', {
      libraries: {},
    })
    const normDist = await normDistFactory.deploy()
    const blackScholesFactory = await ethers.getContractFactory('BlackScholes', {
      libraries: {
        NormalDist: normDist.address,
      },
    })
    const blackScholesDeploy = await blackScholesFactory.deploy()
    const constFactory = await ethers.getContractFactory(
      'contracts/libraries/Constants.sol:Constants',
    )
    const constants = await constFactory.deploy()
    const optComputeFactory = await ethers.getContractFactory(
      'contracts/libraries/OptionsCompute.sol:OptionsCompute',
      {
        libraries: {},
      },
    )
    await optComputeFactory.deploy()
    const volFactory = await ethers.getContractFactory('Volatility', {
      libraries: {},
    })
    volatility = (await volFactory.deploy()) as Volatility
    const liquidityPoolsFactory = await ethers.getContractFactory('LiquidityPools', {
      libraries: {
        BlackScholes: blackScholesDeploy.address,
      },
    })
    const _liquidityPools: LiquidityPools = (await liquidityPoolsFactory.deploy()) as LiquidityPools
    liquidityPools = _liquidityPools
  })

  it('Should deploy option protocol and link to liquidity pools', async () => {
    const protocolFactory = await ethers.getContractFactory('Protocol')
    optionProtocol = (await protocolFactory.deploy(
      optionRegistry.address,
      liquidityPools.address,
      priceFeed.address,
    )) as Protocol
    await liquidityPools.setup(optionProtocol.address)
    const lpProtocol = await liquidityPools.protocol()
    expect(optionProtocol.address).to.eq(lpProtocol)
  })

  it('Creates a liquidity pool with USDC (erc20) as strikeAsset', async () => {
    type int7 = [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
    ]
    type number7 = [number, number, number, number, number, number, number]
    const coefInts: number7 = [
      1.42180236,
      0,
      -0.08626792,
      0.07873822,
      0.00650549,
      0.02160918,
      -0.1393287,
    ]
    //@ts-ignore
    const coefs: int7 = coefInts.map((x) => toWei(x.toString()))
    const lp = await liquidityPools.createLiquidityPool(
      usd.address,
      weth.address,
      usd.address,
      toWei(rfr),
      coefs,
      coefs,
      'ETH/USDC',
      'EDP',
    )
    const lpReceipt = await lp.wait(1)
    const events = lpReceipt.events
    const createEvent = events?.find((x) => x.event == 'LiquidityPoolCreated')
    const strikeAsset = createEvent?.args?.strikeAsset
    const lpAddress = createEvent?.args?.lp
    expect(createEvent?.event).to.eq('LiquidityPoolCreated')
    expect(strikeAsset).to.eq(usd.address)
    liquidityPool = new Contract(lpAddress, LiquidityPoolSol.abi, signers[0]) as LiquidityPool
    await optionRegistry.setLiquidityPool(liquidityPool.address)
  })

  it('Deposit to the liquidityPool', async () => {
    const USDC_WHALE = '0x55fe002aeff02f77364de339a1292923a15844b8'
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [USDC_WHALE],
    })
    const usdcWhale = await ethers.getSigner(USDC_WHALE)
    const usdWhaleConnect = await usd.connect(usdcWhale)
    await weth.deposit({ value: toWei(liquidityPoolWethDeposit) })
    await usdWhaleConnect.transfer(senderAddress, toUSDC('1000000'))
    await usdWhaleConnect.transfer(receiverAddress, toUSDC('1000000'))
    const balance = await usd.balanceOf(senderAddress)
    await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
    const deposit = await liquidityPool.deposit(
      toUSDC(liquidityPoolUsdcDeposit),
      senderAddress
    )
    const liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
    const receipt = await deposit.wait(1)
    const event = receipt?.events?.find((x) => x.event == 'Deposit')
    const newBalance = await usd.balanceOf(senderAddress)
    expect(event?.event).to.eq('Deposit')
    expect(balance.sub(newBalance)).to.eq(toUSDC(liquidityPoolUsdcDeposit))
    expect(liquidityPoolBalance.toString()).to.eq(toWei(liquidityPoolUsdcDeposit));

  })

  it('Removes from liquidityPool with no options written', async () => {
    const liquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
    await liquidityPool.withdraw(liquidityPoolBalance, senderAddress)
    const newLiquidityPoolBalance = await liquidityPool.balanceOf(senderAddress)
    const expectedBalance = (
      parseFloat(liquidityPoolUsdcDeposit) - parseFloat(liquidityPoolUsdcWithdraw)
    ).toString()
    expect(newLiquidityPoolBalance).to.eq(toWei(expectedBalance))
    expect(liquidityPoolBalance.sub(newLiquidityPoolBalance)).to.eq(
      toWei(liquidityPoolUsdcWithdraw),
    )
  })

  it('Adds additional liquidity from new account', async () => {
    const [sender, receiver] = signers
    await usd.approve(liquidityPool.address, toUSDC(liquidityPoolUsdcDeposit))
    await liquidityPool.deposit(
      toUSDC(liquidityPoolUsdcDeposit),
      senderAddress
    )
    const sendAmount = toUSDC('1000')
    const usdReceiver = usd.connect(receiver)
    await usdReceiver.approve(liquidityPool.address, sendAmount)
    const lpReceiver = liquidityPool.connect(receiver)
    const totalSupply = await liquidityPool.totalSupply()
    await lpReceiver.deposit(sendAmount, receiverAddress)
    const newTotalSupply = await liquidityPool.totalSupply()
    const lpBalance = await lpReceiver.balanceOf(receiverAddress)
    const difference = newTotalSupply.sub(lpBalance)
    expect(difference).to.eq((await lpReceiver.balanceOf(senderAddress)))
    expect(newTotalSupply).to.eq(totalSupply.add(lpBalance))
  })
  it('LP Writes a ETH/USD put for premium', async () => {
    const [sender] = signers
    const amount = toWei('1')
    const blockNum = await ethers.provider.getBlockNumber()
    const block = await ethers.provider.getBlock(blockNum)
    const { timestamp } = block
    const priceQuote = await priceFeed.getNormalizedRate(weth.address, usd.address)
    const strikePrice = priceQuote.sub(toWei(strike))
    const proposedSeries = {
      expiration: fmtExpiration(expiration),
      flavor: PUT_FLAVOR,
      strike: BigNumber.from(strikePrice),
      strikeAsset: usd.address,
      underlying: weth.address,
    }
    const poolBalanceBefore = await usd.balanceOf(liquidityPool.address);
    const quote = (await liquidityPool.quotePriceWithUtilizationGreeks(proposedSeries, amount))[0]
    await usd.approve(liquidityPool.address, quote)
    const balance = await usd.balanceOf(senderAddress)
    const write = await liquidityPool.issueAndWriteOption(proposedSeries, amount)
    const poolBalanceAfter = await usd.balanceOf(liquidityPool.address);
    const receipt = await write.wait(1)
    const events = receipt.events
    const writeEvent = events?.find((x) => x.event == 'WriteOption')
    const seriesAddress = writeEvent?.args?.series
    const putOptionToken = new Contract(seriesAddress, Otoken.abi, sender) as IOToken
    const putBalance = await putOptionToken.balanceOf(senderAddress)
    const registryUsdBalance = await liquidityPool.collateralAllocated();
    const balanceNew = await usd.balanceOf(senderAddress)
    const opynAmount = toOpyn(fromWei(amount))
    expect(putBalance).to.eq(opynAmount)
    // ensure funds are being transfered
    expect(tFormatUSDC(balance.sub(balanceNew))).to.eq(tFormatEth(quote))
  })
  it('LP can redeem shares', async () => {
    const senderSharesBefore = await liquidityPool.balanceOf(senderAddress);
    expect(senderSharesBefore).to.be.gt(0);
    const senderUsdcBefore = await usd.balanceOf(senderAddress);
    const receiverSharesBefore = await liquidityPool.balanceOf(receiverAddress);
    expect(receiverSharesBefore).to.be.gt(0);
    const totalSharesBefore = await liquidityPool.totalSupply();
    const usdBalanceBefore = await usd.balanceOf(liquidityPool.address)
    const withdraw = await liquidityPool.withdraw(senderSharesBefore, senderAddress)
    const receipt = await withdraw.wait(1)
    const events = receipt.events
    const removeEvent = events?.find((x) => x.event == 'Withdraw')
    const strikeAmount = removeEvent?.args?.strikeAmount
    const usdBalanceAfter = await usd.balanceOf(liquidityPool.address)
    const receiverUsd = await usd.balanceOf(receiverAddress);
    const senderUsdcAfter = await usd.balanceOf(senderAddress);
    const senderSharesAfter = await liquidityPool.balanceOf(senderAddress);
    const totalSharesAfter = await liquidityPool.totalSupply();
    //@ts-ignore
    const diff = usdBalanceBefore - usdBalanceAfter;
    console.log(diff, toUSDC(liquidityPoolUsdcDeposit).toNumber())
    expect(diff - (toUSDC(liquidityPoolUsdcDeposit).toNumber())).to.be.within(0, 20);
    expect(senderUsdcAfter.sub(senderUsdcBefore).sub(toUSDC(liquidityPoolUsdcDeposit))).to.be.within(0, 20)
    expect(senderUsdcAfter.sub(senderUsdcBefore)).to.be.eq(strikeAmount);
    expect(senderSharesAfter).to.eq(0);
    expect(totalSharesBefore.sub(totalSharesAfter)).to.be.eq(senderSharesBefore);
    expect(totalSharesAfter).to.be.eq(receiverSharesBefore);
    
  })
  it('LP can not redeems shares when in excess of liquidity', async () => {
    const [sender, receiver] = signers
    
    const shares = await liquidityPool.balanceOf(receiverAddress)
    const liquidityPoolReceiver = liquidityPool.connect(receiver)
    const withdraw = liquidityPoolReceiver.withdraw(shares, receiverAddress)
    await expect(withdraw).to.be.revertedWith('Insufficient funds for a full withdrawal')
  })
})