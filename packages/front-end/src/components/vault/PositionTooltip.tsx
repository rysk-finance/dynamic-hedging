import React from "react";
import { DHV_NAME, ZERO_UINT_256 } from "../../config/constants";
import { useUserPosition } from "../../hooks/useUserPosition";
import { Currency } from "../../types";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { RyskTooltip } from "../RyskTooltip";

export const PositionTooltip = () => {
  const { positionBreakdown } = useUserPosition();

  const TooltipMessage = () => {
    return (
      <div className="text-right">
        <div className="flex justify-between items-center">
          <p className="mr-12">Deposits on hold: </p>
          {positionBreakdown.usdcOnHold?._hex !== ZERO_UINT_256 ? (
            <p>
              <BigNumberDisplay currency={Currency.USDC} suffix={"USDC"}>
                {positionBreakdown.usdcOnHold}
              </BigNumberDisplay>
            </p>
          ) : (
            <p>-</p>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="mr-12">Withdrawals on hold: </p>
          {positionBreakdown.pendingWithdrawShares?.amount._hex !==
          ZERO_UINT_256 ? (
            <p>
              <BigNumberDisplay currency={Currency.RYSK} suffix={DHV_NAME}>
                {positionBreakdown.pendingWithdrawShares?.amount ?? null}
              </BigNumberDisplay>{" "}
              @{" "}
              <BigNumberDisplay
                currency={Currency.RYSK}
                suffix={`USDC per ${DHV_NAME}`}
              >
                {positionBreakdown.pendingWithdrawShares?.epochPrice ?? null}
              </BigNumberDisplay>
            </p>
          ) : (
            <p>-</p>
          )}
        </div>
        <hr className="border-black border-1 my-2" />
        <div className="flex justify-between items-center">
          <p className="mr-12">Redeemed shares: </p>
          {positionBreakdown.redeemedShares?._hex !== ZERO_UINT_256 ? (
            <p>
              <BigNumberDisplay currency={Currency.RYSK} suffix={DHV_NAME}>
                {positionBreakdown.redeemedShares}
              </BigNumberDisplay>{" "}
              @{" "}
              <BigNumberDisplay
                currency={Currency.RYSK}
                suffix={`USDC per ${DHV_NAME}`}
              >
                {positionBreakdown.currentWithdrawSharePrice}
              </BigNumberDisplay>
            </p>
          ) : (
            <p>-</p>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="mr-12">Unredeemed shares: </p>
          <p>
            <BigNumberDisplay currency={Currency.RYSK} suffix={DHV_NAME}>
              {positionBreakdown.unredeemedShares}
            </BigNumberDisplay>{" "}
            @{" "}
            <BigNumberDisplay
              currency={Currency.RYSK}
              suffix={`USDC per ${DHV_NAME}`}
            >
              {positionBreakdown.currentWithdrawSharePrice}
            </BigNumberDisplay>
          </p>
        </div>
      </div>
    );
  };

  return (
    <RyskTooltip
      message={<TooltipMessage />}
      id={"positionTip"}
      tooltipProps={{ place: "bottom" }}
      color="white"
      iconProps={{ className: "translate-y-[2px]" }}
    ></RyskTooltip>
  );
};
