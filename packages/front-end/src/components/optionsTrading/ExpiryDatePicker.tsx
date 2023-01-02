import { useCallback, useMemo, useRef, useState } from "react";

import { useOnClickOutside } from "../../hooks/useOnClickOutside";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import { Option } from "../../types";
import { formatShortDate } from "../../utils/formatShortDate";
import { getSuggestedExpiryDates } from "../../utils/getSuggestedExpiryDates";
import { RadioButtonList } from "../shared/RadioButtonList";

export const ExpiryDatePicker = () => {
  const {
    state: { expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  const [datePickerIsOpen, setDatePickerIsOpen] = useState(false);

  const datePickerRef = useRef<HTMLDivElement | null>(null);

  const onClickOffDatePicker = useCallback(() => {
    setDatePickerIsOpen(false);
  }, []);

  useOnClickOutside(
    datePickerRef,
    datePickerIsOpen,
    onClickOffDatePicker,
    (_, event) => {
      // Need to do this custom DOM check because react datepicker dynamically
      // adds and removes the month scroll buttons from the DOM, which interferes
      // with some logic on the useOnClickOutside hook.
      const clickIsInsideDatePicker = (
        event.target as HTMLElement
      ).className.includes("react-datepicker");
      return !clickIsInsideDatePicker;
    }
  );

  const setExpiryDate = useCallback(
    (date: Date | null) => {
      dispatch({ type: OptionsTradingActionType.SET_EXPIRY_DATE, date });
    },
    [dispatch]
  );

  const handleRadioExpiryClick = useCallback(
    (date: Date) => {
      setExpiryDate(date);
    },
    [setExpiryDate]
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

  return (
    <div className="w-full">
      <div className="w-full border-y-2 border-black flex justify-center relative">
        <div className="w-full">
          <RadioButtonList
            options={expiryDateOptions}
            selected={expiryDate}
            setSelected={handleRadioExpiryClick}
            removeOuterBorder
          />
        </div>
      </div>
    </div>
  );
};
