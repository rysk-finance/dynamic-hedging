import React, { useState } from "react";
import { gql, useQuery } from "@apollo/client";
import moment from "moment";
import {
  BIG_NUMBER_DECIMALS,
  CHAINID,
  DECIMALS,
  SCAN_URL,
} from "../config/constants";
import NumberFormat from "react-number-format";
import { utils } from "ethers";
import { optionSymbolFormat } from "../utils";

const parseTrades = (data: any) => {
  const writeOptionsActions = data?.writeOptionsActions;
  const buybackOptionActions = data?.buybackOptionActions;
  const rebalanceDeltaActions = data?.rebalanceDeltaActions;

  const allTrades = [
    ...writeOptionsActions,
    ...buybackOptionActions,
    ...rebalanceDeltaActions,
  ].map((trade) => {
    const tradeType = ["WriteOptionsAction", "BuybackOptionAction"].includes(
      trade.__typename
    )
      ? "optionsTrade"
      : "deltaRebalance";

    return {
      id: trade.id,
      typename: trade.__typename,
      tradeType: tradeType,
      optionSymbol:
        tradeType === "optionsTrade"
          ? optionSymbolFormat(
              trade.otoken.isPut,
              trade.otoken.expiryTimestamp,
              trade.otoken.strikePrice
            )
          : "",
      amount: tradeType === "optionsTrade" ? trade.amount : null,
      premium: tradeType === "optionsTrade" ? trade.premium : null,
      deltaChange: tradeType === "optionsTrade" ? null : trade.deltaChange,
      timestamp: trade.timestamp,
      transactionHash: trade.transactionHash,
    };
  });

  return allTrades;
};

export const VaultTrades = () => {
  const [trades, setTrades] = useState<any[]>([]);

  const chainId =
    Number(process.env.REACT_APP_CHAIN_ID) === CHAINID.ARBITRUM_RINKEBY
      ? CHAINID.ARBITRUM_RINKEBY
      : CHAINID.ARBITRUM_MAINNET;

  // exclude test trades
  const startTimestamp = 1664553600;

  useQuery(
    gql`
        query {
          writeOptionsActions(first: 1000, orderBy: timestamp, orderDirection: desc, where: {timestamp_gte: ${startTimestamp} }) {
            id
            timestamp
            otoken {
              symbol
              strikePrice
              isPut
              expiryTimestamp
            }
            amount
            premium
            transactionHash
          }
          buybackOptionActions(first: 1000, orderBy: timestamp, orderDirection: desc, where: {timestamp_gte: ${startTimestamp} }) {
            id
            timestamp
            otoken {
              symbol
              strikePrice
              isPut
              expiryTimestamp
            }
            amount
            premium
            transactionHash
          }
          rebalanceDeltaActions(first: 1000, orderBy: timestamp, orderDirection: desc, where: {timestamp_gte: ${startTimestamp} }) {
            id
            timestamp
            deltaChange
            transactionHash
          }
        }
      `,
    {
      onCompleted: (data) => {
        const allTrades = parseTrades(data);
        setTrades(allTrades);
      },
      onError: (err) => {
        console.log(err);
      },
    }
  );

  return (
    <div className="w-full overflow-x-auto lg:overflow-x-clip relative">
      <table className="w-full text-sm text-left border-separate border-spacing-0 border-black">
        <thead className="text-xs text-gray-700 uppercase sticky top-0 z-1">
          <tr>
            <th
              scope="col"
              className="py-3 px-5 bg-bone-dark border-b-2 border-r border-black bg-bone-dark z-2 sticky left-0"
            >
              Date
            </th>
            <th
              scope="col"
              className="py-3 px-6 bg-bone border-b-2 border-black"
            >
              Trade
            </th>
            <th
              scope="col"
              className="py-3 px-6 bg-bone-dark border-b-2 border-black"
            >
              Product
            </th>
            <th
              scope="col"
              className="py-3 px-6 bg-bone border-b-2 border-black"
            >
              Size
            </th>
            <th
              scope="col"
              className="py-3 px-6 bg-bone-dark border-b-2 border-black"
            >
              Premium Received
            </th>
            <th
              scope="col"
              className="py-3 px-6 bg-bone border-b-2 border-black"
            >
              Premium Paid
            </th>
            <th
              scope="col"
              className="py-3 px-6 bg-bone-dark border-b-2 border-black"
            >
              Delta Change
            </th>
            <th
              scope="col"
              className="py-3 bg-bone border-b-2 border-black border-dashed"
            ></th>
          </tr>
        </thead>
        {trades
          .sort(
            (a, b) =>
              b.timestamp.localeCompare(a.timestamp) ||
              Number(b.timestamp) - Number(a.timestamp)
          )
          .map((trade) => {
            return (
              <>
                <tr
                  className="border-b text-black bg-bone-dark "
                  key={trade.id}
                >
                  <th
                    scope="row"
                    className="border-r border-black py-4 px-5 uppercase font-parabole font-bold bg-bone-dark sticky left-0 z-1"
                  >
                    <div className="flex lg:flex-row flex-col justify-between items-center ">
                      {/*<span className="bg-blue-100 text-blue-800 text-xs mt-1 lg:mt-0 font-semibold ml-2 px-2.5 lg:py-0.5 rounded dark:bg-blue-200 dark:text-blue-800">*/}
                      {/*  {entry.protocol}*/}
                      {/*</span>*/}
                      {moment
                        .utc(trade.timestamp * 1000)
                        .format("DD-MMM-YY HH:mm")}{" "}
                      UTC
                    </div>
                  </th>
                  <td className="py-4 px-6 bg-bone">
                    {trade.typename === "WriteOptionsAction" && "Short Options"}
                    {trade.typename === "BuybackOptionAction" &&
                      "Buyback Options"}
                    {trade.typename === "RebalanceDeltaAction" &&
                      "Delta Rebalance"}
                  </td>
                  <td className="py-4 px-6">{trade.optionSymbol}</td>
                  <td className="py-4 px-6 bg-bone">
                    {trade.amount && (
                      <NumberFormat
                        value={(
                          Number(trade.amount) /
                          10 ** DECIMALS.RYSK
                        ).toFixed(2)}
                        displayType={"text"}
                        decimalScale={2}
                      />
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {trade.premium &&
                      trade.typename === "WriteOptionsAction" && (
                        <NumberFormat
                          value={(
                            Number(trade.premium) /
                            10 ** DECIMALS.RYSK
                          ).toFixed(2)}
                          displayType={"text"}
                          prefix={"$"}
                          decimalScale={2}
                        />
                      )}
                  </td>
                  <td className="py-4 px-6 bg-bone">
                    {trade.premium &&
                      trade.typename === "BuybackOptionAction" && (
                        <NumberFormat
                          value={(
                            Number(trade.premium) /
                            10 ** DECIMALS.RYSK
                          ).toFixed(2)}
                          displayType={"text"}
                          prefix={"$"}
                          decimalScale={2}
                        />
                      )}
                  </td>
                  <td className="py-4 px-6">
                    {trade.deltaChange && (
                      <NumberFormat
                        value={(
                          Number(-trade.deltaChange) /
                          10 ** DECIMALS.RYSK
                        ).toFixed(2)}
                        displayType={"text"}
                        decimalScale={2}
                      />
                    )}
                  </td>
                  <td className="bg-bone">
                    <th className="flex mx-5 justify-center items-center">
                      <a
                        href={`${SCAN_URL[chainId]}/tx/${trade.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                      </a>
                    </th>
                  </td>
                </tr>
              </>
            );
          })}
      </table>
    </div>
  );
};
