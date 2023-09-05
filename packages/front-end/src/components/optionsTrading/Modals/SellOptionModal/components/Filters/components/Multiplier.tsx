import type { ChangeEvent } from "react";

import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";

import { Close, Minus, Plus } from "src/Icons";
import { roundInputValue } from "src/components/optionsTrading/Modals/Shared/utils/roundNumberValue";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { COLLATERAL_DOCS } from "src/config/links";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { Convert } from "src/utils/Convert";

export const Multiplier = () => {
  const {
    dispatch,
    state: {
      collateralPreferences,
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const [multiplier, setMultiplier] = useState(collateralPreferences.amount);
  const [debouncedMultiplier] = useDebounce(multiplier, 300);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rounded = Convert.fromStr(roundInputValue(event)).toInt();

    if (rounded > 100) {
      setMultiplier(Math.floor(rounded / 10));
    } else {
      setMultiplier(rounded);
    }
  };

  const handleInputBlur = () => {
    if (multiplier < 1.1) setMultiplier(1.1);
    if (Number.isNaN(multiplier)) setMultiplier(2);
  };

  useEffect(() => {
    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: {
        ...collateralPreferences,
        amount: debouncedMultiplier,
      },
    });
  }, [debouncedMultiplier]);

  const handleMultiplierChange = (operation: "add" | "sub") => () => {
    if (operation === "add") {
      const amount = Math.floor(multiplier * 10 * 1.1) / 10;
      setMultiplier(amount);
    }

    if (operation === "sub") {
      const amount = Math.ceil((multiplier * 10) / 1.1) / 10;
      setMultiplier(amount);
    }
  };

  const iconLeft = useMemo(() => {
    const base = 2.6;
    const gap = 0.3;
    const len = multiplier.toString().length;

    return `${base + (len - 1) * gap}rem`;
  }, [multiplier]);

  return (
    <RyskTooltip
      content={
        <div>
          {`Set how much collateral to deposit by using the +/- buttons or this input. The value represents a multiplier of the minimum required collateral. The number must be between 1.1 and 99.99x. `}
          <a
            className="text-cyan-dark-compliant underline"
            href={COLLATERAL_DOCS}
            rel="noopener noreferrer"
            target="_blank"
          >
            {`Learn more about Rysk collateralisation.`}
          </a>
        </div>
      }
      disabled={!tutorialMode}
      placement="right"
    >
      <div className="flex h-11 bg-white border border-gray-600 w-fit rounded-full">
        <button
          className="w-11 border-r border-gray-600/40 rounded-l-full disabled:cursor-not-allowed disabled:bg-gray-600/10"
          disabled={multiplier <= 1.1 || collateralPreferences.full}
          onClick={handleMultiplierChange("sub")}
        >
          <Minus className="w-4 h-4 mx-auto" />
        </button>
        <span className="relative flex h-full">
          <input
            className="text-center w-20 h-full pr-2 number-input-hide-arrows disabled:cursor-not-allowed font-dm-mono"
            disabled={collateralPreferences.full}
            inputMode="numeric"
            onBlur={handleInputBlur}
            onChange={handleInputChange}
            step={0.1}
            type="number"
            value={multiplier}
          />
          <Close
            className={`absolute top-[0.9rem] h-4 w-4 pointer-events-none`}
            style={{ left: iconLeft }}
          />
        </span>
        <button
          className="w-11 border-l border-gray-600/40 rounded-r-full disabled:cursor-not-allowed disabled:bg-gray-600/10 "
          disabled={multiplier >= 99.99 || collateralPreferences.full}
          onClick={handleMultiplierChange("add")}
        >
          <Plus className="w-4 h-4 mx-auto" />
        </button>
      </div>
    </RyskTooltip>
  );
};
