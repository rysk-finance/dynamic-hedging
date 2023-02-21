import { ChangeEvent } from "react";

import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";

enum TupleIndexEnum {
  MIN = 0,
  MAX = 1,
}

export const StrikeRange = () => {
  const {
    dispatch,
    state: { visibleStrikeRange },
  } = useOptionsTradingContext();

  const handleChange =
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const filterValue = event.currentTarget.value;

      if (index === TupleIndexEnum.MIN) {
        dispatch({
          type: OptionsTradingActionType.SET_VISIBLE_STRIKE_RANGE,
          visibleStrikeRange: [filterValue, visibleStrikeRange[1]],
        });
      }

      if (index === TupleIndexEnum.MAX) {
        dispatch({
          type: OptionsTradingActionType.SET_VISIBLE_STRIKE_RANGE,
          visibleStrikeRange: [visibleStrikeRange[0], filterValue],
        });
      }
    };

  return (
    <div className="flex items-center my-2 xl:my-0 xl:ml-auto xl:border-x-2 border-black px-4">
      <p className="pr-2 font-medium text-sm 2xl:text-base">{`Filter strike range:`}</p>
      <label htmlFor="strike-min" hidden>
        {`Minimum`}
      </label>
      <input
        className="text-center h-12 number-input-hide-arrows bg-bone-light"
        type="number"
        id="strike-min"
        name="strike-min"
        placeholder="Min"
        step={100}
        onChange={handleChange(TupleIndexEnum.MIN)}
        title="The minimum strike range to display."
        value={visibleStrikeRange[TupleIndexEnum.MIN]}
      />
      <p className="px-2">{`-`}</p>
      <label htmlFor="strike-max" hidden>
        {`Maximum`}
      </label>
      <input
        className="text-center h-12 number-input-hide-arrows bg-bone-light"
        type="number"
        id="strike-max"
        name="strike-max"
        placeholder="Max"
        step={100}
        onChange={handleChange(TupleIndexEnum.MAX)}
        title="The maximum strike range to display."
        value={visibleStrikeRange[TupleIndexEnum.MAX]}
      />
    </div>
  );
};
