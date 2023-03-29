import { PricingProps } from "../types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const Pricing = ({ positionData }: PricingProps) => {
  const {
    callOrPut,
    expiry,
    fee,
    now,
    premium,
    quote,
    remainingBalance,
    strike,
  } = positionData;

  return (
    <div className="flex flex-col">
      <p className="text-center py-4 bg-white border-b-2 border-black font-dm-mono">
        {`ETH ${expiry} $${strike} ${callOrPut}`.toUpperCase()}
      </p>

      <div className="w-3/5 mx-auto py-4">
        <span className="flex">
          <p className="mr-auto">{`Premium:`}</p>
          <p className="font-medium">
            {`$ `}
            <RyskCountUp value={premium} />
          </p>
        </span>

        <span className="flex pb-2 border-gray-600 border-b">
          <p className="mr-auto">{`Fee:`}</p>
          <p className="font-medium">
            {`$ `}
            <RyskCountUp value={fee} />
          </p>
        </span>

        <span className="flex py-2 border-gray-600 border-b">
          <p className="mr-auto">{`Total to pay:`}</p>
          <p className="font-medium">
            {`$ `}
            <RyskCountUp value={quote} />
          </p>
        </span>

        <span className="flex pt-2">
          <p className="mr-auto">{`Balance after:`}</p>
          <p className="font-medium">
            {`$ `}
            <RyskCountUp value={remainingBalance} />
          </p>
        </span>
      </div>

      <small className="pb-4 text-center leading-6 text-gray-600">{`Last updated: ${now}`}</small>
    </div>
  );
};
