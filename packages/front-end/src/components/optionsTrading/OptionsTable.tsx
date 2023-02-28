import type { RefObject } from "react";

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
import CountUp from "react-countup";
import NumberFormat from "react-number-format";
import { useDebounce } from "use-debounce";
import { useAccount, useContract, useProvider } from "wagmi";

import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import { OptionCatalogueABI } from "src/abis/OptionCatalogue_ABI";
import { easeOutCubic } from "src/animation/easing";
import FadeInOut from "src/animation/FadeInOut";
import { BIG_NUMBER_DECIMALS } from "src/config/constants";
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
    },
    dispatch,
  } = useOptionsTradingContext();

  const [chainRows, setChainRows] = useState<StrikeOptions[]>([]);
  const [strikeRange] = useDebounce(visibleStrikeRange, 300);

  // TODO: Type this properly when I refactor this file.
  const { data: userData, refetch } = useQuery(
    gql`
      query ($address: String) {
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
      address && refetch();

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
              },
            };
          })
        );

        // Might be temp, possibly do this at the graph level
        // once we can get all this data from there?
        const sorted = optionsChainRows.sort((a, b) => a.strike - b.strike);

        setChainRows(sorted);
      };

      fetchPrices().catch((error) => {
        captureException(error);
        console.error(error);
      });
    }
  }, [
    userData?.account,
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
    <table className="block bg-bone">
      <thead className="block border-t border-gray-500">
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
          <th className="col-span-1 bg-bone-dark">Strike</th>
          {showCol("bid iv") && <th className="col-span-1">Bid IV</th>}
          <th className="col-span-1">Bid</th>
          <th className="col-span-1">Ask</th>
          {showCol("ask iv") && <th className="col-span-1">Ask IV</th>}
          {showCol("delta") && <th className="col-span-1">Delta</th>}
          {showCol("pos") && <th className="col-span-1">Pos</th>}
        </tr>
      </thead>

      <tbody className="block font-dm-mono text-sm">
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

              return (
                <motion.tr
                  className="grid even:bg-bone odd:bg-bone-light bg-[url('./assets/wave-lines.png')] even:bg-[top_right_-50%] even:lg:bg-[top_right_-15%] even:xl:bg-[top_right_0%] odd:bg-[top_left_-80%] odd:lg:bg-[top_left_-40%] odd:xl:bg-[top_left_-20%] bg-no-repeat text-right [&_td]:col-span-1 [&_td]:border [&_td]:border-dashed [&_td]:border-gray-500 [&_td]:ease-in-out [&_td]:duration-100 [&_td]:cursor-default [&_td]:text-2xs [&_td]:lg:text-xs [&_td]:xl:text-base"
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
                      {option.call.bid.IV ? (
                        <CountUp
                          className="after:content-['%'] after:ml-1"
                          decimals={2}
                          duration={0.3}
                          easingFn={easeOutCubic}
                          end={option.call.bid.IV}
                          preserveValue
                          useEasing
                        />
                      ) : (
                        <span>{"-"}</span>
                      )}
                    </td>
                  )}
                  <CountUp
                    decimals={2}
                    duration={0.3}
                    easingFn={easeOutCubic}
                    end={option.call.bid.quote}
                    preserveValue
                    useEasing
                  >
                    {({ countUpRef }) => {
                      const disabled =
                        option.call.bid.disabled || !option.call.bid.quote;

                      return (
                        <td
                          className={`p-0 ${
                            disabled ? "text-gray-600" : "text-red-700"
                          }
                      ${getColorClasses(option, "call")}`}
                        >
                          <button
                            className={`${
                              disabled ? "cursor-not-allowed" : "cursor-pointer"
                            } py-4 xl:py-3 px-1 xl:px-2 w-full text-right before:content-['$'] before:mr-1`}
                            onClick={() =>
                              setSelectedOption({
                                callOrPut: "call",
                                bidOrAsk: "bid",
                                strikeOptions: option,
                              })
                            }
                            disabled={disabled}
                            ref={countUpRef as RefObject<HTMLButtonElement>}
                          />
                        </td>
                      );
                    }}
                  </CountUp>
                  <CountUp
                    decimals={2}
                    duration={0.3}
                    easingFn={easeOutCubic}
                    end={option.call.ask.quote}
                    preserveValue
                    useEasing
                  >
                    {({ countUpRef }) => {
                      const disabled =
                        option.call.ask.disabled || !option.call.ask.quote;

                      return (
                        <td
                          className={`p-0 ${
                            disabled ? "text-gray-600" : "text-green-700"
                          }
                      ${getColorClasses(option, "call")}`}
                        >
                          <button
                            className={`${
                              disabled ? "cursor-not-allowed" : "cursor-pointer"
                            } py-4 xl:py-3 px-1 xl:px-2 w-full text-right before:content-['$'] before:mr-1`}
                            onClick={() =>
                              setSelectedOption({
                                callOrPut: "call",
                                bidOrAsk: "ask",
                                strikeOptions: option,
                              })
                            }
                            disabled={disabled}
                            ref={countUpRef as RefObject<HTMLButtonElement>}
                          />
                        </td>
                      );
                    }}
                  </CountUp>
                  {showCol("ask iv") && (
                    <td
                      className={`py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "call"
                      )}`}
                    >
                      {option.call.ask.IV ? (
                        <CountUp
                          className="after:content-['%'] after:ml-1"
                          decimals={2}
                          duration={0.3}
                          easingFn={easeOutCubic}
                          end={option.call.ask.IV}
                          preserveValue
                          useEasing
                        />
                      ) : (
                        <span>{"-"}</span>
                      )}
                    </td>
                  )}
                  {showCol("delta") && (
                    <td
                      className={`py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "call"
                      )}`}
                    >
                      <CountUp
                        decimals={2}
                        duration={0.3}
                        easingFn={easeOutCubic}
                        end={option.call.delta}
                        preserveValue
                        useEasing
                      />
                    </td>
                  )}
                  {showCol("pos") && (
                    <td
                      className={`!border-r-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "call"
                      )}`}
                    >
                      {option.call.pos ? (
                        <CountUp
                          decimals={2}
                          duration={0.3}
                          easingFn={easeOutCubic}
                          end={option.call.pos}
                          preserveValue
                          useEasing
                        />
                      ) : (
                        <span>{"-"}</span>
                      )}
                    </td>
                  )}
                  <td className="text-center bg-bone-dark !border-0 font-medium py-4 xl:py-3 px-1 xl:px-2">
                    <NumberFormat
                      value={option.strike}
                      displayType={"text"}
                      decimalScale={0}
                    />
                  </td>
                  {showCol("bid iv") && (
                    <td
                      className={`!border-l-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      {option.put.bid.IV ? (
                        <CountUp
                          className="after:content-['%'] after:ml-1"
                          decimals={2}
                          duration={0.3}
                          easingFn={easeOutCubic}
                          end={option.put.bid.IV}
                          preserveValue
                          useEasing
                        />
                      ) : (
                        <span>{"-"}</span>
                      )}
                    </td>
                  )}
                  <CountUp
                    decimals={2}
                    duration={0.3}
                    easingFn={easeOutCubic}
                    end={option.put.bid.quote}
                    preserveValue
                    useEasing
                  >
                    {({ countUpRef }) => {
                      {
                        const disabled =
                          option.put.bid.disabled || !option.put.bid.quote;

                        return (
                          <td
                            className={`p-0 ${
                              disabled ? "text-gray-600" : "text-red-700"
                            }
                          ${getColorClasses(option, "put")}`}
                          >
                            <button
                              className={`${
                                disabled
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              } py-4 xl:py-3 px-1 xl:px-2 w-full text-right before:content-['$'] before:mr-1`}
                              onClick={() =>
                                setSelectedOption({
                                  callOrPut: "put",
                                  bidOrAsk: "bid",
                                  strikeOptions: option,
                                })
                              }
                              disabled={disabled}
                              ref={countUpRef as RefObject<HTMLButtonElement>}
                            />
                          </td>
                        );
                      }
                    }}
                  </CountUp>
                  <CountUp
                    decimals={2}
                    duration={0.3}
                    easingFn={easeOutCubic}
                    end={option.put.ask.quote}
                    preserveValue
                    useEasing
                  >
                    {({ countUpRef }) => {
                      {
                        const disabled =
                          option.put.ask.disabled || !option.put.ask.quote;

                        return (
                          <td
                            className={`p-0 ${
                              disabled ? "text-gray-600" : "text-green-700"
                            }
                          ${getColorClasses(option, "put")}`}
                          >
                            <button
                              className={`${
                                disabled
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              } py-4 xl:py-3 px-1 xl:px-2 w-full text-right before:content-['$'] before:mr-1`}
                              onClick={() =>
                                setSelectedOption({
                                  callOrPut: "put",
                                  bidOrAsk: "ask",
                                  strikeOptions: option,
                                })
                              }
                              disabled={disabled}
                              ref={countUpRef as RefObject<HTMLButtonElement>}
                            />
                          </td>
                        );
                      }
                    }}
                  </CountUp>
                  {showCol("ask iv") && (
                    <td
                      className={`py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      {option.put.ask.IV ? (
                        <CountUp
                          className="after:content-['%'] after:ml-1"
                          decimals={2}
                          duration={0.3}
                          easingFn={easeOutCubic}
                          end={option.put.ask.IV}
                          preserveValue
                          useEasing
                        />
                      ) : (
                        <span>{"-"}</span>
                      )}
                    </td>
                  )}
                  {showCol("delta") && (
                    <td
                      className={`py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      <CountUp
                        decimals={2}
                        duration={0.3}
                        easingFn={easeOutCubic}
                        end={option.put.delta}
                        preserveValue
                        useEasing
                      />
                    </td>
                  )}
                  {showCol("pos") && (
                    <td
                      className={`!border-r-0 py-4 xl:py-3 px-1 xl:px-2 ${getColorClasses(
                        option,
                        "put"
                      )}`}
                    >
                      {option.put.pos ? (
                        <CountUp
                          decimals={2}
                          duration={0.3}
                          easingFn={easeOutCubic}
                          end={option.put.pos}
                          preserveValue
                          useEasing
                        />
                      ) : (
                        <span>{"-"}</span>
                      )}
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
