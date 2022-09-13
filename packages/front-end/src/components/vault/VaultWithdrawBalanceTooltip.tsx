import React from "react";
import { DHV_NAME, ZERO_UINT_256 } from "../../config/constants";
import { useUserPosition } from "../../hooks/useUserPosition";
import { Currency } from "../../types";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { RyskTooltip } from "../RyskTooltip";

export const VaultWithdrawBalanceTooltip = () => {
  const { positionBreakdown } = useUserPosition();

  const TooltipMessage = () => {
    return (
      <div className="text-right">
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
          {positionBreakdown.unredeemedShares?._hex !== ZERO_UINT_256 ? (
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
      id={"withdrawBalanceTip"}
      tooltipProps={{ place: "bottom" }}
      iconProps={{ className: "translate-y-[3px] translate-x-[-2px]" }}
    ></RyskTooltip>
  );
};
