import React from "react";
import {
  BIG_NUMBER_DECIMALS,
  DHV_NAME,
  ZERO_UINT_256,
} from "../../config/constants";
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
        <div className="flex justify-between items-center bold">
          <p className="mr-12">Current Vault Balance: </p>
          {positionBreakdown.redeemedShares &&
          positionBreakdown.unredeemedShares &&
          positionBreakdown.redeemedShares.add(
            positionBreakdown.unredeemedShares
          )._hex !== ZERO_UINT_256 &&
          positionBreakdown.currentWithdrawSharePrice ? (
            <p>
              <BigNumberDisplay currency={Currency.USDC} suffix={"USDC"}>
                {positionBreakdown.unredeemedShares
                  .add(positionBreakdown.redeemedShares)
                  .mul(positionBreakdown.currentWithdrawSharePrice)
                  .div(BIG_NUMBER_DECIMALS.RYSK)
                  .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC))}
              </BigNumberDisplay>
            </p>
          ) : (
            <p>-</p>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="mr-12">Withdrawals on hold: </p>
          {positionBreakdown.currentWithdrawSharePrice &&
          positionBreakdown.pendingWithdrawShares &&
          positionBreakdown.pendingWithdrawShares.amount._hex !==
            ZERO_UINT_256 ? (
            <p>
              <BigNumberDisplay currency={Currency.USDC} suffix={"USDC"}>
                {positionBreakdown.pendingWithdrawShares.amount
                  .mul(positionBreakdown.currentWithdrawSharePrice)
                  .div(BIG_NUMBER_DECIMALS.RYSK)
                  .div(
                    BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC)
                  ) ?? null}
              </BigNumberDisplay>
            </p>
          ) : (
            <p>-</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <RyskTooltip
      message={<TooltipMessage />}
      id={"positionTip"}
      tooltipProps={{ place: "bottom", className: "w-fit" }}
      color="white"
      iconProps={{ className: "translate-y-[2px]" }}
    ></RyskTooltip>
  );
};
