import { Contract, Signer } from "ethers";
import { DeployResult } from 'hardhat-deploy/types';

export function getContractFromDeploy(deploy: DeployResult, signer: Signer) {
  return new Contract(
    deploy.address,
    deploy.abi,
    signer
  );
}
