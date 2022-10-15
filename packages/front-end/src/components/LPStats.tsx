import React, { useEffect, useMemo, useState } from "react";
import ProgressBar from "@ramonak/react-progress-bar";
import { useContract } from "../hooks/useContract";
import LPABI from "../abis/LiquidityPool.json";
import { BigNumber, ethers } from "ethers";
import { Loader } from "./Loader";
import { BIG_NUMBER_DECIMALS, DECIMALS } from "../config/constants";
import NumberFormat from "react-number-format";

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
      // TODO uncomment this before production and remove lines below
      if (lpContract) {
        if (process.env.REACT_APP_ENV === "production" ) {
          const cap = await lpContract.collateralCap();
          setCollateralCap(cap);
        } else {
          const cap = BigNumber.from(10).mul(1e6).mul(BIG_NUMBER_DECIMALS.RYSK)
          setCollateralCap( cap );
        }
      }
    };

    getDepositedCollateral();
    getCollateralCap();
  }, [lpContract]);

  const showDeposit = useMemo(() => {

    if (depositedCollateral && collateralCap ) {
      return depositedCollateral?.gte(collateralCap) ? collateralCap : depositedCollateral
    } 
    

  }, [depositedCollateral, collateralCap]);

  return (
    <div className="mt-8">
      <div className="flex justify-between mb-4">
        {depositedCollateral ? (
          <>
            <div>
              <p className="text-xl font-medium">
                <NumberFormat 
                value={ ethers.utils.formatUnits(showDeposit ? showDeposit : depositedCollateral, DECIMALS.RYSK) } 
                displayType={"text"}
                suffix=" USDC"
                decimalScale={0}
                thousandSeparator={true}
                />
              </p>
              <p>Total Deposits</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-medium">
                {collateralCap &&
                  <NumberFormat 
                    value={ ethers.utils.formatUnits(collateralCap, DECIMALS.RYSK) } 
                    displayType={"text"}
                    suffix=" USDC"
                    decimalScale={0}
                    thousandSeparator={true}
                  />
                }
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
        completed={ Math.round(Number( showDeposit ? showDeposit : depositedCollateral ) / Number(collateralCap) * 100)  }
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
