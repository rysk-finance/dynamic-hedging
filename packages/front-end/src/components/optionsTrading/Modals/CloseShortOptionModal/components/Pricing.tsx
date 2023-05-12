import type { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { getContractAddress } from "src/utils/helpers";

export const Pricing = ({
  collateralAddress,
  remainingCollateral,
  positionData,
}: PricingProps) => {
  const [errorMessage, setErrorMessage] = useState("");

  const {
    fee,
    hasRequiredCapital,
    now,
    premium,
    quote,
    remainingBalance,
    slippage,
    title,
  } = positionData;

  const isWeth = collateralAddress === getContractAddress("WETH");

  useEffect(() => {
    if (!hasRequiredCapital && quote) {
      setErrorMessage("Insufficient balance to cover collateral.");
    } else if (remainingBalance <= 0 && quote) {
      setErrorMessage("Final balance cannot be negative.");
    } else {
      setErrorMessage("");
    }
  }, [positionData]);

  return (
    <div className="flex flex-col">
      <p
        className="text-center py-4 bg-white border-b-2 border-black font-dm-mono"
        id="buy-symbol"
      >
        {title}
      </p>

      <div className="w-3/5 mx-auto py-4">
        <div id="buy-price-per-option">
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

        <span
          className="flex py-2 border-gray-600 border-b"
          id="buy-total-price"
        >
          <p className="mr-auto">{`Premium paid:`}</p>
          <p className="font-medium">
            <RyskCountUp value={quote} />
            {` USDC`}
          </p>
        </span>

        <span className="flex pt-2" id="buy-balance">
          <p className="mr-auto">{`Balance after:`}</p>
          <p className="font-medium">
            <RyskCountUp value={remainingBalance} />
            {` USDC`}
          </p>
        </span>

        <span className="flex" id="collateral-balance">
          <p className="mr-auto">{`Collateral after:`}</p>
          <p className="font-medium">
            <RyskCountUp value={remainingCollateral} />
            {isWeth ? " WETH" : " USDC"}
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
    </div>
  );
};
