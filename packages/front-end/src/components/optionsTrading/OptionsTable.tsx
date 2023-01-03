import { useEffect, useState } from "react";
import NumberFormat from "react-number-format";
import { useNetwork } from "wagmi";

import PVFABI from "../../abis/AlphaPortfolioValuesFeed.json";
import ERC20ABI from "../../abis/erc20.json";
import LPABI from "../../abis/LiquidityPool.json";
import ORABI from "../../abis/OptionRegistry.json";
import PFABI from "../../abis/PriceFeed.json";
import addresses from "../../contracts.json";
import { useContract } from "../../hooks/useContract";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import {
  Option,
  OptionsTradingActionType,
  OptionType
} from "../../state/types";
import { ContractAddresses, ETHNetwork } from "../../types";
import { ERC20 } from "../../types/ERC20";
import { LiquidityPool } from "../../types/LiquidityPool";
import { OptionRegistry } from "../../types/OptionRegistry";
import { PortfolioValuesFeed } from "../types/PortfolioValuesFeed"
import { PriceFeed } from "../../types/PriceFeed";
import { fromWei, toWei } from "../../utils/conversion-helper";
import {
  calculateOptionDeltaLocally,
  returnIVFromQuote
} from "../../utils/helpers";

const isNotTwoDigitsZero = (price: number) => {
  // TODO: Not sure this makes sense, come back to it after figuring out pricing
  return price.toFixed(2) != "0.00";
};

const suggestedCallOptionPriceDiff = [-100, 0, 100, 200, 300, 400, 600, 800];
const suggestedPutOptionPriceDiff = [
  -800, -600, -400, -300, -200, -100, 0, 100,
];

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

  const [suggestions, setSuggestions] = useState<Option[] | null>(null);

  const [liquidityPool] = useContract<any>({
    contract: "liquidityPool",
    ABI: LPABI,
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

  useEffect(() => {
    if (cachedEthPrice && chain && liquidityPool) {
      const diffs =
        optionType === OptionType.CALL
          ? suggestedCallOptionPriceDiff
          : suggestedPutOptionPriceDiff;

      const strikes = [
        ...diffs.map<number>((diff) =>
          Number((cachedEthPrice + diff).toFixed(0))
        ),
        ...customOptionStrikes,
      ].sort((a, b) => a - b);

      const fetchPrices = async () => {
        const typedAddresses = addresses as Record<
          ETHNetwork,
          ContractAddresses
        >;
        const network = chain.network as ETHNetwork;
        const suggestions = await Promise.all(
          strikes.map(async (strike) => {
            const optionSeries = {
              // TODO make sure this UTC set is done in the right place
              expiration: Number(expiryDate?.setUTCHours(8, 0, 0)) / 1000,
              strike: toWei(strike.toString()),
              isPut: optionType !== OptionType.CALL,
              strikeAsset: typedAddresses[network].USDC,
              underlying: typedAddresses[network].WETH,
              collateral: typedAddresses[network].USDC,
            };

            const localQuote = await calculateOptionQuoteLocally(
              liquidityPool as LiquidityPool,
              optionRegistry as OptionRegistry,
              portfolioValuesFeed as PortfolioValuesFeed,
              usdc as ERC20,
              priceFeed as PriceFeed,
              optionSeries,
              toWei((1).toString()),
              true
            );

            const localDelta = await calculateOptionDeltaLocally(
              liquidityPool as LiquidityPool,
              priceFeed as PriceFeed,
              optionSeries,
              toWei((1).toString()),
              false
            );

            const iv = await returnIVFromQuote(
              localQuote,
              priceFeed as PriceFeed,
              optionSeries
            );

            return {
              strike: strike,
              IV: iv * 100,
              delta: Number(fromWei(localDelta).toString()),
              price: localQuote,
              type: optionType,
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

  const setSelectedOption = (option: Option) => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  return (
    <table className="w-full bg-white border-b-2 border-black">
      <thead className="text-left border-b-2 border-black">
        <tr className="text-center bg-gray-500 border-b-2 border-black">
          <th colSpan={5} className={"py-2"}>
            CALLS
          </th>
          <th colSpan={1}>Dec 30</th>
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
            } cursor-pointer`}
            onClick={() => setSelectedOption(option)}
            key={option.strike}
          >
            <td className="pr-4">
              <NumberFormat
                value={isNotTwoDigitsZero(option.IV) ? option.IV : "-"}
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4 text-red-700">
              <NumberFormat
                value={isNotTwoDigitsZero(option.price) ? option.price : ""}
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4 text-green-700">
              <NumberFormat
                value={isNotTwoDigitsZero(option.price) ? option.price : ""}
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={isNotTwoDigitsZero(option.IV) ? option.IV : "-"}
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={option.delta}
                displayType={"text"}
                decimalScale={2}
              />
            </td>
            <td className="w-20 text-center bg-bone-dark border-x border-black">
              {option.strike}
            </td>
            {/** TODO numbers below are same as calls here */}
            <td className="pr-4">
              <NumberFormat
                value={isNotTwoDigitsZero(option.IV) ? option.IV : "-"}
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4 text-red-700">
              <NumberFormat
                value={isNotTwoDigitsZero(option.price) ? option.price : ""}
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4 text-green-700">
              <NumberFormat
                value={isNotTwoDigitsZero(option.price) ? option.price : ""}
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={isNotTwoDigitsZero(option.IV) ? option.IV : "-"}
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={option.delta}
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
