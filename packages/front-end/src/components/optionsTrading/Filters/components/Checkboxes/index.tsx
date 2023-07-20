import type { ColumnNames } from "src/state/types";

import { useEffect, useMemo } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { LocalStorageKeys, setLocalStorageSet } from "src/state/localStorage";
import { ActionType } from "src/state/types";
import { buildCheckboxList } from "./utils";
import { RyskTooltip } from "src/components/shared/RyskToolTip";

export const Checkboxes = () => {
  const {
    dispatch,
    state: {
      userTradingPreferences: { tutorialMode },
      visibleColumns,
    },
  } = useGlobalContext();

  const handleChange = (column: ColumnNames) => () => {
    dispatch({
      type: ActionType.SET_VISIBLE_COLUMNS,
      column,
    });
  };

  const checkboxes = useMemo(
    () => buildCheckboxList(visibleColumns),
    [visibleColumns]
  );

  useEffect(() => {
    setLocalStorageSet(LocalStorageKeys.OPTION_CHAIN_FILTERS, visibleColumns);
  }, [visibleColumns]);

  return (
    <RyskTooltip
      content="These checkboxes can be used to show/hide the columns in the chain below."
      disabled={!tutorialMode}
    >
      <div className="flex items-center justify-evenly xl:justify-start h-12 px-4 border-black border-b-2 xl:border-b-0 [&>*]:mx-2 [&>*]:p-3 [&_*]:ease-in-out [&_*]:duration-100 [&_label]:whitespace-nowrap">
        {checkboxes.map(({ inputProps, label }) => (
          <label
            className="flex items-center select-none cursor-pointer"
            key={inputProps.name}
          >
            <input
              className="w-4 h-4 cursor-pointer mr-2 accent-bone-dark hover:accent-bone-light"
              type="checkbox"
              onChange={handleChange(inputProps.key)}
              {...inputProps}
            />
            {label}
          </label>
        ))}
      </div>
    </RyskTooltip>
  );
};
