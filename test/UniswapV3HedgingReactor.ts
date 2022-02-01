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
import { OptionRegistry } from '../types/OptionRegistry'
import { assert } from 'console'

let signers: Signer[]
let deployerAddress: string

describe('UniswapV3HedgingReactor', () => {
  it('deploys the liquidity pool', async () => {
    signers = await ethers.getSigners()
    deployerAddress = await signers[0].getAddress()

    const liquidityPoolFactory = await ethers.getContractFactory('LiquidityPool')
    console.log(liquidityPoolFactory)
    // const liquidityPool = await liquidityPoolFactory.deploy()

    // expect(liquidityPool.getAddress().to.be.ok)
  })
})
