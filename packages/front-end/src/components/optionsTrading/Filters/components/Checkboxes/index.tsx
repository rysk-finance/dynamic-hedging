import type { ColumnNames } from "src/state/types";

import { useEffect, useMemo } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { LocalStorageKeys, setLocalStorageSet } from "src/state/localStorage";
import { ActionType } from "src/state/types";
import { buildCheckboxList } from "./utils";

export const Checkboxes = () => {
  const {
    dispatch,
    state: { visibleColumns },
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
    <div className="flex items-center justify-evenly xl:justify-start h-12 px-4 border-black border-b-2 xl:border-b-0 [&>*]:mx-2 [&>*]:p-3 [&_*]:ease-in-out [&_*]:duration-100 [&_label]:whitespace-nowrap">
      {checkboxes.map(({ inputProps, label, title }) => (
        <label
          className="flex items-center select-none cursor-pointer"
          key={inputProps.name}
          title={title}
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
  );
};
