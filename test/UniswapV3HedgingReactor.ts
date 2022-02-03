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
  getDiffSeconds,
  convertRounded,
  percentDiffArr,
  percentDiff,
} from '../utils'
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
import { OpynOptionRegistry } from '../types/OpynOptionRegistry'
import { Otoken as IOToken } from '../types/Otoken'
import { PriceFeed } from '../types/PriceFeed'
import { LiquidityPools } from '../types/LiquidityPools'
import { LiquidityPool } from '../types/LiquidityPool'
import { UniswapV3HedgingReactor } from '../types/UniswapV3HedgingReactor'
import { UniswapV3HedgingTest } from '../types/UniswapV3HedgingTest'
import { ISwapRouter } from '../types/ISwapRouter'
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
  UNISWAP_V3_SWAP_ROUTER,
} from './constants'
import exp from 'constants'

let signers: Signer[]
let deployerAddress: string
let usdcWhale: Signer
let usdcWhaleAddress: string
let liquidityPoolDummy: UniswapV3HedgingTest
let liquidityPoolDummyAddress: string
let uniswapV3HedgingReactor: UniswapV3HedgingReactor
let usdcContract: MintableERC20
let wethContract: MintableERC20

// edit depending on the chain id to be tested on
const chainId = 1

describe('UniswapV3HedgingReactor', () => {
  before(async function () {
    await network.provider.request({
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
  it('deploys the dummy LP contract', async () => {
    signers = await ethers.getSigners()
    const liquidityPoolDummyFactory = await ethers.getContractFactory('UniswapV3HedgingTest')
    liquidityPoolDummy = (await liquidityPoolDummyFactory.deploy()) as UniswapV3HedgingTest
    liquidityPoolDummyAddress = liquidityPoolDummy.address

    expect(liquidityPoolDummy).to.have.property('setHedgingReactorAddress')
    expect(liquidityPoolDummy).to.have.property('hedgeDelta')
  })

  it('funds the LP contract with a million USDC', async () => {
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [USDC_OWNER_ADDRESS[chainId]],
    })
    usdcWhale = await ethers.getSigner(USDC_OWNER_ADDRESS[chainId])
    usdcWhaleAddress = await usdcWhale.getAddress()
    usdcContract = (await ethers.getContractAt('ERC20', USDC_ADDRESS[chainId])) as MintableERC20

    await usdcContract
      .connect(usdcWhale)
      .transfer(liquidityPoolDummyAddress, ethers.utils.parseUnits('1000000', 6))

    const LPContractBalance = parseFloat(
      ethers.utils.formatUnits(await usdcContract.balanceOf(liquidityPoolDummyAddress), 6),
    )

    expect(LPContractBalance).to.equal(1000000)
  })

  it('deploys the hedging reactor', async () => {
    const uniswapV3HedgingReactorFactory = await ethers.getContractFactory(
      'UniswapV3HedgingReactor',
      {
        signer: signers[0],
      },
    )

    uniswapV3HedgingReactor = (await uniswapV3HedgingReactorFactory.deploy(
      UNISWAP_V3_SWAP_ROUTER[chainId],
      [USDC_ADDRESS[chainId]],
      WETH_ADDRESS[chainId],
      liquidityPoolDummyAddress,
      3000,
    )) as UniswapV3HedgingReactor

    expect(uniswapV3HedgingReactor).to.have.property('hedgeDelta')
  })

  it('sets reactor address on LP contract', async () => {
    const reactorAddress = uniswapV3HedgingReactor.address

    await liquidityPoolDummy.setHedgingReactorAddress(reactorAddress)

    expect(await liquidityPoolDummy.uniswapV3HedgingReactor()).to.equal(reactorAddress)
  })

  it('reverts if no ETH balance and hedging positive delta', async () => {
    await expect(liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther('20'))).to.be.revertedWith(
      'ETH balance is 0',
    )
  })

  it('hedges a positive delta', async () => {
    wethContract = (await ethers.getContractAt('ERC20', WETH_ADDRESS[chainId])) as MintableERC20

    const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther('-20'))
    await hedgeDeltaTx.wait()
    const reactorWethBalance = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )

    const reactorDelta = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )
    expect(reactorWethBalance).to.equal(20)
  })
  it('getDelta returns correct value', async () => {
    const reactorDelta = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )
    expect(reactorDelta).to.equal(20)
  })
  it('hedges a negative delta with sufficient funds', async () => {
    const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther('15'))
    await hedgeDeltaTx.wait()
    const reactorWethBalance = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )

    const reactorDelta = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )

    expect(reactorDelta).to.equal(20 - 15)
    expect(reactorWethBalance).to.equal(20 - 15)
  })
  it('hedges a negative delta with insufficient funds', async () => {
    // has a balance of 5 wETH at this point
    // try to hedge another 15 delta
    const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther('15'))

    await hedgeDeltaTx.wait()

    const reactorWethBalance = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )
    const reactorDelta = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )

    expect(reactorWethBalance).to.equal(0)
    expect(reactorDelta).to.equal(0)
  })

  it('withdraws funds without liquidation', async () => {
    // give it ETH balance
    const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther('-50'))
    await hedgeDeltaTx.wait()

    let reactorUsdcBalance = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
        6,
      ),
    )

    const reactorWethBalanceBefore = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )

    expect(reactorWethBalanceBefore).to.equal(50)

    const withdrawAmount = '50000'
    expect(parseFloat(withdrawAmount)).to.be.below(reactorUsdcBalance)

    const LpUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    const withdrawTx = await liquidityPoolDummy.withdraw(
      ethers.utils.parseUnits(withdrawAmount, 6),
      usdcContract.address,
    )
    let reactorUsdcBalanceOld = reactorUsdcBalance
    reactorUsdcBalance = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
        6,
      ),
    )
    const LpUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    const reactorWethBalanceAfter = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )
    const reactorDelta = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )
    // expect LP balance to go up by withdrawAmount
    expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.equal(parseFloat(withdrawAmount))
    // expect reactor balance to go down by withdrawAmount
    expect(reactorUsdcBalance.toFixed(6)).to.equal(
      (reactorUsdcBalanceOld - parseFloat(withdrawAmount)).toFixed(6),
    )
    // expect reactor wETH balance to be unchanged
    expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
    expect(reactorDelta).to.equal(reactorWethBalanceAfter)
  })

  it('liquidates WETH and withdraws sufficient funds', async () => {
    const reactorUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
        6,
      ),
    )
    const reactorWethBalanceBefore = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )
    const LpUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    const withdrawAmount = '100000'

    expect(reactorWethBalanceBefore).to.equal(50)
    expect(parseFloat(withdrawAmount)).to.be.above(reactorUsdcBalanceBefore)
    // withdraw more than current balance
    await liquidityPoolDummy.withdraw(
      ethers.utils.parseUnits(withdrawAmount, 6),
      usdcContract.address,
    )
    await liquidityPoolDummy.getDelta()
    const reactorWethBalanceAfter = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )
    const reactorUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
        6,
      ),
    )

    const LpUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    const reactorDelta = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )

    expect(reactorWethBalanceAfter).to.be.below(reactorWethBalanceBefore)
    expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.equal(parseFloat(withdrawAmount))
    expect(reactorUsdcBalanceAfter).to.equal(0)
    expect(reactorDelta).to.to.equal(reactorWethBalanceAfter)
  })

  it('liquidates all ETH and withdraws but does not have enough funds', async () => {
    // If withdraw amount is greater than the value of assets in the reactor, it should liquidate everything and send all to the LP
    const LpUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    const reactorUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
        6,
      ),
    )
    const reactorWethBalanceBefore = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )
    expect(reactorWethBalanceBefore).to.be.above(0)
    const withdrawAmount = '100000000' //100 million
    const tx = await liquidityPoolDummy.withdraw(
      ethers.utils.parseUnits(withdrawAmount, 6),
      usdcContract.address,
    )

    await tx.wait()
    const LpUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )

    const reactorUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(uniswapV3HedgingReactor.address)),
        6,
      ),
    )
    const reactorWethBalanceAfter = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )

    expect(LpUsdcBalanceAfter - LpUsdcBalanceBefore).to.be.below(parseFloat(withdrawAmount))
    expect(reactorWethBalanceAfter).to.equal(0)
    expect(reactorUsdcBalanceAfter).to.equal(0)
  })

  it('update returns 0', async () => {
    const tx = await liquidityPoolDummy.update()
    // const result = await tx.wait()
  })

  it('updates poolFee', async () => {
    let poolFee = await uniswapV3HedgingReactor.poolFee()
    expect(poolFee).to.equal(3000)
    const tx = await uniswapV3HedgingReactor.changePoolFee(1000)
    poolFee = await uniswapV3HedgingReactor.poolFee()
    expect(poolFee).to.equal(1000)
    console.log(poolFee)
  })

  it('update pool fee reverts if not owner', async () => {
    await expect(uniswapV3HedgingReactor.connect(signers[1]).changePoolFee(10000)).to.be.reverted
    let poolFee = await uniswapV3HedgingReactor.poolFee()
    expect(poolFee).to.equal(1000)
  })

  it('withdraw reverts if not called form liquidity pool', async () => {
    await expect(
      uniswapV3HedgingReactor.withdraw(100000000000, usdcContract.address),
    ).to.be.revertedWith('!vault')
  })
  it('hedgeDelta reverts if not called from liquidity pool', async () => {
    await expect(
      uniswapV3HedgingReactor.hedgeDelta(ethers.utils.parseEther('-10')),
    ).to.be.revertedWith('!vault')
  })
})
