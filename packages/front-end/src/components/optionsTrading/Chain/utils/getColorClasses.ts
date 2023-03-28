import type { SelectedOption, StrikeOptions } from "src/state/types";

export const getColorClasses = (
  option: StrikeOptions,
  side: SelectedOption["callOrPut"],
  ethPrice: number | null,
  selectedOption?: SelectedOption
): string => {
  const strikeSelected = option.strike === selectedOption?.strikeOptions.strike;
  const callRowSelected =
    selectedOption?.callOrPut === "call" && strikeSelected;
  const putRowSelected = selectedOption?.callOrPut === "put" && strikeSelected;
  const callITM = ethPrice && option.strike <= ethPrice;
  const putITM = ethPrice && option.strike >= ethPrice;

  switch (true) {
    case (callRowSelected && callITM && side === "call") ||
      (putRowSelected && putITM && side === "put"):
      return "bg-green-100";

    case (callITM && side === "call") || (putITM && side === "put"):
      return "bg-green-100/25 hover:bg-green-100";

    case (callRowSelected && side === "call") ||
      (putRowSelected && side === "put"):
      return "bg-bone-dark/60";

    default:
      return "hover:bg-bone-dark/50";
  }
};
