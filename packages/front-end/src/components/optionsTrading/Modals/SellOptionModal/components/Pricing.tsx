import type { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const Pricing = ({ loading, positionData, type }: PricingProps) => {
  const [collateralType, setCollateralType] = useState(type);

  useEffect(() => {
    if (!loading) {
      setCollateralType(type);
    }
  }, [loading]);

  return (
    <div className="w-3/5 mx-auto py-4">
      <span className="flex">
        <p className="mr-auto">{`Premium:`}</p>
        <p className="font-medium">
          <RyskCountUp value={positionData.premium} />
          {` USDC`}
        </p>
      </span>

      <span className="flex">
        <p className="mr-auto">{`Fee:`}</p>
        <p className="font-medium">
          <RyskCountUp value={positionData.fee} />
          {` USDC`}
        </p>
      </span>

      <small className="block leading-6 text-gray-600 border-gray-600 border-b">
        {`Premium and fees are per option.`}
      </small>

      <span className="flex pt-2">
        <p className="mr-auto">{`Collateral required:`}</p>
        <AnimatePresence mode="wait">
          <motion.p
            className="font-medium"
            key={collateralType}
            {...FadeInOutQuick}
          >
            <RyskCountUp
              value={positionData.collateral}
              format={collateralType === "USDC" ? "USD" : "ETH"}
            />
            {collateralType === "USDC" ? ` USDC` : ` WETH`}
          </motion.p>
        </AnimatePresence>
      </span>

      <span className="flex pb-2 border-gray-600 border-b">
        <p className="mr-auto">{`Premium received:`}</p>
        <p className="font-medium">
          <RyskCountUp value={positionData.quote} />
          {` USDC`}
        </p>
      </span>

      <span className="flex pt-2">
        <p className="mr-auto">{`Balances after:`}</p>
        <p className="font-medium">
          <RyskCountUp value={positionData.remainingBalanceUSDC} />
          {` USDC`}
        </p>
      </span>

      <span className="flex">
        <span className="mr-auto" />
        <p className="font-medium">
          <RyskCountUp value={positionData.remainingBalanceWETH} format="ETH" />
          {` WETH`}
        </p>
      </span>

      <small className="flex flex-col pt-2 text-center leading-6 text-gray-600">
        {`Last updated: ${positionData.now}`}
      </small>
    </div>
  );
};
