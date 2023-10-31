import type { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";

export const Pricing = ({ collateralData }: PricingProps) => {
  const {
    state: {
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const {
    asset,
    collateral,
    disabled,
    hasRequiredCapital,
    liquidationPrice,
    now,
    remainingBalanceUSDC,
    remainingBalanceWETH,
  } = collateralData;

  const errorMessage = useMemo(() => {
    switch (true) {
      case !hasRequiredCapital:
        return "Insufficient balance to cover collateral.";

      case disabled:
        return "Cannot withdraw this much collateral.";

      default:
        return "";
    }
  }, [disabled, hasRequiredCapital]);

  return (
    <div className="w-4/5 xl:w-3/5 mx-auto py-2">
      <span className="flex">
        <p className="mr-auto">{`Liquidation Price:`}</p>
        <AnimatePresence mode="wait">
          <RyskTooltip
            content="The price at which your position will be liquidated. You can deposit or withdraw more collateral to adjust this price."
            disabled={!tutorialMode}
            placement="left"
          >
            <motion.p className="font-medium" {...FadeInOutQuick}>
              <RyskCountUp
                fallback={!liquidationPrice ? "" : "-"}
                value={liquidationPrice}
              />
              {!liquidationPrice ? `Fully Collateralised` : ` USDC`}
            </motion.p>
          </RyskTooltip>
        </AnimatePresence>
      </span>

      <span className="flex">
        <p className="mr-auto">{`Collateral:`}</p>
        <RyskTooltip
          content="The amount of collateral that is placed against this position."
          disabled={!tutorialMode}
          placement="left"
        >
          <p className="font-medium">
            <RyskCountUp
              format={asset === "USDC" ? "USD" : "ETH"}
              value={collateral}
            />
            {` ${asset}`}
          </p>
        </RyskTooltip>
      </span>

      <span className="flex pt-2">
        <p className="mr-auto">{`Balances after:`}</p>
        <p className="font-medium">
          <RyskCountUp value={remainingBalanceUSDC} />
          {` USDC`}
        </p>
      </span>

      <span className="flex">
        <span className="mr-auto" />
        <p className="font-medium">
          <RyskCountUp value={remainingBalanceWETH} format="ETH" />
          {` WETH`}
        </p>
      </span>

      <AnimatePresence mode="wait">
        {errorMessage && (
          <motion.small
            className="block leading-6 text-red-500 text-right"
            {...FadeInOutQuick}
          >
            {errorMessage}
          </motion.small>
        )}
      </AnimatePresence>

      <small className="flex flex-col pt-2 text-center leading-6 text-gray-600">
        {`Last updated: ${now}`}
      </small>
    </div>
  );
};
