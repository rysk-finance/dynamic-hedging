import React, { useState } from "react";
import { gql, useQuery } from "@apollo/client";
import moment from "moment";
import { BIG_NUMBER_DECIMALS, CHAINID, DECIMALS, SCAN_URL } from "../config/constants";
import NumberFormat from "react-number-format";
import { utils } from "ethers";
import { optionSymbolFormat } from "../utils";

export const VaultTrades = () => {

  const [trades, setTrades] = useState<any[]>();

    const chainId =
    Number(process.env.REACT_APP_CHAIN_ID) === CHAINID.ARBITRUM_RINKEBY
      ? CHAINID.ARBITRUM_RINKEBY
      : CHAINID.ARBITRUM_MAINNET;

  const parseTrades = (data: any) => {

    const writeOptionsActions = data?.writeOptionsActions
    const rebalanceDeltaActions = data?.rebalanceDeltaActions

    const allTrades = [...writeOptionsActions, ...rebalanceDeltaActions].map( trade => {

      const tradeType = trade.__typename === "WriteOptionsAction" ? "optionsTrade" : "deltaRebalance";

      return {
        id: trade.id,
        tradeType: tradeType,
        optionSymbol: tradeType === "optionsTrade" 
                                    ? optionSymbolFormat(trade.otoken.isPut, trade.otoken.expiryTimestamp, trade.otoken.strikePrice) 
                                    : "",
        amount: tradeType === "optionsTrade" ? trade.amount : null,
        premium: tradeType === "optionsTrade" ? trade.premium : null,
        deltaChange: tradeType === "optionsTrade" ? null : trade.deltaChange,
        timestamp: trade.timestamp,
        transactionHash: trade.transactionHash
      }
    })

    setTrades(allTrades)

  }

  const startTimestamp = 1664553600

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
      rebalanceDeltaActions(first: 1000, orderBy: timestamp, orderDirection: desc, where: {timestamp_gte: ${startTimestamp} }) {
        id
        timestamp
        deltaChange
        transactionHash
      }
    }
  `,
    {
      onCompleted: parseTrades,
      onError: (err) => {
        console.log(err);
      },
    }
  );

  return (
    <div className="pb-8 py-12 px-8">

      <div className="grid grid-cols-12 text-left text-lg pb-4">
        <div className="col-span-2">Date</div>
        <div className="col-span-2">Trade Type</div>
        <div className="col-span-3">Option</div>
        <div className="col-span-1 text-right">Size</div>
        <div className="col-span-2 text-right">Premium Received</div>
        <div className="col-span-2 text-right">Delta Change</div>
      </div>

      { trades && 
        trades.sort(
          (a, b) =>
            b.timestamp.localeCompare(
              a.timestamp
            ) ||
            Number(b.timestamp) -
              Number(a.timestamp)
        ).map(trade => (

        <div key={trade.id} className="w-full">
          <a href={`${SCAN_URL[chainId]}/tx/${trade.transactionHash}`} target="_blank" rel="noreferrer">
            <div className="grid grid-cols-12 py-2 text-black">
              <div className="col-span-2">
                {moment.utc(trade.timestamp * 1000).format("DD-MMM-YY HH:mm")} UTC
              </div>
              <div className="col-span-2">
                { trade.tradeType === "optionsTrade" ? "Short Option" : "Delta Rebalance" }
              </div>
              <div className="col-span-3">
                { trade.optionSymbol }
              </div>
              <div className="col-span-1 text-right">
                { trade.amount && 
                  <NumberFormat
                    value={(
                      Number(trade.amount) /
                      10 ** DECIMALS.RYSK
                    ).toFixed(2)}
                    displayType={"text"}
                    decimalScale={2}
                  />
                }
              </div>
              <div className="col-span-2 text-right">
                { trade.premium && 
                  <NumberFormat
                    value={(
                      Number(trade.premium) /
                      10 ** DECIMALS.RYSK
                    ).toFixed(2)}
                    displayType={"text"}
                    prefix={"$"}
                    decimalScale={2}
                  />
                }
              </div>
              <div className="col-span-2 text-right">
                { trade.deltaChange && 
                  <NumberFormat
                    value={(
                      Number(trade.deltaChange) /
                      10 ** DECIMALS.RYSK
                    ).toFixed(2)}
                    displayType={"text"}
                    decimalScale={2}
                  />
                }
              </div >
            </div>
          </a>
        </div>

      ))}

    </div>
  );
};
