import { Signer, BigNumber } from "ethers";
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import { DeployFunction, DeployResult} from 'hardhat-deploy/types';
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { getContractFromDeploy } from "../utils/deploy";
import { PriceFeed } from "../types/PriceFeed";
import { OptionRegistry } from "../types/OptionRegistry";
import { LiquidityPools } from "../types/LiquidityPools";

const ETH_USD_AGGREGATOR = "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e";
const USDC_ADDRESS = "0x4dbcdf9b62e891a7cec5a2568c3f4faf9e8abe2b";
const WETH9_ADDRESS = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
const IMPLIED_VOL = '60';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy, execute, read, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const signers: Signer[] = await ethers.getSigners();
  const [signer] = signers;
  const signerAddress = await signer.getAddress();
  console.log({signerAddress, deployer})

   let normDistDeploy: DeployResult = await deploy("NormalDist", {
     from: deployer,
     log: true
   });

  let constantsDeploy: DeployResult = await deploy("Constants", {
    from: deployer,
    log: true
  });

  let liquidityPoolsDeploy: DeployResult = await deploy("LiquidityPools", {
    from: deployer,
    log: true,
    libraries: {
      Constants: constantsDeploy.address,
      NormalDist: normDistDeploy.address
    }
  });

  let liquidityPools: LiquidityPools = getContractFromDeploy(liquidityPoolsDeploy, signer) as unknown as LiquidityPools;

  let optionRegistryDeploy: DeployResult = await deploy("OptionRegistry", {
    from: deployer,
    libraries: {
      Constants: constantsDeploy.address
    },
    args: [USDC_ADDRESS],
    log: true
  });

  let optionRegistry: OptionRegistry = getContractFromDeploy(optionRegistryDeploy, signer) as unknown as OptionRegistry;

  let pricefeedDeploy: DeployResult = await deploy("PriceFeed", {
    from: deployer,
    log: true
  });

  const priceFeed: PriceFeed = getContractFromDeploy(pricefeedDeploy, signer) as unknown as PriceFeed;
  await priceFeed.addPriceFeed(WETH9_ADDRESS, USDC_ADDRESS, ETH_USD_AGGREGATOR);

  let protocolDeploy: DeployResult = await deploy("Protocol", {
    from: deployer,
    args: [optionRegistryDeploy.address, liquidityPoolsDeploy.address, pricefeedDeploy.address],
    log: true
  });

  await liquidityPools.setup(protocolDeploy.address);

  const lp = await liquidityPools.createLiquidityPool(
    USDC_ADDRESS,
    WETH9_ADDRESS,
    '3',
    IMPLIED_VOL,
    'WETH/USDC',
    'EUS'
  );
  const lpReceipt = await lp.wait(1);
  const events = lpReceipt.events;
  const createEvent = events?.find(x => x.event == 'LiquidityPoolCreated');
  const lpAddress = createEvent?.args?.lp;
  console.log({lpAddress})
}

func.tags = ["testnet"];
export default func;
