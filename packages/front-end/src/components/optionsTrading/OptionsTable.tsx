import { useEffect, useState } from "react";
import NumberFormat from "react-number-format";
import { useNetwork } from "wagmi";
import { BigNumber } from "ethers";

import PVFABI from "../../abis/AlphaPortfolioValuesFeed.json";
import ERC20ABI from "../../abis/erc20.json";
import LPABI from "../../abis/LiquidityPool.json";
import ORABI from "../../abis/OptionRegistry.json";
import PFABI from "../../abis/PriceFeed.json";
import OCABI from "../../abis/OptionCatalogue.json";
import BPABI from "../../abis/BeyondPricer.json";
import addresses from "../../contracts.json";
import { useContract } from "../../hooks/useContract";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { SelectedOption, OptionsTradingActionType } from "../../state/types";
import { ContractAddresses, ETHNetwork } from "../../types";
import { LiquidityPool } from "../../types/LiquidityPool";
import { PriceFeed } from "../../types/PriceFeed";
import { fromWei, tFormatUSDC, toWei } from "../../utils/conversion-helper";
import {
  calculateOptionDeltaLocally,
  returnIVFromQuote,
} from "../../utils/helpers";
import { formatShortDate } from "../../utils/formatShortDate";

const isNotTwoDigitsZero = (price: number) => {
  // TODO: Not sure this makes sense, come back to it after figuring out pricing
  return price.toFixed(2) != "0.00";
};

export const OptionsTable = () => {
  const { chain } = useNetwork();

  const {
    state: { ethPrice },
  } = useGlobalContext();

  const [cachedEthPrice, setCachedEthPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!cachedEthPrice && ethPrice) {
      setCachedEthPrice(Number((ethPrice / 100).toFixed(0)) * 100);
    }
  }, [ethPrice, cachedEthPrice]);

  const {
    state: { optionType, customOptionStrikes, expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  // TODO: put down the actual type
  const [suggestions, setSuggestions] = useState<Array<any> | null>(null);

  const [liquidityPool] = useContract<any>({
    contract: "liquidityPool",
    ABI: LPABI,
  });

  const [beyondPricer] = useContract<any>({
    contract: "beyondPricer",
    ABI: BPABI,
  });

  const [optionRegistry] = useContract({
    contract: "OpynOptionRegistry",
    ABI: ORABI,
  });

  const [priceFeed] = useContract({
    contract: "priceFeed",
    ABI: PFABI,
  });

  const [portfolioValuesFeed] = useContract({
    contract: "portfolioValuesFeed",
    ABI: PVFABI,
  });

  const [usdc] = useContract({
    contract: "USDC",
    ABI: ERC20ABI,
  });

  const [optionCatalogue] = useContract({
    contract: "optionCatalogue",
    ABI: OCABI,
  });

  useEffect(() => {
    if (cachedEthPrice && chain && liquidityPool && expiryDate) {
      const fetchPrices = async () => {
        const unixDateWithoutMilliseconds = parseInt(
          (expiryDate.getTime() / 1000).toFixed(0)
        );

        const expiryDateCallStrikes = await optionCatalogue?.getOptionDetails(
          unixDateWithoutMilliseconds,
          false
        );
        const expiryDatePutStrikes = await optionCatalogue?.getOptionDetails(
          unixDateWithoutMilliseconds,
          false
        );

        const strikes: Set<string> = new Set();

        [...expiryDateCallStrikes, ...expiryDatePutStrikes].forEach((strike) =>
          strikes.add(strike.toString())
        );

        const typedAddresses = addresses as Record<
          ETHNetwork,
          ContractAddresses
        >;
        const network = chain.network as ETHNetwork;
        const suggestions = await Promise.all(
          Array.from(strikes).map(async (strike) => {
            const optionSeriesCall = {
              expiration: unixDateWithoutMilliseconds,
              strike: BigNumber.from(strike),
              strikeAsset: typedAddresses[network].USDC,
              underlying: typedAddresses[network].WETH,
              collateral: typedAddresses[network].USDC,
              isPut: false,
            };

            const optionSeriesPut = {
              ...optionSeriesCall,
              isPut: true,
            };

            const quoteAskCall = await beyondPricer?.quoteOptionPrice(
              optionSeriesCall,
              "1000000000000000000", // 1 for the table view but fetch if user wants to buy more
              false,
              0
            );
            const quoteAskPut = await beyondPricer?.quoteOptionPrice(
              optionSeriesPut,
              "1000000000000000000", // 1 for the table view but fetch if user wants to buy more
              false,
              0 // NOTE: not sure where to get this from
            );

            const quoteAskCallTotal = tFormatUSDC(
              quoteAskCall[0].add(quoteAskCall[2])
            );
            const quoteAskPutTotal = tFormatUSDC(
              quoteAskPut[0].add(quoteAskPut[2])
            );

            const quoteBidCall = await beyondPricer?.quoteOptionPrice(
              optionSeriesCall,
              "1000000000000000000", // 1 for the table view but fetch if user wants to sell more
              true,
              0
            );
            const quoteBidPut = await beyondPricer?.quoteOptionPrice(
              optionSeriesPut,
              "1000000000000000000", // 1 for the table view but fetch if user wants to sell more
              true,
              0
            );

            const quoteBidCallTotal = tFormatUSDC(
              quoteBidCall[0].add(quoteBidCall[2])
            );
            const quoteBidPutTotal = tFormatUSDC(
              quoteBidPut[0].add(quoteBidPut[2])
            );

            const localDeltaCall = await calculateOptionDeltaLocally(
              liquidityPool as LiquidityPool,
              priceFeed as PriceFeed,
              optionSeriesCall,
              toWei((1).toString()),
              false
            );

            const localDeltaPut = await calculateOptionDeltaLocally(
              liquidityPool as LiquidityPool,
              priceFeed as PriceFeed,
              optionSeriesPut,
              toWei((1).toString()),
              false // TODO: Figure out if we need 1 more column for shorting true
            );

            // QUESTION: Calculated on total including fees?
            const ivAskCall = await returnIVFromQuote(
              quoteAskCallTotal,
              priceFeed as PriceFeed,
              optionSeriesCall
            );
            const ivBidCall = await returnIVFromQuote(
              quoteBidCallTotal,
              priceFeed as PriceFeed,
              optionSeriesCall
            );

            const ivAskPut = await returnIVFromQuote(
              quoteAskPutTotal,
              priceFeed as PriceFeed,
              optionSeriesPut
            );
            const ivBidPut = await returnIVFromQuote(
              quoteBidPutTotal,
              priceFeed as PriceFeed,
              optionSeriesPut
            );
            // TODO check which ones are buyable and sellable and gray out not available options
            return {
              strike: Number(fromWei(strike).toString()),
              call: {
                bid: {
                  IV: ivBidCall,
                  quote: quoteBidCallTotal,
                },
                ask: {
                  IV: ivAskCall,
                  quote: quoteAskCallTotal,
                },
                delta: Number(fromWei(localDeltaCall).toString()),
              },
              put: {
                bid: {
                  IV: ivBidPut,
                  quote: quoteBidPutTotal,
                },
                ask: {
                  IV: ivAskPut,
                  quote: quoteAskPutTotal,
                },
                delta: Number(fromWei(localDeltaPut).toString()),
              },
            };
          })
        );
        setSuggestions(suggestions);
      };

      fetchPrices().catch(console.error);
    }
  }, [
    chain,
    cachedEthPrice,
    optionType,
    customOptionStrikes,
    expiryDate,
    liquidityPool,
    priceFeed,
    portfolioValuesFeed,
    optionRegistry,
    usdc,
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
          <th colSpan={1}>{expiryDate && formatShortDate(expiryDate)}</th>
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
        {suggestions?.map((option, index) => (
          <tr
            className={`text-right h-12 ${
              index % 2 === 0 ? "bg-gray-300" : ""
            }`}
            key={option.strike}
          >
            <td className="pr-4">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.call.bid.IV)
                    ? option.call.bid.IV
                    : "-"
                }
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4 text-red-700">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.call.bid.quote)
                    ? option.call.bid.quote
                    : ""
                }
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td
              className="pr-4 text-green-700 cursor-pointer"
              onClick={() =>
                setSelectedOption({
                  callOrPut: "call",
                  bidOrAsk: "ask",
                  strikeOptions: option,
                })
              }
            >
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.call.ask.quote)
                    ? option.call.ask.quote
                    : ""
                }
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.call.ask.IV)
                    ? option.call.ask.IV
                    : "-"
                }
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
              {}
              <NumberFormat
                value={option.strike}
                displayType={"text"}
                decimalScale={0}
              />
            </td>
            {/** TODO numbers below are same as calls here */}
            <td className="pr-4">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.put.bid.IV)
                    ? option.put.bid.IV
                    : "-"
                }
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4 text-red-700">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.put.bid.quote)
                    ? option.put.bid.quote
                    : ""
                }
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td
              className="pr-4 text-green-700 cursor-pointer"
              onClick={() =>
                setSelectedOption({
                  callOrPut: "put",
                  bidOrAsk: "ask",
                  strikeOptions: option,
                })
              }
            >
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.put.ask.quote)
                    ? option.put.ask.quote
                    : ""
                }
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.put.ask.IV)
                    ? option.put.ask.IV
                    : "-"
                }
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
