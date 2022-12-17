import React, { useState } from "react";
import NumberFormat from "react-number-format";
// import { Card } from "./shared/Card";
// import ReactTooltip from "react-tooltip";
import { RyskTooltip } from "./RyskTooltip";
import { DHV_NAME } from "../config/constants";
import { gql, useQuery } from "@apollo/client";

export const VaultStats = () => {
  const [cumulativePricePerShares, setCumulativeSinceFirstEpoch] =
    useState<number>();

  // TODO Could remove as We are also querying all of the price per shares in Vault Chart
  useQuery(
    gql`
      query {
        pricePerShares(orderBy: "timestamp", orderDirection: "desc", first: 1) {
          id
          epoch
          value
          growthSinceFirstEpoch
          timestamp
        }
      }
    `,
    {
      onCompleted: (data) => {
        const growthSinceFirstEpoch = data?.pricePerShares[0]
          ? data.pricePerShares[0].growthSinceFirstEpoch
          : 0;
        growthSinceFirstEpoch &&
          setCumulativeSinceFirstEpoch(parseFloat(growthSinceFirstEpoch));
      },
      onError: (err) => {
        console.log(err);
      },
    }
  );
  return (
    <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
      <div className="flex h-full w-full justify-around">
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Cumulative Yield:{" "}
            <NumberFormat
              value={cumulativePricePerShares}
              displayType={"text"}
              decimalScale={2}
              suffix="%"
              className="font-medium"
            />
            <RyskTooltip
              id="yieldTip"
              message={`${DHV_NAME} price per share change since inception (September 29th,  2022)`}
            />
          </p>
          {/* <a
            href="https://docs.rysk.finance"
            className="underline text-center"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a> */}
        </div>
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Projected APY: {/** // TODO clean up if not used */}
            {/* <NumberFormat
              value={"%"}
              displayType={"text"}
              decimalScale={2}
              suffix="%"
              className="font-medium"
            />
            <RyskTooltip
              id="apyTip"
              message="Based on historical returns and the current options exposure"
            /> */}
            Soon™️
          </p>
          {/* <a
            href="https://docs.rysk.finance"
            className="underline text-center"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a> */}
        </div>
      </div>
    </div>
  );
};
