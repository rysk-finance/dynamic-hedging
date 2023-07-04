import type { ActivePositionsSortType } from "src/state/types";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActivePositionSort } from "src/state/constants";
import { ActionType } from "src/state/types";
import { Preferences } from "../../../enums";
import { ChevronUpDown } from "src/Icons";

const columns = [
  {
    className: "cursor-pointer col-span-2",
    columnKey: ActivePositionSort.Expiry,
    name: "series",
    sortable: true,
  },
  {
    className: "cursor-pointer",
    columnKey: ActivePositionSort.Size,
    name: "size",
    sortable: true,
  },
  {
    className: "cursor-pointer",
    columnKey: ActivePositionSort.Delta,
    name: "delta",
    sortable: true,
  },
  {
    className: "cursor-pointer",
    columnKey: ActivePositionSort.PnL,
    name: "p/l",
    sortable: true,
  },
  {
    className: "",
    name: "entry price",
  },
  {
    className: "",
    name: "mark price",
  },
  {
    className: "col-span-2",
    name: "liq. price (collateral)",
  },
  {
    className: "",
    name: "break even",
  },
  {
    className: "col-span-2",
    name: "action",
  },
];

export const Head = () => {
  const {
    dispatch,
    state: {
      userStats: {
        activePositionsFilters: { isAscending, sort },
      },
    },
  } = useGlobalContext();

  const handleSortClick = (newSort: ActivePositionsSortType) => () => {
    const activePositionsFilters = {
      isAscending: newSort === sort ? !isAscending : true,
      sort: newSort,
    };

    localStorage.setItem(
      Preferences.ACTIVE_POSITIONS_FILTERS_SORTING,
      JSON.stringify(activePositionsFilters)
    );

    dispatch({
      type: ActionType.SET_USER_STATS,
      activePositionsFilters,
    });
  };

  return (
    <thead className="border-b-2 border-black border-dashed pr-[17px]">
      <tr className="grid grid-cols-12 text-center capitalize [&_th]:border-l-2 first:[&_th]:border-0 [&_th]:border-gray-500 [&_th]:border-dashed [&_th]:py-3 [&_th]:text-xs [&_th]:lg:text-sm [&_th]:xl:text-base select-none">
        {columns.map(({ className, columnKey, name, sortable }) => (
          <th
            className={`flex items-center justify-center ${className}`}
            key={name}
            onClick={columnKey && handleSortClick(columnKey)}
            scope="col"
          >
            <span className={`${sortable ? "pl-6" : ""}`}>{name}</span>
            {sortable && (
              <ChevronUpDown
                isAscending={sort === columnKey ? isAscending : undefined}
              />
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
};
