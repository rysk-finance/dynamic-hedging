import type { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";
import { MAX_TRADE_SIZE, MIN_TRADE_SIZE } from "../../Shared/utils/constants";

export const Pricing = ({ loading, positionData, size }: PricingProps) => {
  const {
    state: {
      collateralPreferences: { amount, full, type },
      options: {
        liquidityPool: { utilisationHigh },
      },
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const [collateralType, setCollateralType] = useState(type);
  const [collateralFull, setCollateralFull] = useState(full);

  const {
    breakEven,
    collateral,
    fee,
    hasRequiredCapital,
    liquidationPrice,
    now,
    premium,
    remainingBalanceUSDC,
    remainingBalanceWETH,
    slippage,
  } = positionData;

  useEffect(() => {
    if (!loading) {
      setCollateralType(type);
      setCollateralFull(full);
    }
  }, [loading, type, full]);

  const errorMessage = useMemo(() => {
    const negativeBalance =
      (collateralType === "USDC" && remainingBalanceUSDC <= 0) ||
      (collateralType === "WETH" && remainingBalanceWETH <= 0);

    switch (true) {
      case size && Number(size) < MIN_TRADE_SIZE:
      case size && Number(size) > MAX_TRADE_SIZE:
        return "Trade size must be between 0.1 and 1000.";

      case !full && amount < 1.1:
        return "Collateral multiplier must be at least 1.1x.";

      case negativeBalance && Boolean(premium):
        return "Final balance cannot be negative.";

      case !hasRequiredCapital && Boolean(premium):
        return "Insufficient balance to cover collateral.";

      case utilisationHigh:
        return "DHV utilisation is high. Some TXs may fail.";

      default:
        return "";
    }
  }, [collateralType, positionData]);

  return (
    <div className="w-4/5 xl:w-3/5 mx-auto py-2">
      <span className="flex">
        <p className="mr-auto">{`Premium received:`}</p>
        <RyskTooltip
          content="The amount of USDC required per contract."
          disabled={!tutorialMode}
          placement="left"
        >
          <p className="font-medium">
            <RyskCountUp value={premium} />
            {` USDC`}
          </p>
        </RyskTooltip>
      </span>

      <span className="flex">
        <p className="mr-auto">{`Price impact:`}</p>
        <RyskTooltip
          content="The slippage of total premium based on trade size."
          disabled={!tutorialMode}
          placement="left"
        >
          <p className="font-medium">
            <RyskCountUp value={slippage} />
            {` %`}
          </p>
        </RyskTooltip>
      </span>

      <span className="flex">
        <p className="mr-auto">{`Fee:`}</p>
        <RyskTooltip
          content="The total fee that Rysk collects per contract."
          disabled={!tutorialMode}
          placement="left"
        >
          <p className="font-medium">
            <RyskCountUp value={fee} />
            {` USDC`}
          </p>
        </RyskTooltip>
      </span>

      <span className="flex pb-2 border-gray-600 border-b">
        <p className="mr-auto">{`Break even:`}</p>
        <RyskTooltip
          content="The price at which your position will break even if held to expiry."
          disabled={!tutorialMode}
          placement="left"
        >
          <p className="font-medium">
            <RyskCountUp value={breakEven} />
            {` USDC`}
          </p>
        </RyskTooltip>
      </span>

      <span className="flex pt-2">
        <p className="mr-auto">{`Collateral required:`}</p>

        <AnimatePresence mode="wait">
          <RyskTooltip
            content="The total amount of collateral required to cover the position."
            disabled={!tutorialMode}
            placement="left"
          >
            <motion.p
              className="font-medium"
              key={collateralType}
              {...FadeInOutQuick}
            >
              <RyskCountUp
                value={collateral}
                format={collateralType === "USDC" ? "USD" : "ETH"}
              />
              {collateralType === "USDC" ? ` USDC` : ` WETH`}
            </motion.p>
          </RyskTooltip>
        </AnimatePresence>
      </span>

      <span className="flex pb-2 border-gray-600 border-b">
        <p className="mr-auto">{`Liquidation Price:`}</p>
        <AnimatePresence mode="wait">
          <RyskTooltip
            content="The price at which your position will be liquidated."
            disabled={!tutorialMode}
            placement="left"
          >
            <motion.p
              className="font-medium"
              key={collateralFull ? "full-enabled" : "full-disabled"}
              {...FadeInOutQuick}
            >
              <RyskCountUp
                fallback={collateralFull && premium ? "" : "-"}
                value={collateralFull && premium ? 0 : liquidationPrice}
              />
              {collateralFull && premium ? `Fully Collateralised` : ` USDC`}
            </motion.p>
          </RyskTooltip>
        </AnimatePresence>
      </span>

      <div>
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
      </div>

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
