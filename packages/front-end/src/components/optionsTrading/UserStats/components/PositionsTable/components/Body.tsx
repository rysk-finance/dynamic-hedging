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
        activePositionsFilters: {
          compact,
          hideExpired,
          isAscending,
          returnFormat,
          sort,
        },
      },
    },
  } = useGlobalContext();

  const [, strategyTimestamps] = useMemo(
    () =>
      activePositions.reduce(
        ([unique, duplicates], { firstCreated }) => {
          if (firstCreated) {
            if (unique.includes(firstCreated)) {
              duplicates.push(firstCreated);
            } else {
              unique.push(firstCreated);
            }
          }

          return [unique, duplicates] as [string[], string[]];
        },
        [[], []] as [string[], string[]]
      ),
    [activePositions]
  );

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
        className="block w-[150%] lg:w-full border-b-2 border-black border-dashed overflow-y-scroll rysk-scrollbar rysk-scrollbar-padded"
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
              firstCreated,
              id,
              isPut,
              isShort,
              mark,
              profitLoss,
              returnOnInvestment,
              series,
            } = activePosition;

            const strategyTimestampIndex = firstCreated
              ? strategyTimestamps.indexOf(firstCreated)
              : -1;

            return (
              <motion.tr
                className="grid grid-cols-12 items-center text-center capitalize [&_td]:border-b [&_td]:border-l-2 first:[&_td]:border-l-0 [&_td]:border-gray-500 [&_td]:border-dashed [&_td]:text-2xs [&_td]:xl:text-sm [&_td]:h-full [&_td]:flex [&_td]:items-center [&_td]:justify-center [&_td]:p-0 group/strategy-icon"
                key={`${id}-${isShort ? "SHORT" : "LONG"}-${firstCreated}`}
                layout="position"
                {...FadeInUpDelayed(Math.min(index * 0.1, 2))}
              >
                <Series
                  isPut={isPut}
                  isShort={isShort}
                  series={series}
                  strategyTimestampIndex={strategyTimestampIndex}
                />
                <Size amount={amount} />
                <Delta delta={delta} />
                <ProfitLoss
                  profitLoss={returnFormat ? profitLoss : returnOnInvestment}
                  suffix={returnFormat ? undefined : " %"}
                />
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
