import { useMemo } from "react";

import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";

const riskLevels = [
  { colorClasses: "bg-red-600 text-white", titleKey: "high", label: "Rysky" },
  {
    colorClasses: "bg-yellow-600 text-black",
    titleKey: "moderate",
    label: "Moderate",
  },
  { colorClasses: "bg-green-500 text-black", titleKey: "low", label: "Low" },
  { colorClasses: "bg-black text-white", titleKey: "no", label: "None" },
];

export const RiskFactor = () => {
  const {
    state: {
      collateralPreferences,
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const riskLeft = useMemo(() => {
    switch (true) {
      case collateralPreferences.full:
        return "left-[-18rem]";

      case collateralPreferences.amount <= 1.3:
        return "left-0";

      case collateralPreferences.amount <= 2:
        return "left-[-6rem]";

      default:
        return "left-[-12rem]";
    }
  }, [collateralPreferences.amount, collateralPreferences.full]);

  return (
    <RyskTooltip
      content="Quickly visualise the risk factor of your position. To decrease risk, try increasing the multiplier."
      disabled={!tutorialMode}
      placement="top"
    >
      <div className="relative flex w-24 h-11 overflow-hidden rounded-full">
        <div
          className={`flex h-full ease-in-out duration-200 absolute bottom-0 ${riskLeft}`}
        >
          {riskLevels.map(({ colorClasses, label, titleKey }) => (
            <span
              className={`flex flex-col items-center justify-evenly ${colorClasses}`}
              key={label}
            >
              <small className="text-center text-xs">{`Risk factor`}</small>
              <em
                className="w-24 leading-4 text-center text-sm"
                title={`This amount of collateral carries ${titleKey} risk.`}
              >
                {label}
              </em>
            </span>
          ))}
        </div>
      </div>
    </RyskTooltip>
  );
};
