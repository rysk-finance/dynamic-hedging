import { Signer, BigNumber } from "ethers";
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import { DeployFunction, DeployResult} from 'hardhat-deploy/types';
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { getContractFromDeploy } from "../utils/deploy";
import { PriceFeed } from "../types/PriceFeed";
import { OptionRegistry } from "../types/OptionRegistry";
import { LiquidityPools } from "../types/LiquidityPools";

const ETH_USD_AGGREGATOR = "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e";
const DAI_ADDRESS = "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa";
const WETH9_ADDRESS = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
const IMPLIED_VOL = '60';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy, execute, read, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const signers: Signer[] = await ethers.getSigners();
  const [signer] = signers;
  const signerAddress = await signer.getAddress();
  console.log({signerAddress, deployer})

  let abdkMathDeploy: DeployResult = await deploy("ABDKMathQuad", {
    from: deployer,
    log: true
  });

  let PRBMathSD60x18Deploy: DeployResult = await deploy("PRBMathUint", {
    from: deployer,
    log: true
  });

  let PRBMathSD59x18Deploy: DeployResult = await deploy("PRBMathInt", {
    from: deployer,
    log: true
  });

  let normDistDeploy: DeployResult = await deploy("NormalDist", {
    from: deployer,
    log: true,
    libraries: {
      ABDKMathQuad: abdkMathDeploy.address
    }
  });

  let blackScholesDeploy: DeployResult = await deploy("BlackScholes", {
    from: deployer,
    log: true,
    libraries: {
      ABDKMathQuad: abdkMathDeploy.address,
      NormalDist: normDistDeploy.address
    }
  });

  let constantsDeploy: DeployResult = await deploy("Constants", {
    from: deployer,
    log: true
  });

  let optionRegistryDeploy: DeployResult = await deploy("OptionRegistry", {
    from: deployer,
    libraries: {
      Constants: constantsDeploy.address
    },
    args: [DAI_ADDRESS],
    log: true
  });

  let optionRegistry: OptionRegistry = getContractFromDeploy(optionRegistryDeploy, signer) as unknown as OptionRegistry;

  let pricefeedDeploy: DeployResult = await deploy("PriceFeed", {
    from: deployer,
    log: true
  });

  const priceFeed: PriceFeed = getContractFromDeploy(pricefeedDeploy, signer) as unknown as PriceFeed;
  await priceFeed.addPriceFeed(WETH9_ADDRESS, DAI_ADDRESS, ETH_USD_AGGREGATOR);

  let indliquidityPoolsDeploy: DeployResult = await deploy("IndependentLiquidityPool", {
    from: deployer,
    log: true,
    libraries: {
      Constants: constantsDeploy.address,
      NormalDist: normDistDeploy.address,
      ABDKMathQuad: abdkMathDeploy.address,
      PRBMathUint: PRBMathSD60x18Deploy.address,
      PRBMathInt: PRBMathSD59x18Deploy.address,
      BlackScholes: blackScholesDeploy.address
    },
    args: [pricefeedDeploy.address, optionRegistryDeploy.address, DAI_ADDRESS, WETH9_ADDRESS, '3', IMPLIED_VOL, 'WETH/DAI', 'WEDAI']
  });
  await hre.run("verify:verify", {
    address: indliquidityPoolsDeploy.address,
    constructorArguments: [pricefeedDeploy.address, optionRegistryDeploy.address, DAI_ADDRESS, WETH9_ADDRESS, '3', IMPLIED_VOL, 'WETH/DAI', 'WEDAI'],
    libraries: {
      Constants: constantsDeploy.address
    }
  })

}

func.tags = ["testnet"];
export default func;
