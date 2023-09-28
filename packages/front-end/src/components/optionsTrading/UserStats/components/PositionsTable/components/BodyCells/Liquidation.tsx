import type { AdjustingOption } from "src/state/types";
import type { LiquidationProps } from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const Liquidation = ({
  amount,
  collateral,
  expiryTimestamp,
  id,
  isPut,
  series,
  strike,
}: LiquidationProps) => {
  const {
    dispatch,
    state: { ethPrice },
  } = useGlobalContext();

  const {
    amount: collateralAmount,
    asset,
    liquidationPrice,
    vault,
  } = collateral;

  const handleCollateralClick = (option: AdjustingOption) => () => {
    dispatch({
      type: ActionType.SET_ADJUSTING_OPTION,
      option,
    });
  };

  if (asset && collateralAmount && vault) {
    const isPartOfSpread = Boolean(vault.longCollateral);

    // Highlight positions where the liquidation price is within 3% of the underlying.
    const liquidationThreshold = 1.03;
    const inDanger = ethPrice
      ? isPut
        ? ethPrice < liquidationPrice * liquidationThreshold
        : ethPrice > liquidationPrice / liquidationThreshold
      : false;
    const textColor =
      inDanger && liquidationPrice && !isPartOfSpread
        ? "text-red-900"
        : "text-black";

    return (
      <td className="col-span-2 font-dm-mono xl:!text-xs 2xl:!text-sm">
        <button
          className={`w-full h-full decoration-dotted underline ease-in-out duration-200 ${textColor}`}
          disabled={isPartOfSpread}
          onClick={handleCollateralClick({
            address: id,
            amount: Math.abs(amount),
            asset,
            collateralAmount,
            expiryTimestamp,
            isPut,
            liquidationPrice,
            series,
            strike: Number(strike[0]),
            vault,
          })}
        >
          {liquidationPrice && !isPartOfSpread ? (
            <>
              <RyskCountUp prefix="$" value={collateral.liquidationPrice} />
              {` (`}
              <RyskCountUp
                prefix={collateral.asset === "USDC" ? "$" : "Ξ"}
                value={collateral.amount}
              />
              {`)`}
            </>
          ) : (
            "Fully Collateralised"
          )}
        </button>
      </td>
    );
  } else {
    return <td className="col-span-2 font-dm-mono">{`N/A`}</td>;
  }
};
