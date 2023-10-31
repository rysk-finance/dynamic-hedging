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
  isSpread,
  series,
  strikes,
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

  if (asset && vault) {
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
          className={`w-full h-full decoration-dotted ease-in-out duration-200 ${textColor}`}
          disabled={!liquidationPrice || isPartOfSpread}
          onClick={handleCollateralClick({
            address: id,
            amount: Math.abs(amount),
            asset,
            collateralAmount,
            expiryTimestamp,
            isPut,
            liquidationPrice,
            series: series[0],
            strike: Number(strikes[0]),
            vault,
          })}
        >
          {liquidationPrice && !isPartOfSpread ? (
            <span className="underline">
              <RyskCountUp prefix="$" value={collateral.liquidationPrice} />
              {` (`}
              <RyskCountUp
                prefix={collateral.asset === "USDC" ? "$" : "Ξ"}
                value={collateral.amount}
              />
              {`)`}
            </span>
          ) : (
            <span className="block">
              <p className="leading-8">{`Fully Collateralised`}</p>
              {Boolean(collateralAmount && isSpread) && (
                <span>
                  <p className="leading-8">
                    {`(`}
                    <RyskCountUp prefix="$" value={collateralAmount} />
                    {`)`}
                  </p>
                </span>
              )}
            </span>
          )}
        </button>
      </td>
    );
  } else {
    return <td className="col-span-2 font-dm-mono">{`N/A`}</td>;
  }
};
