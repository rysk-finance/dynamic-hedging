import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

import { DownChevron, UpChevron } from "src/Icons";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import Resize from "src/animation/Resize";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { useGlobalContext } from "src/state/GlobalContext";

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
          className="block border-b-2 border-black border-dashed overflow-y-scroll"
          {...Resize(
            compact ? compactOffHeight : 442,
            compact ? 442 : compactOffHeight
          )}
        >
          {inactivePositions.map(
            (
              { entry, id, isShort, oraclePrice, profitLoss, series, size },
              index
            ) => {
              const dynamicSeriesClasses = isShort
                ? "text-red-900"
                : "text-green-1100";
              const dynamicPnLClasses =
                typeof profitLoss === "number"
                  ? profitLoss < 0
                    ? "text-red-900"
                    : "text-green-1100"
                  : "text-red-900";

              return (
                <motion.tr
                  className="grid grid-cols-5 text-center capitalize [&_td]:border-l-2 first:[&_td]:border-0 [&_td]:border-gray-500 [&_td]:border-dashed [&_td]:py-2.5 [&_td]:text-2xs [&_td]:xl:text-sm"
                  key={id}
                  layout="position"
                  {...FadeInUpDelayed(Math.min(index * 0.1, 2))}
                >
                  <td className={`flex justify-center ${dynamicSeriesClasses}`}>
                    {isShort ? (
                      <DownChevron
                        aria-hidden={true}
                        className="min-w-6 h-6 mx-3 stroke-red-900"
                        strokeWidth={2}
                      />
                    ) : (
                      <UpChevron
                        aria-hidden={true}
                        className="min-w-6 h-6 mx-3 stroke-green 1100"
                        strokeWidth={2}
                      />
                    )}
                    <span className="w-2/3">{series}</span>
                  </td>
                  <td className="font-dm-mono">
                    {<RyskCountUp value={size} />}
                  </td>
                  <td className={`font-dm-mono ${dynamicPnLClasses}`}>
                    {profitLoss !== undefined ? (
                      <RyskCountUp value={profitLoss} />
                    ) : (
                      `Liquidated`
                    )}
                  </td>
                  <td className="font-dm-mono">
                    <RyskCountUp value={entry} />
                  </td>
                  <td className="font-dm-mono">
                    <RyskCountUp value={oraclePrice} />
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
