import type {
  OptionSeries,
  SelectedOption,
  StrikeOptions,
} from "../../state/types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { BigNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import NumberFormat from "react-number-format";
import { useContract, useProvider, useAccount } from "wagmi";

import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import { OptionCatalogueABI } from "src/abis/OptionCatalogue_ABI";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import {
  fromWei,
  tFormatUSDC,
  toWei,
  fromOpyn,
} from "../../utils/conversion-helper";
import {
  calculateOptionDeltaLocally,
  getContractAddress,
  returnIVFromQuote,
} from "../../utils/helpers";
import { BIG_NUMBER_DECIMALS } from "src/config/constants";

export const OptionsTable = () => {
  const { address } = useAccount();
  const provider = useProvider();

  const {
    state: { ethPrice },
  } = useGlobalContext();

  const {
    state: { optionType, customOptionStrikes, expiryDate, selectedOption },
    dispatch,
  } = useOptionsTradingContext();

  const [chainRows, setChainRows] = useState<StrikeOptions[]>([]);

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

            const positions = userData?.account?.balances.reduce(
              (
                acc: {
                  call: string;
                  put: string;
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
                  acc.put = fromOpyn(balance);
                }

                if (matchesExpiry && matchesStrike && !token.isPut) {
                  acc.call = fromOpyn(balance);
                }

                return acc;
              },
              { call: "-", put: "-" }
            );

            return {
              strike: Number(fromWei(strike).toString()),
              call: {
                bid: {
                  IV: ivBidCall >= 0.1 ? ivBidCall : "-",
                  quote: quoteBidCallTotal,
                  disabled: !callAvailability.isSellable,
                },
                ask: {
                  IV: ivAskCall >= 0.1 ? ivAskCall : "-",
                  quote: quoteAskCallTotal,
                  disabled: !callAvailability.isBuyable,
                },
                delta: Number(fromWei(localDeltaCall).toString()),
                pos: positions ? positions.call : "-",
              },
              put: {
                bid: {
                  IV: ivBidPut >= 0.1 ? ivBidPut : "-",
                  quote: quoteBidPutTotal,
                  disabled: !putAvailability.isSellable,
                },
                ask: {
                  IV: ivAskPut >= 0.1 ? ivAskPut : "-",
                  quote: quoteAskPutTotal,
                  disabled: !putAvailability.isBuyable,
                },
                delta: Number(fromWei(localDeltaPut).toString()),
                pos: positions ? positions.put : "-",
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

  return (
    <table className="block bg-bone">
      <thead className="block border-t border-gray-500">
        <tr className="grid grid-cols-13 bg-bone-dark [&_th]:py-3 [&_th]:px-0">
          <th className="col-span-6">CALLS</th>
          <th className="col-span-1">
            {expiryDate && dayjs.unix(expiryDate).format("MMM DD")}
          </th>
          <th className="col-span-6">PUTS</th>
        </tr>
        <tr className="grid grid-cols-13 [&_th]:py-3">
          <th className="col-span-1">Bid IV</th>
          <th className="col-span-1">Bid</th>
          <th className="col-span-1">Ask</th>
          <th className="col-span-1">Ask IV</th>
          <th className="col-span-1">Delta</th>
          <th className="col-span-1">Pos</th>
          <th className="col-span-1 bg-bone-dark">Strike</th>
          <th className="col-span-1">Bid IV</th>
          <th className="col-span-1">Bid</th>
          <th className="col-span-1">Ask</th>
          <th className="col-span-1">Ask IV</th>
          <th className="col-span-1">Delta</th>
          <th className="col-span-1">Pos</th>
        </tr>
      </thead>
      <tbody className="block font-dm-mono text-sm">
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

                case (callITM && side === "call") || (putITM && side === "put"):
                  return "bg-green-100/25 hover:bg-green-100";

                case (callRowSelected && side === "call") ||
                  (putRowSelected && side === "put"):
                  return "bg-bone-dark/60";

                default:
                  return "hover:bg-bone-dark/50";
              }
            };

            return (
              <tr
                className="grid grid-cols-13 even:bg-bone odd:bg-bone-light even:bg-[url('./assets/wave-lines.png')] bg-right bg-no-repeat text-right [&_td]:col-span-1 [&_td]:border [&_td]:border-dashed [&_td]:border-gray-500 [&_td]:ease-in-out [&_td]:duration-100 [&_td]:cursor-default"
                key={option.strike}
              >
                <td
                  className={`!border-l-0 p-3 ${getColorClasses(
                    option,
                    "call"
                  )}`}
                >
                  <NumberFormat
                    value={option.call.bid.IV}
                    displayType={"text"}
                    decimalScale={2}
                    suffix={"%"}
                  />
                </td>
                <NumberFormat
                  value={option.call.bid.quote}
                  displayType={"text"}
                  decimalScale={2}
                  prefix={"$"}
                  renderText={(value) => {
                    const disabled =
                      option.call.bid.disabled || !option.call.bid.quote;

                    return (
                      <td
                        className={`${
                          disabled ? "text-gray-600" : "text-red-700"
                        }
                        ${getColorClasses(option, "call")}`}
                      >
                        <button
                          className={`${
                            disabled ? "cursor-not-allowed" : "cursor-pointer"
                          } p-3 w-full text-right`}
                          onClick={() =>
                            setSelectedOption({
                              callOrPut: "call",
                              bidOrAsk: "bid",
                              strikeOptions: option,
                            })
                          }
                          disabled={disabled}
                        >
                          {value}
                        </button>
                      </td>
                    );
                  }}
                />
                <NumberFormat
                  value={option.call.ask.quote}
                  displayType={"text"}
                  decimalScale={2}
                  prefix={"$"}
                  renderText={(value) => {
                    const disabled =
                      option.call.ask.disabled || !option.call.ask.quote;

                    return (
                      <td
                        className={`${
                          disabled ? "text-gray-600" : "text-green-700"
                        }
                        ${getColorClasses(option, "call")}`}
                      >
                        <button
                          className={`${
                            disabled ? "cursor-not-allowed" : "cursor-pointer"
                          } p-3 w-full text-right`}
                          onClick={() =>
                            setSelectedOption({
                              callOrPut: "call",
                              bidOrAsk: "ask",
                              strikeOptions: option,
                            })
                          }
                          disabled={disabled}
                        >
                          {value}
                        </button>
                      </td>
                    );
                  }}
                />
                <td className={`p-3 ${getColorClasses(option, "call")}`}>
                  <NumberFormat
                    value={option.call.ask.IV}
                    displayType={"text"}
                    decimalScale={2}
                    suffix={"%"}
                  />
                </td>
                <td className={`p-3 ${getColorClasses(option, "call")}`}>
                  <NumberFormat
                    value={option.call.delta}
                    displayType={"text"}
                    decimalScale={2}
                  />
                </td>
                <td
                  className={`!border-r-0 p-3 ${getColorClasses(
                    option,
                    "call"
                  )}`}
                >
                  <NumberFormat
                    value={option.call.pos}
                    displayType={"text"}
                    decimalScale={1}
                  />
                </td>
                <td className="text-center bg-bone-dark !border-0 font-medium p-3">
                  <NumberFormat
                    value={option.strike}
                    displayType={"text"}
                    decimalScale={0}
                  />
                </td>
                <td
                  className={`!border-l-0 p-3 ${getColorClasses(
                    option,
                    "put"
                  )}`}
                >
                  <NumberFormat
                    value={option.put.bid.IV}
                    displayType={"text"}
                    decimalScale={2}
                    suffix={"%"}
                  />
                </td>
                <NumberFormat
                  value={option.put.bid.quote}
                  displayType={"text"}
                  decimalScale={2}
                  prefix={"$"}
                  renderText={(value) => {
                    const disabled =
                      option.put.bid.disabled || !option.put.bid.quote;

                    return (
                      <td
                        className={`${
                          disabled ? "text-gray-600" : "text-red-700"
                        }
                        ${getColorClasses(option, "put")}`}
                      >
                        <button
                          className={`${
                            disabled ? "cursor-not-allowed" : "cursor-pointer"
                          } p-3 w-full text-right`}
                          onClick={() =>
                            setSelectedOption({
                              callOrPut: "put",
                              bidOrAsk: "bid",
                              strikeOptions: option,
                            })
                          }
                          disabled={disabled}
                        >
                          {value}
                        </button>
                      </td>
                    );
                  }}
                />
                <NumberFormat
                  value={option.put.ask.quote}
                  displayType={"text"}
                  decimalScale={2}
                  prefix={"$"}
                  renderText={(value) => {
                    const disabled =
                      option.put.ask.disabled || !option.put.ask.quote;

                    return (
                      <td
                        className={`${
                          disabled ? "text-gray-600" : "text-green-700"
                        }
                      ${getColorClasses(option, "put")}`}
                      >
                        <button
                          className={`${
                            disabled ? "cursor-not-allowed" : "cursor-pointer"
                          } p-3 w-full text-right`}
                          onClick={() =>
                            setSelectedOption({
                              callOrPut: "put",
                              bidOrAsk: "ask",
                              strikeOptions: option,
                            })
                          }
                          disabled={disabled}
                        >
                          {value}
                        </button>
                      </td>
                    );
                  }}
                />
                <td className={`p-3 ${getColorClasses(option, "put")}`}>
                  <NumberFormat
                    value={option.put.ask.IV}
                    displayType={"text"}
                    decimalScale={2}
                    suffix={"%"}
                  />
                </td>
                <td className={`p-3 ${getColorClasses(option, "put")}`}>
                  <NumberFormat
                    value={option.put.delta}
                    displayType={"text"}
                    decimalScale={2}
                  />
                </td>
                <td
                  className={`!border-r-0 p-3 ${getColorClasses(
                    option,
                    "put"
                  )}`}
                >
                  <NumberFormat
                    value={option.put.pos}
                    displayType={"text"}
                    decimalScale={1}
                  />
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
};
