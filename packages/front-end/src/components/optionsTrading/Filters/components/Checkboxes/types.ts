import type { ColumnNames } from "src/state/types";

export interface CheckBoxProps {
  inputProps: {
    name: string;
    key: ColumnNames;
    checked: boolean;
  };
  label: string;
}
