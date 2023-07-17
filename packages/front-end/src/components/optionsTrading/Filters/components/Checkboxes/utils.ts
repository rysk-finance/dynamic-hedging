import type { ColumNames } from "src/state/types";
import type { CheckBoxProps } from "./types";

export const buildCheckboxList = (
  visibleColumns: Set<ColumNames>
): CheckBoxProps[] => {
  return [
    {
      inputProps: {
        name: "bid-iv-visible",
        key: "iv sell",
        checked: visibleColumns.has("iv sell"),
      },
      label: "IV (Sell)",
      title: "Switch the IV (Sell) column visibility.",
    },
    {
      inputProps: {
        name: "ask-iv-visible",
        key: "iv buy",
        checked: visibleColumns.has("iv buy"),
      },
      label: "IV (Buy)",
      title: "Switch the IV (Buy) column visibility.",
    },
    {
      inputProps: {
        name: "delta-visible",
        key: "delta",
        checked: visibleColumns.has("delta"),
      },
      label: "Delta",
      title: "Switch the delta column visibility.",
    },
    {
      inputProps: {
        name: "pos-visible",
        key: "pos",
        checked: visibleColumns.has("pos"),
      },
      label: "Position",
      title: "Switch the user position column visibility.",
    },
    {
      inputProps: {
        name: "exposure-visible",
        key: "exposure",
        checked: visibleColumns.has("exposure"),
      },
      label: "DHV Exposure",
      title: "Switch the net DHV exposure column visibility.",
    },
  ];
};
