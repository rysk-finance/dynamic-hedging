import React, { useEffect, useState } from "react";
import ProgressBar from "@ramonak/react-progress-bar";
import { useContract } from "../hooks/useContract";
import LPABI from "../abis/LiquidityPool.json";
import { BigNumber } from "ethers";
import { Loader } from "./Loader";

export const LPStats = () => {
  const [depositedCollateral, setDepositedCollateral] =
    useState<BigNumber | null>(null);
  const [collateralCap, setCollateralCap] = useState<BigNumber | null>(null);

  const [lpContract] = useContract({
    contract: "liquidityPool",
    ABI: LPABI,
    readOnly: true,
  });

  useEffect(() => {
    const getDepositedCollateral = async () => {
      if (lpContract) {
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
    <div className="mt-8">
      <div className="flex justify-between mb-4">
        {depositedCollateral ? (
          <>
            <div>
              <p className="text-xl font-medium">
                {/* <NumberFormat 
                value={ ethers.utils.formatUnits(depositedCollateral, DECIMALS.RYSK) } 
                displayType={"text"}
                suffix=" USDC"
                decimalScale={0}
                thousandSeparator={true}
                /> */}
                60k USDC
              </p>
              <p>Total Deposits</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-medium">
                {/* TODO(HC): Switch back to contract collateral cap once placeholder max256 value isn't used */}
                {/* {collateralCap &&
              ethers.utils.formatUnits(collateralCap, DECIMALS.RYSK)}{" "} */}
                100k USDC
              </p>
              <p>Vault Max Capacity</p>
            </div>
          </>
        ) : (
          <div className="h-12 flex">
            <Loader className="h-8" />
          </div>
        )}
      </div>
      <ProgressBar
        completed={60}
        bgColor={"#000"}
        height={"24px"}
        baseBgColor={"#ebebeb"}
        animateOnRender={true}
        borderRadius={"9px"}
        className={"border-2 border-2 rounded-xl border-black"}
      />
    </div>
  );
};
