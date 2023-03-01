import type { ColumNames } from "src/state/types";

import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";

export const Checkboxes = () => {
  const {
    dispatch,
    state: { visibleColumns },
  } = useOptionsTradingContext();

  const handleChange = (column: ColumNames) => () => {
    dispatch({
      type: OptionsTradingActionType.SET_VISIBLE_COLUMNS,
      column,
    });
  };

  return (
    <div className="flex items-center justify-evenly xl:justify-start h-12 px-4 [&>*]:mx-4 [&>*]:p-3 [&_*]:ease-in-out [&_*]:duration-100 [&_label]:whitespace-nowrap">
      <label
        className="flex items-center select-none cursor-pointer"
        title="Hide the bid IV column."
      >
        <input
          className="w-4 h-4 cursor-pointer mr-2 accent-bone-dark hover:accent-bone-light"
          type="checkbox"
          name="bid-iv-visible"
          onChange={handleChange("bid iv")}
          checked={visibleColumns.has("bid iv")}
        />
        {`Bid IV`}
      </label>

      <label
        className="flex items-center select-none cursor-pointer"
        title="Hide the ask IV column."
      >
        <input
          className="w-4 h-4 cursor-pointer mr-2 accent-bone-dark hover:accent-bone-light"
          type="checkbox"
          name="ask-iv-visible"
          onChange={handleChange("ask iv")}
          checked={visibleColumns.has("ask iv")}
        />
        {`Ask IV`}
      </label>

      <label
        className="flex items-center select-none cursor-pointer"
        title="Hide the Delta column."
      >
        <input
          className="w-4 h-4 cursor-pointer mr-2 accent-bone-dark hover:accent-bone-light"
          type="checkbox"
          name="delta-visible"
          onChange={handleChange("delta")}
          checked={visibleColumns.has("delta")}
        />
        {`Delta`}
      </label>

      <label
        className="flex items-center select-none cursor-pointer"
        title="Hide the position column."
      >
        <input
          className="w-4 h-4 cursor-pointer mr-2 accent-bone-dark hover:accent-bone-light"
          type="checkbox"
          name="position-visible"
          onChange={handleChange("pos")}
          checked={visibleColumns.has("pos")}
        />
        {`Pos`}
      </label>
    </div>
  );
};
