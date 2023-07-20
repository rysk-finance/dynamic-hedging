import type { ColumnNamesSet } from "src/state/types";
import type { CheckBoxProps } from "./types";

export const buildCheckboxList = (
  visibleColumns: ColumnNamesSet
): CheckBoxProps[] => {
  return [
    {
      inputProps: {
        name: "bid-iv-visible",
        key: "iv sell",
        checked: visibleColumns.has("iv sell"),
      },
      label: "IV (Sell)",
    },
    {
      inputProps: {
        name: "ask-iv-visible",
        key: "iv buy",
        checked: visibleColumns.has("iv buy"),
      },
      label: "IV (Buy)",
    },
    {
      inputProps: {
        name: "delta-visible",
        key: "delta",
        checked: visibleColumns.has("delta"),
      },
      label: "Delta",
    },
    {
      inputProps: {
        name: "pos-visible",
        key: "pos",
        checked: visibleColumns.has("pos"),
      },
      label: "Position",

    },
    {
      inputProps: {
        name: "exposure-visible",
        key: "exposure",
        checked: visibleColumns.has("exposure"),
      },
      label: "DHV Exposure",

    },
  ];
};
