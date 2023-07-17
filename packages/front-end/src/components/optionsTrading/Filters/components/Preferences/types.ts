import type { UserTradingPreferences } from "src/state/types";

export interface ListItemProps {
  explainer: string;
  isActive?: boolean;
  label: string;
  preferencesKey: keyof UserTradingPreferences;
}
