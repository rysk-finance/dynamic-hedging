import type { BigNumberish } from "ethers";
import type { ChangeEvent } from "react";

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { fromOpynNoDecimal } from "src/utils/conversion-helper";

enum TupleIndexEnum {
  MIN = 0,
  MAX = 1,
}

export const StrikeRange = () => {
  const [searchParams] = useSearchParams();

  const {
    dispatch,
    state: { visibleStrikeRange },
  } = useGlobalContext();

  useEffect(() => {
    const strikePrice = searchParams.has("strike")
      ? fromOpynNoDecimal(searchParams.get("strike") as BigNumberish)
      : undefined;

    if (strikePrice) {
      dispatch({
        type: ActionType.SET_VISIBLE_STRIKE_RANGE,
        visibleStrikeRange: [strikePrice, strikePrice],
      });
    }
  }, []);

  const handleChange =
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const filterValue = event.currentTarget.value;

      if (index === TupleIndexEnum.MIN) {
        dispatch({
          type: ActionType.SET_VISIBLE_STRIKE_RANGE,
          visibleStrikeRange: [filterValue, visibleStrikeRange[1]],
        });
      }

      if (index === TupleIndexEnum.MAX) {
        dispatch({
          type: ActionType.SET_VISIBLE_STRIKE_RANGE,
          visibleStrikeRange: [visibleStrikeRange[0], filterValue],
        });
      }
    };

  return (
    <div
      className="flex items-center my-2 xl:my-0 xl:ml-auto xl:border-x-2 border-black px-4"
      id="filter-strike-range"
    >
      <p className="pr-2 font-medium text-sm 2xl:text-base">{`Filter strike range:`}</p>
      <label htmlFor="strike-min" hidden>
        {`Minimum`}
      </label>
      <input
        className="text-center w-28 h-12 number-input-hide-arrows bg-bone-light"
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
        className="text-center w-28 h-12 number-input-hide-arrows bg-bone-light"
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
