import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

import { DownChevron, UpChevron } from "src/Icons";
import { BearishSpread, BullishSpread } from "src/Icons/Strategy";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import Resize from "src/animation/Resize";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";
import { OptionChainModalActions } from "src/state/types";

const getIcon = (
  collateralSeries: string,
  isPut: boolean,
  isShort: boolean
) => {
  const commonClasses = "min-w-6 h-6 mx-auto";

  switch (true) {
    case collateralSeries && isPut:
      return (
        <RyskTooltip
          content={OptionChainModalActions.PUT_CREDIT_SPREAD}
          disabled={!collateralSeries}
        >
          <div className="row-span-2">
            <BullishSpread aria-hidden={true} className={commonClasses} />
          </div>
        </RyskTooltip>
      );

    case collateralSeries && !isPut:
      return (
        <RyskTooltip
          content={OptionChainModalActions.CALL_CREDIT_SPREAD}
          disabled={!collateralSeries}
        >
          <div className="row-span-2">
            <BearishSpread aria-hidden={true} className={commonClasses} />
          </div>
        </RyskTooltip>
      );

    case isShort:
      return (
        <DownChevron
          aria-hidden={true}
          className={`${commonClasses} stroke-red-900`}
          strokeWidth={2}
        />
      );

    default:
      return (
        <UpChevron
          aria-hidden={true}
          className={`${commonClasses} stroke-green-1100`}
          strokeWidth={2}
        />
      );
  }
};

export const Body = () => {
  const {
    state: {
      userStats: {
        inactivePositions,
        inactivePositionsFilters: { compact },
      },
    },
  } = useGlobalContext();

  const compactOffHeight = inactivePositions.length <= 10 ? 442 : "auto";

  return (
    <LayoutGroup>
      <AnimatePresence initial={false}>
        <motion.tbody
          className="block w-[150%] lg:w-full border-b-2 border-black border-dashed overflow-y-scroll rysk-scrollbar rysk-scrollbar-padded"
          {...Resize(
            compact ? compactOffHeight : 442,
            compact ? 442 : compactOffHeight
          )}
        >
          {inactivePositions.map(
            (
              {
                close,
                entry,
                id,
                isPut,
                isShort,
                oraclePrice,
                profitLoss,
                series,
                size,
              },
              index
            ) => {
              const [positionSeries, collateralSeries] = series;

              const height = collateralSeries ? "h-8" : "h-11";
              const dynamicPnLClasses =
                typeof profitLoss === "number"
                  ? profitLoss < 0
                    ? "text-red-900"
                    : "text-green-1100"
                  : "text-red-900";

              return (
                <motion.tr
                  className="grid grid-cols-6 items-center text-center capitalize [&_td]:border-b [&_td]:border-l-2 first:[&_td]:border-l-0 [&_td]:border-gray-500 [&_td]:border-dashed [&_td]:text-2xs [&_td]:xl:text-sm [&_td]:h-full [&_td]:flex [&_td]:items-center [&_td]:justify-center [&_td]:p-0 group/strategy-icon"
                  key={id}
                  layout="position"
                  {...FadeInUpDelayed(Math.min(index * 0.1, 2))}
                >
                  <td className="w-full !grid grid-cols-3 items-center">
                    {getIcon(collateralSeries, isPut, isShort)}

                    <span
                      className={`inline-flex items-center mx-auto col-span-2 text-xs 2xl:text-sm ${height} ${
                        isShort ? "text-red-900" : "text-green-1100"
                      }`}
                    >
                      {positionSeries}
                    </span>

                    {collateralSeries && (
                      <span
                        className={`inline-flex items-center mx-auto col-span-2 col-start-2 text-xs 2xl:text-sm text-green-1100 ${height}`}
                      >
                        {collateralSeries}
                      </span>
                    )}
                  </td>
                  <td className="font-dm-mono">
                    {<RyskCountUp value={size} />}
                  </td>
                  <td className="font-dm-mono">
                    <RyskCountUp value={entry} />
                  </td>
                  <td className="font-dm-mono">
                    <RyskCountUp value={close} />
                  </td>
                  <td className={`font-dm-mono ${dynamicPnLClasses}`}>
                    {profitLoss !== undefined ? (
                      <RyskCountUp value={profitLoss} />
                    ) : (
                      `Liquidated`
                    )}
                  </td>
                  <td className="font-dm-mono">
                    {close ? `N/A` : <RyskCountUp value={oraclePrice} />}
                  </td>
                </motion.tr>
              );
            }
          )}
        </motion.tbody>
      </AnimatePresence>
    </LayoutGroup>
  );
};
