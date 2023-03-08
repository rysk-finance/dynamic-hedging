import type {
  ColumNames,
  OptionSeries,
  SelectedOption,
  StrikeOptions,
} from "../../state/types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { BigNumber, utils } from "ethers";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAccount, useContract, useProvider } from "wagmi";

import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import { OptionCatalogueABI } from "src/abis/OptionCatalogue_ABI";
import FadeInOut from "src/animation/FadeInOut";
import { QueriesEnum } from "src/clients/Apollo/Queries";
import { BIG_NUMBER_DECIMALS } from "src/config/constants";
import { useGraphPolling } from "src/hooks/useGraphPolling";
import { toTwoDecimalPlaces } from "src/utils/rounding";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import {
  fromOpynToNumber,
  fromWei,
  tFormatUSDC,
  toWei,
} from "../../utils/conversion-helper";
import {
  calculateOptionDeltaLocally,
  getContractAddress,
  returnIVFromQuote,
} from "../../utils/helpers";
import { RyskCountUp } from "../shared/RyskCountUp";

export const OptionsTable = () => {
  const { address } = useAccount();
  const provider = useProvider();

  const {
    state: { ethPrice },
  } = useGlobalContext();

  const {
    state: {
      optionType,
      customOptionStrikes,
      expiryDate,
      selectedOption,
      visibleStrikeRange,
      visibleColumns,
      chainData,
    },
    dispatch,
  } = useOptionsTradingContext();

  const [chainRows, setChainRows] = useState<StrikeOptions[]>([]);
  const [strikeRange] = useDebounce(visibleStrikeRange, 300);

  // TODO: Type this properly when I refactor this file.
  const { data: userData, startPolling } = useQuery(
    gql`
      query ${QueriesEnum.USER_BALANCE_DATA} ($address: String) {
        account(id: $address) {
          balances {
            token {
              isPut
              expiryTimestamp
              strikePrice
            }
            balance
          }
        }
      }
    `,
    {
      onError: (err) => {
        captureException(err);
        console.error(err);
      },
      variables: {
        address: address?.toLowerCase(),
      },
      skip: !address,
    }
  );

  useGraphPolling(userData, startPolling);

  const beyondPricer = useContract({
    address: getContractAddress("beyondPricer"),
    abi: BeyondPricerABI,
    signerOrProvider: provider,
  });

  const portfolioValuesFeed = useContract({
    address: getContractAddress("portfolioValuesFeed"),
    abi: AlphaPortfolioValuesFeedABI,
    signerOrProvider: provider,
  });

  const optionCatalogue = useContract({
    address: getContractAddress("optionCatalogue"),
    abi: OptionCatalogueABI,
    signerOrProvider: provider,
  });

  useEffect(() => {
    if (
      ethPrice &&
      expiryDate &&
      optionCatalogue &&
      portfolioValuesFeed &&
      beyondPricer
    ) {
      if (chainData[expiryDate]) {
        setChainRows(chainData[expiryDate]);
      }

      const bigNumberExpiry = BigNumber.from(expiryDate);

      const fetchPrices = async () => {
        const strikeData = await Promise.all([
          optionCatalogue.getOptionDetails(bigNumberExpiry, false),
          optionCatalogue.getOptionDetails(bigNumberExpiry, true),
        ]);

        const strikes = new Set(strikeData.flat().map(String));

        const optionsChainRows = await Promise.all(
          Array.from(strikes).map(async (strike) => {
            const oHashCall = utils.solidityKeccak256(
              ["uint64", "uint128", "bool"],
              [expiryDate, strike, false]
            ) as HexString;
            const oHashPut: HexString = utils.solidityKeccak256(
              ["uint64", "uint128", "bool"],
              [expiryDate, strike, true]
            ) as HexString;

            const callAvailability = await optionCatalogue.getOptionStores(
              oHashCall
            );
            const putAvailability = await optionCatalogue.getOptionStores(
              oHashPut
            );

            const callExposure = await portfolioValuesFeed.netDhvExposure(
              oHashCall
            );
            const putExposure = await portfolioValuesFeed.netDhvExposure(
              oHashPut
            );

            const optionSeriesCall: OptionSeries = {
              expiration: bigNumberExpiry,
              strike: BigNumber.from(strike),
              strikeAsset: getContractAddress("USDC"),
              underlying: getContractAddress("WETH"),
              collateral: getContractAddress("USDC"),
              isPut: false,
            };

            const optionSeriesPut: OptionSeries = {
              ...optionSeriesCall,
              isPut: true,
            };

            const _getQuoteTotal = async (
              series: OptionSeries,
              netDhvExposure: BigNumber,
              isSell: boolean = false
            ) => {
              const quote = await beyondPricer.quoteOptionPrice(
                series,
                toWei((1).toString()), // 1 for the table view but fetch if user wants to buy more
                isSell,
                netDhvExposure
              );
              const quoteTotal = tFormatUSDC(quote[0].add(quote[2]));

              return quoteTotal >= 0.01 ? quoteTotal : 0;
            };

            const quoteAskCallTotal = await _getQuoteTotal(
              optionSeriesCall,
              callExposure
            );
            const quoteAskPutTotal = await _getQuoteTotal(
              optionSeriesPut,
              putExposure
            );
            const quoteBidCallTotal = await _getQuoteTotal(
              optionSeriesCall,
              callExposure,
              true
            );
            const quoteBidPutTotal = await _getQuoteTotal(
              optionSeriesPut,
              putExposure,
              true
            );

            const localDeltaCall = await calculateOptionDeltaLocally(
              optionSeriesCall,
              toWei((1).toString()),
              false
            );
            const localDeltaPut = await calculateOptionDeltaLocally(
              optionSeriesPut,
              toWei((1).toString()),
              false
            );

            // QUESTION: Calculated on total including fees?
            const ivAskCall = await returnIVFromQuote(
              quoteAskCallTotal,
              optionSeriesCall
            );
            const ivBidCall = await returnIVFromQuote(
              quoteBidCallTotal,
              optionSeriesCall
            );
            const ivAskPut = await returnIVFromQuote(
              quoteAskPutTotal,
              optionSeriesPut
            );
            const ivBidPut = await returnIVFromQuote(
              quoteBidPutTotal,
              optionSeriesPut
            );

            const positions: {
              call: number;
              put: number;
            } = userData?.account?.balances.reduce(
              (
                acc: {
                  call: number;
                  put: number;
                },
                { token, balance }: { token: any; balance: string }
              ) => {
                const matchesExpiry =
                  Number(token.expiryTimestamp) === expiryDate;
                const matchesStrike =
                  BigNumber.from(token.strikePrice)
                    .div(BIG_NUMBER_DECIMALS.OPYN)
                    .mul(BIG_NUMBER_DECIMALS.RYSK)
                    .toString() === strike;

                if (matchesExpiry && matchesStrike && token.isPut) {
                  acc.put = fromOpynToNumber(balance);
                }

                if (matchesExpiry && matchesStrike && !token.isPut) {
                  acc.call = fromOpynToNumber(balance);
                }

                return acc;
              },
              { call: 0, put: 0 }
            );

            return {
              strike: Number(fromWei(strike).toString()),
              call: {
                bid: {
                  IV: toTwoDecimalPlaces(ivBidCall),
                  quote: quoteBidCallTotal,
                  disabled: !callAvailability.isSellable,
                },
                ask: {
                  IV: toTwoDecimalPlaces(ivAskCall),
                  quote: quoteAskCallTotal,
                  disabled: !callAvailability.isBuyable,
                },
                delta: Number(fromWei(localDeltaCall).toString()),
                pos: positions?.call || 0,
                exposure: callExposure.div(BIG_NUMBER_DECIMALS.RYSK).toNumber(),
              },
              put: {
                bid: {
                  IV: toTwoDecimalPlaces(ivBidPut),
                  quote: quoteBidPutTotal,
                  disabled: !putAvailability.isSellable,
                },
                ask: {
                  IV: toTwoDecimalPlaces(ivAskPut),
                  quote: quoteAskPutTotal,
                  disabled: !putAvailability.isBuyable,
                },
                delta: Number(fromWei(localDeltaPut).toString()),
                pos: positions?.put || 0,
                exposure: putExposure.div(BIG_NUMBER_DECIMALS.RYSK).toNumber(),
              },
            };
          })
        );

        // Might be temp, possibly do this at the graph level
        // once we can get all this data from there?
        const sorted = optionsChainRows.sort((a, b) => a.strike - b.strike);

        dispatch({
          type: OptionsTradingActionType.SET_CHAIN_DATA_FOR_EXPIRY,
          expiry: expiryDate,
          data: sorted,
        });
        setChainRows(sorted);
      };

      fetchPrices().catch((error) => {
        captureException(error);
        console.error(error);
      });
    }
  }, [
    userData,
    ethPrice,
    optionType,
    customOptionStrikes,
    expiryDate,
    portfolioValuesFeed,
  ]);

  const setSelectedOption = (option: SelectedOption) => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  const sideSize = visibleColumns.size;
  const colSize = visibleColumns.size * 2 + 1;
  const showCol = useCallback(
    (columnName: ColumNames) => visibleColumns.has(columnName),
    [visibleColumns]
  );

  return (
    <table className="block bg-bone overflow-x-auto" id="options-chain">
      <thead className="block w-[150%] lg:w-full border-t border-gray-500">
        <tr
          className="grid bg-bone-dark [&_th]:text-sm [&_th]:xl:text-base [&_th]:py-3 [&_th]:px-0"
          style={{ gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))` }}
        >
          <th style={{ gridColumn: `span ${sideSize} / span ${sideSize}` }}>
            CALLS
          </th>
          <th className="col-span-1">
            {expiryDate && dayjs.unix(expiryDate).format("MMM DD")}
          </th>
          <th style={{ gridColumn: `span ${sideSize} / span ${sideSize}` }}>
            PUTS
          </th>
        </tr>
        <tr
          className="grid [&_th]:text-xs [&_th]:lg:text-sm [&_th]:xl:text-base [&_th]:py-3"
          style={{ gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))` }}
        >
          {showCol("bid iv") && <th className="col-span-1">Bid IV</th>}
          <th className="col-span-1">Bid</th>
          <th className="col-span-1">Ask</th>
          {showCol("ask iv") && <th className="col-span-1">Ask IV</th>}
          {showCol("delta") && <th className="col-span-1">Delta</th>}
          {showCol("pos") && <th className="col-span-1">Pos</th>}
          {showCol("exposure") && <th className="col-span-1">DHV</th>}
          <th className="col-span-1 bg-bone-dark">Strike</th>
          {showCol("bid iv") && <th className="col-span-1">Bid IV</th>}
          <th className="col-span-1">Bid</th>
          <th className="col-span-1">Ask</th>
          {showCol("ask iv") && <th className="col-span-1">Ask IV</th>}
          {showCol("delta") && <th className="col-span-1">Delta</th>}
          {showCol("pos") && <th className="col-span-1">Pos</th>}
          {showCol("exposure") && <th className="col-span-1">DHV</th>}
        </tr>
      </thead>

      <tbody className="block w-[150%] lg:w-full font-dm-mono text-sm">
        <AnimatePresence initial={false}>
          {Boolean(chainRows.length) &&
            chainRows.map((option) => {
              const getColorClasses = (
                option: StrikeOptions,
                side: SelectedOption["callOrPut"]
              ) => {
                const strikeSelected =
                  option.strike === selectedOption?.strikeOptions.strike;
                const callRowSelected =
                  selectedOption?.callOrPut === "call" && strikeSelected;
                const putRowSelected =
                  selectedOption?.callOrPut === "put" && strikeSelected;
                const callITM = ethPrice && option.strike <= ethPrice;
                const putITM = ethPrice && option.strike >= ethPrice;

                switch (true) {
                  case (callRowSelected && callITM && side === "call") ||
                    (putRowSelected && putITM && side === "put"):
                    return "bg-green-100";

                  case (callITM && side === "call") ||
                    (putITM && side === "put"):
                    return "bg-green-100/25 hover:bg-green-100";

                  case (callRowSelected && side === "call") ||
                    (putRowSelected && side === "put"):
                    return "bg-bone-dark/60";

                  default:
                    return "hover:bg-bone-dark/50";
                }
              };

              if (
                (strikeRange[0] && option.strike < Number(strikeRange[0])) ||
                (strikeRange[1] && option.strike > Number(strikeRange[1]))
              ) {
                return null;
              }

              const callBidDisabled =
                option.call.bid.disabled || !option.call.bid.quote;
              const callAskDisabled =
                option.call.ask.disabled || !option.call.ask.quote;
              const putBidDisabled =
                option.put.bid.disabled || !option.put.bid.quote;
              const putAskDisabled =
                option.put.ask.disabled || !option.put.ask.quote;

              return (
                <motion.tr
                  className="grid even:bg-bone odd:bg-bone-light bg-[url('./assets/wave-lines.png')] even:bg-[top_right_-50%] even:lg:bg-[top_right_-15%] even:xl:bg-[top_right_0%] odd:bg-[top_left_-80%] odd:lg:bg-[top_left_-40%] odd:xl:bg-[top_left_-20%] bg-no-repeat text-right [&_td]:col-span-1 [&_td]:border [&_td]:border-dashed [&_td]:border-gray-500 [&_td]:ease-in-out [&_td]:duration-100 [&_td]:cursor-default [&_td]:text-2xs [&_td]:xl:text-base"
                  key={option.strike}
                  style={{
                    gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))`,
                  }}
                  {...FadeInOut()}
                >
                  {showCol("bid iv") && (
                    <td
                      className={`!border-l-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "call"
                      )}`}
                    >
                      <span
                        className={
                          option.call.bid.IV
                            ? "after:content-['%'] after:ml-1"
                            : ""
                        }
                      >
                        <RyskCountUp value={option.call.bid.IV} />
                      </span>
                    </td>
                  )}
                  <td
                    className={`p-0 ${
                      callBidDisabled ? "text-gray-600" : "text-green-700"
                    }
                      ${getColorClasses(option, "call")}`}
                  >
                    <button
                      className={`${
                        callBidDisabled
                          ? "cursor-not-allowed"
                          : "cursor-pointer"
                      } py-4 xl:py-3 px-1 xl:px-2 w-full text-right before:content-['$'] before:mr-1`}
                      onClick={() =>
                        setSelectedOption({
                          callOrPut: "call",
                          bidOrAsk: "bid",
                          strikeOptions: option,
                        })
                      }
                      disabled={callBidDisabled}
                    >
                      <RyskCountUp value={option.call.bid.quote} />
                    </button>
                  </td>
                  <td
                    className={`p-0 ${
                      callAskDisabled ? "text-gray-600" : "text-red-700"
                    }
                      ${getColorClasses(option, "call")}`}
                  >
                    <button
                      className={`${
                        callAskDisabled
                          ? "cursor-not-allowed"
                          : "cursor-pointer"
                      } py-4 xl:py-3 px-1 xl:px-2 w-full text-right before:content-['$'] before:mr-1`}
                      onClick={() =>
                        setSelectedOption({
                          callOrPut: "call",
                          bidOrAsk: "ask",
                          strikeOptions: option,
                        })
                      }
                      disabled={callAskDisabled}
                    >
                      <RyskCountUp value={option.call.ask.quote} />
                    </button>
                  </td>
                  {showCol("ask iv") && (
                    <td
                      className={`py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "call"
                      )}`}
                    >
                      <span
                        className={
                          option.call.ask.IV
                            ? "after:content-['%'] after:ml-1"
                            : ""
                        }
                      >
                        <RyskCountUp value={option.call.ask.IV} />
                      </span>
                    </td>
                  )}
                  {showCol("delta") && (
                    <td
                      className={`py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "call"
                      )}`}
                    >
                      <RyskCountUp value={option.call.delta} />
                    </td>
                  )}
                  {showCol("pos") && (
                    <td
                      className={`!border-r-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "call"
                      )}`}
                    >
                      <span>
                        <RyskCountUp value={option.call.pos} />
                      </span>
                    </td>
                  )}
                  {showCol("exposure") && (
                    <td
                      className={`!border-r-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "call"
                      )}`}
                    >
                      <span>
                        <RyskCountUp value={option.call.exposure} />
                      </span>
                    </td>
                  )}
                  <td className="text-center bg-bone-dark !border-0 font-medium py-4 xl:py-3 px-1 xl:px-2">
                    <RyskCountUp value={option.strike} format="Integer" />
                  </td>
                  {showCol("bid iv") && (
                    <td
                      className={`!border-l-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      <span
                        className={
                          option.put.bid.IV
                            ? "after:content-['%'] after:ml-1"
                            : ""
                        }
                      >
                        <RyskCountUp value={option.put.bid.IV} />
                      </span>
                    </td>
                  )}
                  <td
                    className={`p-0 ${
                      putBidDisabled ? "text-gray-600" : "text-green-700"
                    }
                          ${getColorClasses(option, "put")}`}
                  >
                    <button
                      className={`${
                        putBidDisabled ? "cursor-not-allowed" : "cursor-pointer"
                      } py-4 xl:py-3 px-1 xl:px-2 w-full text-right before:content-['$'] before:mr-1`}
                      onClick={() =>
                        setSelectedOption({
                          callOrPut: "put",
                          bidOrAsk: "bid",
                          strikeOptions: option,
                        })
                      }
                      disabled={putBidDisabled}
                    >
                      <RyskCountUp value={option.put.bid.quote} />
                    </button>
                  </td>
                  <td
                    className={`p-0 ${
                      putAskDisabled ? "text-gray-600" : "text-red-700"
                    }
                          ${getColorClasses(option, "put")}`}
                  >
                    <button
                      className={`${
                        putAskDisabled ? "cursor-not-allowed" : "cursor-pointer"
                      } py-4 xl:py-3 px-1 xl:px-2 w-full text-right before:content-['$'] before:mr-1`}
                      onClick={() =>
                        setSelectedOption({
                          callOrPut: "put",
                          bidOrAsk: "ask",
                          strikeOptions: option,
                        })
                      }
                      disabled={putAskDisabled}
                    >
                      <RyskCountUp value={option.put.ask.quote} />
                    </button>
                  </td>
                  {showCol("ask iv") && (
                    <td
                      className={`py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      <span
                        className={
                          option.put.ask.IV
                            ? "after:content-['%'] after:ml-1"
                            : ""
                        }
                      >
                        <RyskCountUp value={option.put.ask.IV} />
                      </span>
                    </td>
                  )}
                  {showCol("delta") && (
                    <td
                      className={`py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      <RyskCountUp value={option.put.delta} />
                    </td>
                  )}
                  {showCol("pos") && (
                    <td
                      className={`!border-r-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      <RyskCountUp value={option.put.pos} />
                    </td>
                  )}
                  {showCol("exposure") && (
                    <td
                      className={`!border-r-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      <RyskCountUp value={option.put.exposure} />
                    </td>
                  )}
                </motion.tr>
              );
            })}
        </AnimatePresence>
      </tbody>
    </table>
  );
};
