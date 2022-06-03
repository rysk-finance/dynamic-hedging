import React from "react";
import ReactDatePicker, { ReactDatePickerProps } from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

export const DatePicker: React.FC<ReactDatePickerProps> = (props) => {
  return (
    <div className="custom-date-picker pt-1">
      <ReactDatePicker {...props} inline />
    </div>
  );
};
