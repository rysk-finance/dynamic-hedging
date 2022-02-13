import hre, { ethers, network } from 'hardhat'
import { BigNumberish, Contract, ContractFactory, utils, Signer, BigNumber } from 'ethers'
import { expect } from 'chai'
import { MintableERC20 } from '../types/MintableERC20'
import { UniswapV3HedgingReactor } from '../types/UniswapV3HedgingReactor'
import { UniswapV3HedgingTest } from '../types/UniswapV3HedgingTest'
import { USDC_ADDRESS, USDC_OWNER_ADDRESS, WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER } from './constants'
import { toWei } from '../utils/conversion-helper'

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

  it('changes nothing if no ETH balance and hedging positive delta', async () => {
    wethContract = (await ethers.getContractAt('ERC20', WETH_ADDRESS[chainId])) as MintableERC20
    const reactorWethBalanceBefore = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )

    expect(reactorWethBalanceBefore).to.equal(0)

    const reactorDeltaBefore = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )
    const LpUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )

    await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther('20'))

    const reactorWethBalanceAfter = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )
    const reactorDeltaAfter = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )
    const LpUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )

    expect(reactorDeltaBefore).to.equal(reactorDeltaAfter)
    expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
    expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
  })

  it('hedges a negative delta', async () => {
    const LpUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther('-20'))
    await hedgeDeltaTx.wait()
    const reactorWethBalance = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
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
    expect(reactorDelta).to.equal(20)
    expect(reactorWethBalance).to.equal(20)
    expect(LpUsdcBalanceBefore).to.be.above(LpUsdcBalanceAfter)
  })
  it('getDelta returns correct value', async () => {
    const reactorDelta = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )
    expect(reactorDelta).to.equal(20)
  })
  it('hedges a positive delta with sufficient funds', async () => {
    const LpUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )

    const hedgeDeltaTx = await liquidityPoolDummy.hedgeDelta(ethers.utils.parseEther('15'))
    await hedgeDeltaTx.wait()

    const LpUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    const reactorWethBalance = parseFloat(
      ethers.utils.formatEther(
        BigNumber.from(await wethContract.balanceOf(uniswapV3HedgingReactor.address)),
      ),
    )

    const reactorDelta = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
    )
    // no funds being withdrawn to LP so balance should be unchanged
    expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
    expect(reactorDelta).to.equal(20 - 15)
    expect(reactorWethBalance).to.equal(20 - 15)
  })
  it('hedges a positive delta with insufficient funds', async () => {
    // has a balance of 5 wETH at this point
    // try to hedge another 15 delta
    const LpUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
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
    const LpUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
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

    const reactorDeltaBefore = parseFloat(
      ethers.utils.formatEther(BigNumber.from(await liquidityPoolDummy.getDelta())),
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
    const reactorDeltaAfter = parseFloat(
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
    expect(reactorDeltaAfter).to.equal(reactorWethBalanceAfter)
    expect(reactorDeltaBefore).to.equal(reactorDeltaAfter)
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
    expect(reactorDelta).to.equal(reactorWethBalanceAfter)
  })

  it('liquidates all ETH and withdraws but does not have enough funds', async () => {
    // If withdraw amount is greater than the value of assets in the reactor, it should liquidate everything and send all to the LP
    const LpUsdcBalanceBefore = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
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

  it('update changes no balances', async () => {
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
    const tx = await liquidityPoolDummy.update()
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
    const LpUsdcBalanceAfter = parseFloat(
      ethers.utils.formatUnits(
        BigNumber.from(await usdcContract.balanceOf(liquidityPoolDummy.address)),
        6,
      ),
    )
    expect(reactorUsdcBalanceBefore).to.equal(reactorUsdcBalanceAfter)
    expect(reactorWethBalanceBefore).to.equal(reactorWethBalanceAfter)
    expect(LpUsdcBalanceBefore).to.equal(LpUsdcBalanceAfter)
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
