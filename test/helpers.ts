import hre, { ethers} from "hardhat";
import {
  CHAINLINK_WETH_PRICER,
  GAMMA_ORACLE,
  GAMMA_WHITELIST,
  ORACLE_DISPUTE_PERIOD,
  ORACLE_LOCKING_PERIOD,
  ORACLE_OWNER,
  USDC_ADDRESS,
  WETH_ADDRESS,
} from "./constants";
import { BigNumber,Contract } from "ethers";
const { provider } = ethers;
const { parseEther } = ethers.utils;
const chainId = 1;
import {MockChainlinkAggregator} from "../types/MockChainlinkAggregator";
import {ChainLinkPricer} from "../types/ChainLinkPricer";

export async function whitelistProduct(
  underlying: string,
  strike: string,
  collateral: string,
  isPut: boolean
) {
  const [adminSigner] = await ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ORACLE_OWNER[chainId]],
  });

  const ownerSigner = await provider.getSigner(ORACLE_OWNER[chainId]);

  const whitelist = await ethers.getContractAt(
    "IGammaWhitelist",
    GAMMA_WHITELIST[chainId]
  );

  await adminSigner.sendTransaction({
    to: ORACLE_OWNER[chainId],
    value: parseEther("1"),
  });

  await whitelist.connect(ownerSigner).whitelistCollateral(collateral);

  await whitelist
    .connect(ownerSigner)
    .whitelistProduct(underlying, strike, collateral, isPut);
}

export async function setupOracle(
  chainlinkPricer: string,
  signerAddress: string,
  useNew = false
) {
    const signer = await provider.getSigner(signerAddress);
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [chainlinkPricer],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ORACLE_OWNER[chainId]],
  });
  const pricerSigner = await provider.getSigner(chainlinkPricer);

  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
  await forceSend
    .connect(signer)
    .go(chainlinkPricer, { value: parseEther("0.5") });

  const oracle = await ethers.getContractAt(
    "Oracle",
    GAMMA_ORACLE[chainId],
  );

  const oracleOwnerSigner = await provider.getSigner(ORACLE_OWNER[chainId]);

  await signer.sendTransaction({
    to: ORACLE_OWNER[chainId],
    value: parseEther("0.5"),
  });
  await oracle
    .connect(oracleOwnerSigner)
    .setStablePrice(USDC_ADDRESS[chainId], "100000000");
const pricer = await ethers.getContractAt(
        "ChainLinkPricer",
        chainlinkPricer,
        )

await oracle
    .connect(oracleOwnerSigner)
    .setAssetPricer(await pricer.asset(), chainlinkPricer);
  return oracle;
}

export async function setupTestOracle(
  signerAddress: string,
) {
  const signer = await provider.getSigner(signerAddress);

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ORACLE_OWNER[chainId]],
  });

  const oracle = await ethers.getContractAt(
    "Oracle",
    GAMMA_ORACLE[chainId],
  );

  const oracleOwnerSigner = await provider.getSigner(ORACLE_OWNER[chainId]);

  await signer.sendTransaction({
    to: ORACLE_OWNER[chainId],
    value: parseEther("0.5"),
  });
  await oracle
    .connect(oracleOwnerSigner)
    .setStablePrice(USDC_ADDRESS[chainId], "100000000");
  const newAggInstance = await ethers.getContractFactory("MockChainlinkAggregator");
  const aggregator = (await newAggInstance.deploy()) as MockChainlinkAggregator
  const newPricerInstance = await ethers.getContractFactory("ChainLinkPricer");
  const pricer = (await newPricerInstance.deploy(
        signerAddress,
        WETH_ADDRESS[chainId],
        aggregator.address,
        oracle.address
    )) as ChainLinkPricer
const price = await oracle.getPrice(WETH_ADDRESS[chainId])
await oracle
    .connect(oracleOwnerSigner)
    .setAssetPricer(await pricer.asset(), pricer.address);
const forceSendContract = await ethers.getContractFactory("ForceSend");
const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
await forceSend
      .connect(signer)
      .go(pricer.address, { value: parseEther("0.5") });
await aggregator.setLatestAnswer(price)
  return [oracle, aggregator, pricer.address];
}

export async function setOpynOracleExpiryPrice(
  asset: string,
  oracle: Contract,
  expiry: number,
  settlePrice: BigNumber,
  pricer?: string
) {
  await increaseTo(expiry + ORACLE_LOCKING_PERIOD + 100);
  if (pricer == undefined) [
    pricer = CHAINLINK_WETH_PRICER[chainId]
  ]
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [pricer],
  });
  const pricerSigner = await provider.getSigner(pricer);
  const res = await oracle.connect(pricerSigner).setExpiryPrice(asset, expiry, settlePrice);

  const receipt = await res.wait();
  const timestamp = (await provider.getBlock(receipt.blockNumber)).timestamp;

  await increaseTo(timestamp + ORACLE_DISPUTE_PERIOD + 1000);
}

export async function increaseTo(target: number | BigNumber) {
    if (!BigNumber.isBigNumber(target)) {
      target = BigNumber.from(target);
    }
  
    const now = BigNumber.from(
      (await ethers.provider.getBlock("latest")).timestamp
    );
  
    if (target.lt(now))
      throw Error(
        `Cannot increase current time (${now}) to a moment in the past (${target})`
      );
  
    const diff = target.sub(now);
    return increase(diff);
  }

  export async function increase(duration: number | BigNumber) {
    if (!BigNumber.isBigNumber(duration)) {
      duration = BigNumber.from(duration);
    }
  
    if (duration.lt(BigNumber.from("0")))
      throw Error(`Cannot increase time by a negative amount (${duration})`);
  
    await ethers.provider.send("evm_increaseTime", [duration.toNumber()]);
  
    await ethers.provider.send("evm_mine", []);
  }