import type { ReactDatePickerProps } from "react-datepicker";

import ReactDatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

export const DatePicker = (props: ReactDatePickerProps) => {
  return (
    <div className="custom-date-picker pt-1">
      <ReactDatePicker {...props} inline />
    </div>
  );
};
