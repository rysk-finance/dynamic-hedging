import ProgressBar from "@ramonak/react-progress-bar";
import { BigNumber, ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
import NumberFormat from "react-number-format";
import { useContract, useProvider } from "wagmi";

import LPABI from "../abis/LiquidityPool.json";
import { BIG_NUMBER_DECIMALS, DECIMALS } from "../config/constants";
import { ETHNetwork } from "../types";
import { Loader } from "./Loader";
import { getContractAddress } from "src/utils/helpers";

export const LPStats = () => {
  const provider = useProvider();

  const [depositedCollateral, setDepositedCollateral] =
    useState<BigNumber | null>(null);
  const [collateralCap, setCollateralCap] = useState<BigNumber | null>(null);

  const lpContract = useContract({
    address: getContractAddress("liquidityPool"),
    abi: LPABI,
    signerOrProvider: provider,
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
        if (process.env.REACT_APP_NETWORK === ETHNetwork.ARBITRUM_MAINNET) {
          const cap = await lpContract.collateralCap();
          setCollateralCap(cap);
        } else {
          const cap = BigNumber.from(10).mul(1e6).mul(BIG_NUMBER_DECIMALS.RYSK);
          setCollateralCap(cap);
        }
      }
    };

    getDepositedCollateral();
    getCollateralCap();
  }, [lpContract]);

  const showDeposit = useMemo(() => {
    if (depositedCollateral && collateralCap) {
      return depositedCollateral?.gte(collateralCap)
        ? collateralCap
        : depositedCollateral;
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
                  value={ethers.utils.formatUnits(
                    showDeposit ? showDeposit : depositedCollateral,
                    DECIMALS.RYSK
                  )}
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
                {collateralCap && (
                  <NumberFormat
                    value={ethers.utils.formatUnits(
                      collateralCap,
                      DECIMALS.RYSK
                    )}
                    displayType={"text"}
                    suffix=" USDC"
                    decimalScale={0}
                    thousandSeparator={true}
                  />
                )}
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
      {depositedCollateral && (
        <ProgressBar
          completed={Math.round(
            (Number(showDeposit ? showDeposit : depositedCollateral) /
              Number(collateralCap)) *
              100
          )}
          bgColor={"#000"}
          height={"24px"}
          baseBgColor={"#ebebeb"}
          animateOnRender={true}
          borderRadius={"9px"}
          className={"border-2 border-2 rounded-xl border-black"}
        />
      )}
    </div>
  );
};
