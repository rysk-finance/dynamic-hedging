import type { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { useGlobalContext } from "src/state/GlobalContext";
import { getContractAddress } from "src/utils/helpers";

export const Pricing = ({
  collateralAddress,
  remainingCollateral,
  positionData,
}: PricingProps) => {
  const {
    state: {
      options: {
        liquidityPool: { utilisationLow },
      },
    },
  } = useGlobalContext();

  const {
    collateralReleased,
    fee,
    hasRequiredCapital,
    now,
    premium,
    quote,
    remainingBalanceUSDC,
    remainingBalanceWETH,
    slippage,
    title,
  } = positionData;

  const isWeth = collateralAddress === getContractAddress("WETH");

  const errorMessage = useMemo(() => {
    switch (true) {
      case !hasRequiredCapital && Boolean(quote):
        return "Insufficient balance to cover collateral.";

      case remainingBalanceUSDC <= 0 && Boolean(quote):
        return "Final balance cannot be negative.";

      case utilisationLow:
        return "DHV utilisation is high. Some TXs may fail.";

      default:
        return "";
    }
  }, [positionData]);

  return (
    <div className="flex flex-col">
      <p className="text-center py-4 bg-white border-b-2 border-black font-dm-mono">
        {title}
      </p>

      <div className="w-3/5 mx-auto py-4">
        <div>
          <span className="flex">
            <p className="mr-auto">{`Premium:`}</p>
            <p className="font-medium">
              <RyskCountUp value={premium} />
              {` USDC`}
            </p>
          </span>

          <span className="flex">
            <p className="mr-auto">{`Fee:`}</p>
            <p className="font-medium">
              <RyskCountUp value={fee} />
              {` USDC`}
            </p>
          </span>

          <span className="flex">
            <p className="mr-auto">{`Price impact:`}</p>
            <p className="font-medium">
              <RyskCountUp value={slippage} />
              {` %`}
            </p>
          </span>

          <small className="block leading-6 text-gray-600 border-gray-600 border-b">
            {`Premium and fees are per option.`}
          </small>
        </div>

        <span className="flex pt-2">
          <p className="mr-auto">{`Premium paid:`}</p>
          <p className="font-medium">
            <RyskCountUp value={quote} />
            {` USDC`}
          </p>
        </span>

        <span className="flex">
          <p className="mr-auto">{`Collateral released:`}</p>
          <p className="font-medium">
            <RyskCountUp value={collateralReleased} />
            {` USDC`}
          </p>
        </span>

        <span className="flex pb-2 border-gray-600 border-b">
          <p className="mr-auto">{`Collateral remaining:`}</p>
          <p className="font-medium">
            <RyskCountUp value={remainingCollateral} />
            {isWeth ? " WETH" : " USDC"}
          </p>
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
    </div>
  );
};
