import React, { useEffect, useState } from "react";
import ProgressBar from "@ramonak/react-progress-bar";
import { useContract } from "../hooks/useContract";
import LPABI from "../abis/LiquidityPool.json";
import { BigNumber, ethers } from "ethers";
import { BIG_NUMBER_DECIMALS, DECIMALS } from "../config/constants";

export const LPStats = () => {
  const [depositedCollateral, setDepositedCollateral] =
    useState<BigNumber | null>(null);
  const [collateralCap, setCollateralCap] = useState<BigNumber | null>(null);

  const [lpContract] = useContract({ contract: "liquidityPool", ABI: LPABI });

  useEffect(() => {
    const getDepositedCollateral = async () => {
      if (lpContract) {
        console.log("getting");
        const assets = await lpContract.getAssets();
        setDepositedCollateral(assets);
      }
    };
    const getCollateralCap = async () => {
      if (lpContract) {
        const cap = await lpContract.collateralCap();
        setCollateralCap(cap);
      }
    };

    getDepositedCollateral();
    getCollateralCap();
  }, [lpContract]);

  return (
    <div className="mt-12">
      <div className="flex justify-between mb-4">
        <div>
          <h4>
            {depositedCollateral &&
              ethers.utils.formatUnits(depositedCollateral, DECIMALS.USDC)}{" "}
            60k USDC
          </h4>
          <p>Deposited</p>
        </div>
        <div className="text-right">
          <h4>
            {/* TODO(HC): Switch back to contract collateral cap once placeholder max256 value isn't used */}
            {/* {collateralCap &&
              ethers.utils.formatUnits(collateralCap, DECIMALS.USDC)}{" "} */}
            100k USDC
          </h4>
          <p>Max Capacity</p>
        </div>
      </div>
      <ProgressBar
        completed={60}
        bgColor={"#000"}
        height={"30px"}
        baseBgColor={"#ebebeb"}
        animateOnRender={true}
        borderRadius={"10px"}
        className={"border-2 border-2 rounded-xl border-black"}
      />
    </div>
  );
};
