import dayjs from "dayjs";
import { BigNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import NumberFormat from "react-number-format";
import { captureException } from "@sentry/react";
import { useContract, useNetwork, useProvider } from "wagmi";

import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { OptionCatalogueABI } from "src/abis/OptionCatalogue_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import addresses from "../../contracts.json";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType, SelectedOption } from "../../state/types";
import { ContractAddresses, ETHNetwork } from "../../types";
import { fromWei, tFormatUSDC, toWei } from "../../utils/conversion-helper";
import {
  getContractAddress,
  calculateOptionDeltaLocally,
  returnIVFromQuote,
} from "../../utils/helpers";

interface OptionSeries {
  expiration: BigNumber;
  strike: BigNumber;
  strikeAsset: HexString;
  underlying: HexString;
  collateral: HexString;
  isPut: boolean;
}

interface ChainRow {
  strike: number;
  call: {
    bid: {
      IV: number;
      quote: number;
    };
    ask: {
      IV: number;
      quote: number;
    };
    delta: number;
  };
  put: {
    bid: {
      IV: number;
      quote: number;
    };
    ask: {
      IV: number;
      quote: number;
    };
    delta: number;
  };
}

const isNotTwoDigitsZero = (price: number) => {
  // TODO: Not sure this makes sense, come back to it after figuring out pricing
  return price.toFixed(2) != "0.00";
};

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

  const [chainRows, setChainRows] = useState<ChainRow[]>([]);

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
      const typedAddresses = addresses as Record<ETHNetwork, ContractAddresses>;
      const network = chain.network as ETHNetwork;

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
              strikeAsset: typedAddresses[network].USDC as HexString,
              underlying: typedAddresses[network].WETH as HexString,
              collateral: typedAddresses[network].USDC as HexString,
              isPut: false,
            };

            const optionSeriesPut: OptionSeries = {
              ...optionSeriesCall,
              isPut: true,
            };

            const _buildRow = async (
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

              return quoteTotal;
            };

            const quoteAskCallTotal = await _buildRow(
              optionSeriesCall,
              callExposure
            );
            const quoteAskPutTotal = await _buildRow(
              optionSeriesPut,
              putExposure
            );
            const quoteBidCallTotal = await _buildRow(
              optionSeriesCall,
              callExposure,
              true
            );
            const quoteBidPutTotal = await _buildRow(
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
                  IV: ivBidCall,
                  quote: callAvailability.isBuyable ? quoteBidCallTotal : 0,
                },
                ask: {
                  IV: ivAskCall,
                  quote: callAvailability.isSellable ? quoteAskCallTotal : 0,
                },
                delta: Number(fromWei(localDeltaCall).toString()),
              },
              put: {
                bid: {
                  IV: ivBidPut,
                  quote: putAvailability.isBuyable ? quoteBidPutTotal : 0,
                },
                ask: {
                  IV: ivAskPut,
                  quote: putAvailability.isSellable ? quoteAskPutTotal : 0,
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
          chainRows.map((option, index) => (
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
