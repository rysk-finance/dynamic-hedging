import React, { useCallback, useMemo, useRef, useState } from "react";
import { useOnClickOutside } from "../../hooks/useOnClickOutside";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import { Option } from "../../types";
import { formatShortDate } from "../../utils/formatShortDate";
import { getSuggestedExpiryDates } from "../../utils/getSuggestedExpiryDates";
import { getTimeDifferenceString } from "../../utils/getTimeDifferenceString";
import { Button } from "../shared/Button";
import { DatePicker } from "../shared/DatePicker";
import { RadioButtonList } from "../shared/RadioButtonList";

export const ExpiryDatePicker: React.FC = () => {
  const {
    state: { expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  const [datePickerIsOpen, setDatePickerIsOpen] = useState(false);
  const [isCustomExpiryDate, setIsCustomExpiryDate] = useState(false);

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
      console.log(
        (event.target as HTMLElement).className.includes("react-datepicker")
      );
      return !clickIsInsideDatePicker;
    }
  );

  const handleCustomExpiryClick = () => {
    setDatePickerIsOpen(true);
    setIsCustomExpiryDate(true);
    setExpiryDate(null);
  };

  const setExpiryDate = useCallback(
    (date: Date | null) => {
      dispatch({ type: OptionsTradingActionType.SET_EXPIRY_DATE, date });
    },
    [dispatch]
  );

  const handleRadioExpiryClick = useCallback(
    (date: Date) => {
      setIsCustomExpiryDate(false);
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

  const expiryTime = expiryDate && expiryDate.getTime() - new Date().getTime();

  return (
    <div className="w-full">
      <div className="mb-2 px-4 py-2">
        <div className="flex items-center">
          <h4 className="font-parabole mr-2 pb-1">Expiration date: </h4>
          {expiryDate && (
            <p>
              {expiryDate.toLocaleDateString("en-US")}
              {" 8:00am UTC"}
            </p>
          )}
        </div>
        <p className="text-gray-600 text-xs">
          <p>
            Time to expiry: {expiryTime && getTimeDifferenceString(expiryTime)}
          </p>
        </p>
      </div>
      <div className="w-full border-y-2 border-black flex relative">
        <div className="w-[70%]">
          <RadioButtonList
            options={expiryDateOptions}
            selected={expiryDate}
            setSelected={handleRadioExpiryClick}
            removeOuterBorder
          />
        </div>
        <Button
          onClick={handleCustomExpiryClick}
          className={`border-y-0 border-r-0 w-[30%] ${
            isCustomExpiryDate ? "" : "!bg-gray-500"
          }`}
        >
          Custom
        </Button>
        {datePickerIsOpen && (
          <div
            className="absolute flex justify-center items-center border-2 border-black z-10 bg-bone top-[110%] right-[1px] w-fit"
            ref={datePickerRef}
          >
            <DatePicker
              onChange={(date) => {
                setDatePickerIsOpen(false);
                setExpiryDate(date);
              }}
              selected={expiryDate}
            />
          </div>
        )}
      </div>
    </div>
  );
};
