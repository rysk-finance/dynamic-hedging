import ProgressBar from "@ramonak/react-progress-bar";
import { useMemo } from "react";
import NumberFormat from "react-number-format";

import { Loader } from "./Loader";
import { useGlobalContext } from "src/state/GlobalContext";

export const LPStats = () => {
  const {
    state: {
      options: {
        liquidityPool: { collateralCap, totalAssets },
      },
    },
  } = useGlobalContext();

  const progress = useMemo(
    () => (totalAssets / collateralCap) * 100,
    [totalAssets, collateralCap]
  );

  return (
    <div className="mt-8">
      <div className="flex justify-between mb-4">
        {totalAssets ? (
          <>
            <div>
              <p className="text-xl font-medium">
                <NumberFormat
                  value={totalAssets}
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
                    value={collateralCap}
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

      {Boolean(totalAssets) && (
        <ProgressBar
          completed={Math.round(progress)}
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
