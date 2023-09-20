import type { ActivePositionsSortType } from "src/state/types";

import { ChevronUpDown } from "src/Icons";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { DHV_ARTICLE } from "src/config/links";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActivePositionSort } from "src/state/constants";
import {
  LocalStorageKeys,
  setLocalStorageObject,
} from "src/state/localStorage";
import { ActionType } from "src/state/types";

const columns = (returnFormat: boolean) => [
  {
    className: "cursor-pointer col-span-2",
    columnKey: ActivePositionSort.Expiry,
    name: "series",
    sortable: true,
    tutorial:
      "Green positions with an up arrow represent longs and red positions with a down arrows represent shorts. You can click to sort by this column.",
  },
  {
    className: "cursor-pointer",
    columnKey: ActivePositionSort.Size,
    name: "size",
    sortable: true,
    tutorial:
      "The size of the active position that you currently hold. You can click to sort by this column.",
  },
  {
    className: "cursor-pointer",
    columnKey: ActivePositionSort.Delta,
    name: "delta",
    sortable: true,
    tutorial: (
      <div>
        {`The total delta for the position based on size. `}
        <a
          className="text-cyan-dark-compliant underline"
          href={DHV_ARTICLE}
          rel="noopener noreferrer"
          target="_blank"
        >
          {`Learn more about delta.`}
        </a>
        {` You can click to sort by this column.`}
      </div>
    ),
  },
  {
    className: "cursor-pointer",
    columnKey: ActivePositionSort.PnL,
    name: returnFormat ? "p/l" : "roi",
    sortable: true,
    tutorial:
      "The profit or loss of the position. You can click to sort by this column.",
  },
  {
    className: "",
    name: "entry",
    tutorial:
      "The entry price that you paid for this position. This is aggregated across all entries.",
  },
  {
    className: "",
    name: "mark",
    tutorial:
      "The current mark price of the position based on a single contract. This is a mid-point between the current buy and sell prices, otherwise known as the fair value.",
  },
  {
    className: "col-span-2",
    name: "liq. price (coll)",
    tutorial:
      "For shorts, the first value represents the price at which your position will be liquidated. The value in brackets shows how much collateral you have provided for the position. To modify your collateral, you can click on these values.",
  },
  {
    className: "",
    name: "B/E",
    tutorial: "The current break even price for your position.",
  },
  {
    className: "col-span-2",
    name: "action",
    tutorial:
      "The actions shown against each position display its current state. Where a positions is closeable, redeemable or settleable, you can click on the action to complete the transaction.",
  },
];

export const Head = () => {
  const {
    dispatch,
    state: {
      userStats: {
        activePositionsFilters: { isAscending, sort, returnFormat },
      },
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const handleSortClick = (newSort: ActivePositionsSortType) => () => {
    const activePositionsFilters = {
      isAscending: newSort === sort ? !isAscending : true,
      sort: newSort,
    };

    setLocalStorageObject(
      LocalStorageKeys.ACTIVE_POSITIONS_FILTERS_SORTING,
      activePositionsFilters
    );

    dispatch({
      type: ActionType.SET_USER_STATS,
      activePositionsFilters,
    });
  };

  return (
    <thead className="w-[150%] lg:w-full border-b-2 border-black border-dashed pr-3">
      <tr className="grid grid-cols-12 text-center [&_th]:border-l-2 first:[&_th]:border-0 [&_th]:border-gray-500 [&_th]:border-dashed [&_th]:py-3 [&_th]:text-xs [&_th]:lg:text-sm [&_th]:xl:text-base">
        {columns(returnFormat).map(
          ({ className, columnKey, name, sortable, tutorial }) => (
            <RyskTooltip
              content={tutorial}
              disabled={!tutorialMode}
              key={name}
              placement="top"
            >
              <th
                className={`flex items-center justify-center capitalize select-none ${className}`}
                onClick={columnKey && handleSortClick(columnKey)}
                scope="col"
              >
                {/* ActivePositionSort.PnL */}
                <span>
                  {columnKey === ActivePositionSort.PnL && !returnFormat
                    ? "ROI"
                    : name}
                </span>
                {sortable && (
                  <ChevronUpDown
                    isAscending={sort === columnKey ? isAscending : undefined}
                  />
                )}
              </th>
            </RyskTooltip>
          )
        )}
      </tr>
    </thead>
  );
};
