import { useCallback, useEffect, useRef, useState } from "react";

import { useOnClickOutside } from "../../hooks/useOnClickOutside";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import { Option } from "../../types";
import { formatShortDate } from "../../utils/formatShortDate";
import { RadioButtonList } from "../shared/RadioButtonList";
import { useContract } from "../../hooks/useContract";
import OCABI from "../../abis/OptionCatalogue.json";

export const ExpiryDatePicker = () => {
  const {
    state: { expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  const [datePickerIsOpen, setDatePickerIsOpen] = useState(false);
  const [expiryDateOptions, setExpiryDateOptions] = useState<Option<Date>[]>(
    []
  );

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

  const [optionCatalogue] = useContract({
    contract: "optionCatalogue",
    ABI: OCABI,
  });

  useEffect(() => {
    const fetchExpirations = async () => {
      const expirations = await optionCatalogue?.getExpirations();

      if (expirations) {
        setExpiryDateOptions(
          expirations.map((date: number) => ({
            value: new Date(date * 1000),
            label: formatShortDate(new Date(date * 1000)),
            key: new Date(date * 1000).toISOString(),
          }))
        );
        setExpiryDate(new Date(expirations[0] * 1000));
      }
    };

    fetchExpirations();
  }, [optionCatalogue, setExpiryDate]);

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
