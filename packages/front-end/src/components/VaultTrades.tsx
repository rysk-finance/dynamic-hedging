import { gql, useQuery } from "@apollo/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useEffect, useState } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";
import NumberFormat from "react-number-format";

import ContentLoader from "react-content-loader";
import { CHAINID, DECIMALS } from "../config/constants";
import useElementOnScreen from "../hooks/useElementOnScreen";
import { optionSymbolFormat } from "../utils";

dayjs.extend(utc);

const TEN_DAYS_IN_SECONDS = 864000;
const TIMESTAMP_LIMIT = 1664553600;

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
  const [containerRef, isVisible] = useElementOnScreen({
    root: null,
    rootMargin: "10px",
    threshold: 1.0,
  });

  const [trades, setTrades] = useState<any[]>([]);

  const [section, setSection] = useState(1);

  const handle = useFullScreenHandle();

  const chainId =
    Number(process.env.REACT_APP_CHAIN_ID) === CHAINID.ARBITRUM_GOERLI
      ? CHAINID.ARBITRUM_GOERLI
      : CHAINID.ARBITRUM_MAINNET;

  const { fetchMore, data, loading, error } = useQuery(
    gql`
      query ($timestamp1: Int, $timestamp2: Int) {
        writeOptionsActions(
          orderBy: timestamp
          orderDirection: desc
          where: { timestamp_gte: $timestamp1, timestamp_lte: $timestamp2 }
        ) {
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
        buybackOptionActions(
          orderBy: timestamp
          orderDirection: desc
          where: { timestamp_gte: $timestamp1, timestamp_lte: $timestamp2 }
        ) {
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
        rebalanceDeltaActions(
          orderBy: timestamp
          orderDirection: desc
          where: { timestamp_gte: $timestamp1, timestamp_lte: $timestamp2 }
        ) {
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
      variables: {
        timestamp1: Math.floor(Date.now() / 1000) - TEN_DAYS_IN_SECONDS,
        timestamp2: Math.floor(Date.now() / 1000),
      },
      notifyOnNetworkStatusChange: true,
    }
  );

  useEffect(() => {
    if (isVisible) {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const timestamp1 = nowInSeconds - TEN_DAYS_IN_SECONDS * (section + 1);
      const timestamp2 = nowInSeconds - TEN_DAYS_IN_SECONDS * section;

      if (timestamp1 < TIMESTAMP_LIMIT && timestamp2 < TIMESTAMP_LIMIT) return;

      // NOTE: in case both times are below limit it's not going to return anything
      fetchMore({
        variables: {
          timestamp1:
            timestamp1 < TIMESTAMP_LIMIT ? TIMESTAMP_LIMIT : timestamp1,
          timestamp2:
            timestamp2 < TIMESTAMP_LIMIT ? TIMESTAMP_LIMIT : timestamp2,
        },
        // updateQuery: (prev, { fetchMoreResult }) => {
        //   if (!fetchMoreResult) return prev;
        //   const newTrades = parseTrades(fetchMoreResult);
        //   setTrades([...trades, ...newTrades]);
        //   setPage(page + 1);
        // },
      });
      setSection((prev) => prev + 1);
    }
  }, [isVisible]);

  return (
    <div className="w-full overflow-x-auto lg:overflow-x-clip relative">
      <FullScreen handle={handle} className="overflow-auto bg-bone">
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
                className="w-16 py-3 bg-bone border-b-2 border-black border-dashed"
              >
                <svg
                  className={`w-full h-4 shrink-0 motion-reduce:animate-bounce ${
                    handle.active ? "rotate-90" : "-rotate-90"
                  } cursor-pointer hover:text-gray-600`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  onClick={handle.active ? handle.exit : handle.enter}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"
                  ></path>
                </svg>
              </th>
            </tr>
          </thead>
          <tbody>
            {trades
              .sort(
                (a, b) =>
                  b.timestamp.localeCompare(a.timestamp) ||
                  Number(b.timestamp) - Number(a.timestamp)
              )
              .map((trade, i) => {
                return (
                  <>
                    <tr
                      className="border-b text-black bg-bone-dark"
                      key={trade.id}
                    >
                      <th
                        scope="row"
                        className="border-r border-black py-4 px-5 font-medium uppercase bg-bone-dark sticky left-0 z-1"
                      >
                        {/** NOTE: if trades not going out of screen this goes to last trade and triggers fetchMore due to containerRef hook */}
                        {i === trades.length - 1 && (
                          <span
                            ref={i === trades.length - 1 ? containerRef : null}
                          />
                        )}
                        {`${dayjs
                          .unix(trade.timestamp)
                          .format("DD-MMM-YY HH:mm")} UTC`}
                      </th>
                      <td className="py-4 px-6 text-md bg-bone font-parabole">
                        <div className="flex lg:flex-row flex-col justify-between items-center">
                          <span className="font-semibold">
                            {trade.typename === "WriteOptionsAction" && "SHORT"}
                            {trade.typename === "BuybackOptionAction" &&
                              "BUYBACK"}
                            {trade.typename === "RebalanceDeltaAction" &&
                              "DELTA"}
                          </span>
                          {[
                            "WriteOptionsAction",
                            "BuybackOptionAction",
                          ].includes(trade.typename) && (
                            <span
                              className={
                                "bg-amber-100 border border-amber-300 text-amber-800 px-2.5 lg:py-0.5 rounded text-md mt-1 lg:mt-0 font-bold ml-2 "
                              }
                            >
                              Options
                            </span>
                          )}
                          {trade.typename === "RebalanceDeltaAction" && (
                            <span
                              className={
                                "border border-blue-200 bg-blue-100 text-blue-800 px-2.5 lg:py-0.5 rounded text-md mt-1 lg:mt-0 font-bold ml-2 "
                              }
                            >
                              Rebalance
                            </span>
                          )}
                        </div>
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
                      <td className="py-4 px-6 text-right">
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
                      <td className="py-4 px-6 bg-bone text-right">
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
                      <td className="py-4 px-6 text-right">
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
                            href={`${process.env.REACT_APP_SCAN_URL}/tx/${trade.transactionHash}`}
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
            {loading && (
              <tr>
                {Array.from(Array(8).keys()).map((el) => (
                  <td
                    key={el}
                    className={`bg-bone ${
                      el % 2 == 0 ? "bg-bone-dark" : "bg-bone"
                    }`}
                  >
                    {el !== 7 && (
                      <ContentLoader width="75" height="45">
                        <rect x="20" y="10" width="100%" height="13" />
                      </ContentLoader>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
        {error && (
          <div className="m-5 flex flex-row justify-center">
            <p>{error.message.slice(0, 100)}</p>
          </div>
        )}
      </FullScreen>
    </div>
  );
};
