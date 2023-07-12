import type { PricingProps } from "../types";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import FadeInOutQuick from "src/animation/FadeInOutQuick";

export const Pricing = ({ collateralData }: PricingProps) => {
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
    <div className="w-3/5 mx-auto py-4">
      <span className="flex">
        <p className="mr-auto">{`Liquidation Price:`}</p>
        <p className="font-medium">
          <RyskCountUp value={liquidationPrice} />
          {` USDC`}
        </p>
      </span>

      <span className="flex">
        <p className="mr-auto">{`Collateral:`}</p>
        <p className="font-medium">
          <RyskCountUp
            format={asset === "USDC" ? "USD" : "ETH"}
            value={collateral}
          />
          {` ${asset}`}
        </p>
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
