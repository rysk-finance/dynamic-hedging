import React, { useCallback, useMemo } from "react";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import { Option } from "../../types";
import { formatShortDate } from "../../utils/formatShortDate";
import { getSuggestedExpiryDates } from "../../utils/getSuggestedExpiryDates";
import { getTimeDifferenceString } from "../../utils/getTimeDifferenceString";
import { RadioButtonList } from "../shared/RadioButtonList";

export const ExpiryDatePicker: React.FC = () => {
  const {
    state: { expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  const setExpiryDate = useCallback(
    (date: Date) => {
      dispatch({ type: OptionsTradingActionType.SET_EXPIRY_DATE, date });
    },
    [dispatch]
  );

  const expiryDateOptions = useMemo(() => {
    const dates = getSuggestedExpiryDates();
    setExpiryDate(dates[0]);
    return dates.map<Option<Date>>((date) => ({
      value: date,
      label: formatShortDate(date),
      key: date.toISOString(),
    }));
  }, [setExpiryDate]);

  const expiryTime = expiryDate && expiryDate.getTime() - new Date().getTime();

  return (
    <div className="w-full">
      <div className="mb-2 px-4 py-2">
        <div className="flex items-center">
          <h4 className="font-parabole mr-2 pb-1">Expiration date: </h4>
          <p>
            {expiryDate && expiryDate?.toLocaleDateString("en-US")}
            {" 8:00am UTC"}
          </p>
        </div>
        <p className="text-gray-600 text-xs">
          {expiryTime && (
            <p>Time to expiry: {getTimeDifferenceString(expiryTime)}</p>
          )}
        </p>
      </div>
      <div className="w-full border-y-2 border-black">
        <RadioButtonList
          options={expiryDateOptions}
          selected={expiryDate}
          setSelected={setExpiryDate}
          removeOuterBorder
        />
      </div>
    </div>
  );
};
