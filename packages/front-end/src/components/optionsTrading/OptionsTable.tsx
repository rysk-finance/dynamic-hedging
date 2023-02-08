import type {
  OptionSeries,
  SelectedOption,
  StrikeOptions,
} from "../../state/types";

import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { BigNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import NumberFormat from "react-number-format";
import { useContract, useNetwork, useProvider } from "wagmi";

import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import { OptionCatalogueABI } from "src/abis/OptionCatalogue_ABI";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import { fromWei, tFormatUSDC, toWei } from "../../utils/conversion-helper";
import {
  calculateOptionDeltaLocally,
  getContractAddress,
  returnIVFromQuote,
} from "../../utils/helpers";

export const OptionsTable = () => {
  const { chain } = useNetwork();
  const provider = useProvider();

  const {
    state: { ethPrice },
  } = useGlobalContext();

  const {
    state: { optionType, customOptionStrikes, expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  const [chainRows, setChainRows] = useState<StrikeOptions[]>([]);

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
      chain &&
      expiryDate &&
      optionCatalogue &&
      portfolioValuesFeed &&
      beyondPricer
    ) {
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

            return {
              strike: Number(fromWei(strike).toString()),
              call: {
                bid: {
                  IV: ivBidCall >= 0.1 ? ivBidCall : "-",
                  quote: quoteBidCallTotal,
                  disabled: !callAvailability.isBuyable,
                },
                ask: {
                  IV: ivAskCall >= 0.1 ? ivAskCall : "-",
                  quote: quoteAskCallTotal,
                  disabled: !callAvailability.isSellable,
                },
                delta: Number(fromWei(localDeltaCall).toString()),
              },
              put: {
                bid: {
                  IV: ivBidPut >= 0.1 ? ivBidPut : "-",
                  quote: quoteBidPutTotal,
                  disabled: !putAvailability.isBuyable,
                },
                ask: {
                  IV: ivAskPut >= 0.1 ? ivAskPut : "-",
                  quote: quoteAskPutTotal,
                  disabled: !putAvailability.isSellable,
                },
                delta: Number(fromWei(localDeltaPut).toString()),
              },
            };
          })
        );

        setChainRows(optionsChainRows);
      };

      fetchPrices().catch((error) => {
        captureException(error);
        console.error(error);
      });
    }
  }, [
    chain,
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
    <table className="w-full bg-white border-b-2 border-black">
      <thead className="text-left border-b-2 border-black">
        <tr className="text-center bg-gray-500 border-b-2 border-black">
          <th colSpan={5} className={"py-2"}>
            CALLS
          </th>
          <th colSpan={1}>
            {expiryDate && dayjs.unix(expiryDate).format("MMM DD")}
          </th>
          <th colSpan={5}>PUTS</th>
        </tr>
        <tr className="text-center">
          <th className="py-2">Bid IV</th>
          <th className="">Bid</th>
          <th className="">Ask</th>
          <th>Ask IV</th>
          <th>Delta</th>
          <th className="bg-bone-dark border-x border-black">Strike</th>
          <th>Bid IV</th>
          <th className="">Bid</th>
          <th className="">Ask</th>
          <th>Ask IV</th>
          <th>Delta</th>
        </tr>
      </thead>
      <tbody>
        {Boolean(chainRows.length) &&
          chainRows.map((option) => (
            <tr className="text-right h-12 odd:bg-gray-300" key={option.strike}>
              <td className="pr-4">
                <NumberFormat
                  value={option.call.bid.IV}
                  displayType={"text"}
                  decimalScale={2}
                  suffix={"%"}
                />
              </td>
              <td className="pr-4 text-red-700">
                <NumberFormat
                  value={option.call.bid.quote}
                  displayType={"text"}
                  decimalScale={2}
                  prefix={"$"}
                />
              </td>
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
                      className={`pr-4 ${
                        disabled ? "text-gray-600" : "text-green-700"
                      }`}
                    >
                      <button
                        className={
                          disabled ? "cursor-not-allowed" : "cursor-pointer"
                        }
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
              <td className="pr-4">
                <NumberFormat
                  value={option.call.ask.IV}
                  displayType={"text"}
                  decimalScale={2}
                  suffix={"%"}
                />
              </td>
              <td className="pr-4">
                <NumberFormat
                  value={option.call.delta}
                  displayType={"text"}
                  decimalScale={2}
                />
              </td>
              <td className="w-20 text-center bg-bone-dark border-x border-black">
                <NumberFormat
                  value={option.strike}
                  displayType={"text"}
                  decimalScale={0}
                />
              </td>
              <td className="pr-4">
                <NumberFormat
                  value={option.put.bid.IV}
                  displayType={"text"}
                  decimalScale={2}
                  suffix={"%"}
                />
              </td>
              <td className="pr-4 text-red-700">
                <NumberFormat
                  value={option.put.bid.quote}
                  displayType={"text"}
                  decimalScale={2}
                  prefix={"$"}
                />
              </td>
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
                      className={`pr-4 ${
                        disabled ? "text-gray-600" : "text-green-700"
                      }`}
                    >
                      <button
                        className={
                          disabled ? "cursor-not-allowed" : "cursor-pointer"
                        }
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
              <td className="pr-4">
                <NumberFormat
                  value={option.put.ask.IV}
                  displayType={"text"}
                  decimalScale={2}
                  suffix={"%"}
                />
              </td>
              <td className="pr-4">
                <NumberFormat
                  value={option.put.delta}
                  displayType={"text"}
                  decimalScale={2}
                />
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
};
