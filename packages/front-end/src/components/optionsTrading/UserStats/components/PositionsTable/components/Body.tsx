import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useMemo } from "react";

import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import Resize from "src/animation/Resize";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActivePositionSort } from "src/state/constants";
import { Action } from "./BodyCells/Action";
import { BreakEven } from "./BodyCells/BreakEven";
import { Delta } from "./BodyCells/Delta";
import { Entry } from "./BodyCells/Entry";
import { Liquidation } from "./BodyCells/Liquidation";
import { Mark } from "./BodyCells/Mark";
import { ProfitLoss } from "./BodyCells/ProfitLoss";
import { Series } from "./BodyCells/Series";
import { Size } from "./BodyCells/Size";

export const Body = () => {
  const {
    state: {
      userStats: {
        activePositions,
        activePositionsFilters: { compact, hideExpired, isAscending, sort },
      },
    },
  } = useGlobalContext();

  const sortedActivePositions = useMemo(() => {
    return activePositions
      .sort((first, second) => {
        switch (sort) {
          case ActivePositionSort.Size:
            return isAscending
              ? first.amount - second.amount
              : second.amount - first.amount;

          case ActivePositionSort.Delta:
            return isAscending
              ? first.delta - second.delta
              : second.delta - first.delta;

          case ActivePositionSort.PnL:
            return isAscending
              ? first.profitLoss - second.profitLoss
              : second.profitLoss - first.profitLoss;

          default:
            return isAscending
              ? first.expiryTimestamp.localeCompare(second.expiryTimestamp)
              : second.expiryTimestamp.localeCompare(first.expiryTimestamp);
        }
      })
      .filter((position) => (hideExpired ? position.isOpen : position));
  }, [activePositions, hideExpired, isAscending, sort]);

  const compactOffHeight = sortedActivePositions.length <= 5 ? 222 : "auto";

  return (
    <LayoutGroup>
      <motion.tbody
        className="block border-b-2 border-black border-dashed overflow-y-scroll rysk-scrollbar rysk-scrollbar-padded"
        {...Resize(
          compact ? compactOffHeight : 222,
          compact ? 222 : compactOffHeight
        )}
      >
        <AnimatePresence>
          {sortedActivePositions.map((activePosition, index) => {
            const {
              amount,
              breakEven,
              delta,
              entry,
              id,
              isShort,
              mark,
              profitLoss,
              series,
            } = activePosition;

            return (
              <motion.tr
                className="grid grid-cols-12 text-center capitalize [&_td]:border-l-2 first:[&_td]:border-0 [&_td]:border-gray-500 [&_td]:border-dashed [&_td]:py-2.5 [&_td]:text-2xs [&_td]:xl:text-sm"
                key={`${id}-${isShort ? "SHORT" : "LONG"}`}
                layout="position"
                {...FadeInUpDelayed(Math.min(index * 0.1, 2))}
              >
                <Series isShort={isShort} series={series} />
                <Size amount={amount} />
                <Delta delta={delta} />
                <ProfitLoss profitLoss={profitLoss} />
                <Entry entry={entry} />
                <Mark mark={mark} />
                <Liquidation {...activePosition} />
                <BreakEven breakEven={breakEven} />
                <Action {...activePosition} />
              </motion.tr>
            );
          })}
        </AnimatePresence>
      </motion.tbody>
    </LayoutGroup>
  );
};
