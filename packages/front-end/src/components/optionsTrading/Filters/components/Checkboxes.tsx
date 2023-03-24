import type { ColumNames } from "src/state/types";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const Checkboxes = () => {
  const {
    dispatch,
    state: { visibleColumns },
  } = useGlobalContext();

  const handleChange = (column: ColumNames) => () => {
    dispatch({
      type: ActionType.SET_VISIBLE_COLUMNS,
      column,
    });
  };

  const checkboxes = [
    {
      inputProps: {
        name: "bid-iv-visible",
        onChange: handleChange("iv sell"),
        checked: visibleColumns.has("iv sell"),
      },
      label: "IV (Sell)",
      title: "Switch the IV (Sell) column visibility.",
    },
    {
      inputProps: {
        name: "ask-iv-visible",
        onChange: handleChange("iv buy"),
        checked: visibleColumns.has("iv buy"),
      },
      label: "IV (Buy)",
      title: "Switch the IV (Buy) column visibility.",
    },
    {
      inputProps: {
        name: "delta-visible",
        onChange: handleChange("delta"),
        checked: visibleColumns.has("delta"),
      },
      label: "Delta",
      title: "Switch the delta column visibility.",
    },
    {
      inputProps: {
        name: "pos-visible",
        onChange: handleChange("pos"),
        checked: visibleColumns.has("pos"),
      },
      label: "Pos",
      title: "Switch the user position column visibility.",
    },
    {
      inputProps: {
        name: "exposure-visible",
        onChange: handleChange("exposure"),
        checked: visibleColumns.has("exposure"),
      },
      label: "DHV Exposure",
      title: "Switch the net DHV exposure column visibility.",
    },
  ];

  return (
    <div
      className="flex items-center justify-evenly xl:justify-start h-12 px-4 [&>*]:mx-2 [&>*]:p-3 [&_*]:ease-in-out [&_*]:duration-100 [&_label]:whitespace-nowrap"
      id="filter-checkboxes"
    >
      {checkboxes.map((checkbox) => (
        <label
          className="flex items-center select-none cursor-pointer"
          key={checkbox.inputProps.name}
          title={checkbox.title}
        >
          <input
            className="w-4 h-4 cursor-pointer mr-2 accent-bone-dark hover:accent-bone-light"
            type="checkbox"
            {...checkbox.inputProps}
          />
          {checkbox.label}
        </label>
      ))}
    </div>
  );
};
