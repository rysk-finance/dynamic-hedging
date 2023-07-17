import type { ColumNames } from "src/state/types";

export interface CheckBoxProps {
  inputProps: {
    name: string;
    key: ColumNames;
    checked: boolean;
  };
  label: string;
  title: string;
}
