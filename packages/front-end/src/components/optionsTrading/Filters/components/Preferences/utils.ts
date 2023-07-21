import type { UserTradingPreferences } from "src/state/types";
import type { ListItemProps } from "./types";

export const buildPreferencesList = (
  userTradingPreferences: UserTradingPreferences
): ListItemProps[] => {
  const {
    approvals,
    calendarMode,
    dhvBalance,
    tutorialMode,
    untradeableStrikes,
  } = userTradingPreferences;

  return [
    {
      explainer: "Enable unlimited approval for USDC and WETH.",
      isActive: approvals,
      label: "Unlimited approvals",
      preferencesKey: "approvals",
    },
    {
      explainer: "Show price information for all available expiries at once.",
      isActive: calendarMode,
      label: "Calendar mode",
      preferencesKey: "calendarMode",
    },
    {
      explainer:
        "Always display the DHV balance instead of a utilisation warning.",
      isActive: dhvBalance,
      label: "Always show DHV balance",
      preferencesKey: "dhvBalance",
    },
    {
      explainer:
        "Enable tutorial mode to provide tooltips to key areas of the trading interface.",
      isActive: tutorialMode,
      label: "Enable tutorial mode",
      preferencesKey: "tutorialMode",
    },
    {
      explainer:
        "Automatically filter out untradeable strikes from the options chain.",
      isActive: untradeableStrikes,
      label: "Hide untradeable strikes",
      preferencesKey: "untradeableStrikes",
    },
  ];
};
