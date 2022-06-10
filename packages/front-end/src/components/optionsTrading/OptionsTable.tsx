import React, { useEffect, useState } from "react";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import {
  Option,
  OptionsTradingActionType,
  OptionType,
} from "../../state/types";
import LPABI from "../../abis/LiquidityPool.json";
import ORABI from "../../abis/OptionRegistry.json";
import ERC20ABI from "../../abis/erc20.json";
import PFABI from "../../abis/PriceFeed.json";
import { calculateOptionQuoteLocally, calculateOptionDeltaLocally, returnIVFromQuote } from "../../utils/helpers"
import { USDC_ADDRESS, OPYN_OPTION_REGISTRY, LIQUIDITY_POOL, PRICE_FEED, WETH_ADDRESS  } from "../../config/constants";
import { useContract } from "../../hooks/useContract";
import { BigNumber, ethers } from "ethers";
import { LiquidityPool } from "../../types/LiquidityPool"
import { OptionRegistry } from "../../types/OptionRegistry";
import { ERC20 } from "../../types/ERC20";
import { PriceFeed } from "../../types/PriceFeed";
import { toWei, fromWei } from "../../utils/conversion-helper";
import NumberFormat from 'react-number-format';

const suggestedCallOptionPriceDiff = [-100, 0, 100, 200, 300, 400, 600, 800];
const suggestedPutOptionPriceDiff = [-800, -600, -400, -300, -200, -100, 0, 100];

// TODO add dynamic
const networkId = 421611
const provider = new ethers.providers.InfuraProvider(networkId, process.env.REACT_APP_INFURA_KEY);

const liquidityPool = new ethers.Contract(LIQUIDITY_POOL[networkId], LPABI, provider) as LiquidityPool
const optionRegistry = new ethers.Contract(OPYN_OPTION_REGISTRY[networkId], ORABI, provider) as OptionRegistry
const priceFeed = new ethers.Contract(PRICE_FEED[networkId], PFABI, provider ) as PriceFeed
const usdc = new ethers.Contract(USDC_ADDRESS[networkId], ERC20ABI, provider) as ERC20

export const OptionsTable: React.FC = () => {
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

  useEffect(() => {
    if (cachedEthPrice) {
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
        // const data = await fetch('https://yourapi.com');

        const suggestions = await Promise.all(strikes.map(async strike => {

          const optionSeries = {
              expiration: Number(expiryDate?.getTime()) / 1000,
              strike: toWei((strike).toString()),
              isPut: optionType !== OptionType.CALL,
              strikeAsset: USDC_ADDRESS[networkId],
              underlying: WETH_ADDRESS[networkId],
              collateral: USDC_ADDRESS[networkId]
            }

          console.log( optionSeries )

          const localQuote = await calculateOptionQuoteLocally(
            liquidityPool,
            optionRegistry,
            usdc,
            priceFeed,
            optionSeries,
            toWei((1).toString()),
            true
          )

          const localDelta = await calculateOptionDeltaLocally(
            liquidityPool,
            priceFeed,
            optionSeries,
            toWei((1).toString()),
            false
          )

          const iv = await returnIVFromQuote(localQuote, priceFeed, optionSeries)

          console.log(iv)

          return {
            strike: strike,
            IV: iv * 100,
            delta: Number(fromWei(localDelta).toString()),
            price: localQuote,
            type: optionType,
          };
        }));

        setSuggestions(suggestions);

      }

      fetchPrices()
      .catch(console.error);

    }
  }, [cachedEthPrice, optionType, customOptionStrikes, expiryDate]);

  const setSelectedOption = (option: Option) => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  return (
    <table className="w-full bg-white">
      <thead className="text-left border-b-2 border-black">
        <tr>
          <th className="pl-4 py-2">Strike ($)</th>
          <th>IV</th>
          <th>Delta</th>
          <th className="pr-4">Price ($)</th>
        </tr>
      </thead>
      <tbody>
        {suggestions?.map((option, index) => (
          <tr
            className={`h-12 ${
              index % 2 === 0 ? "bg-gray-300" : ""
            } cursor-pointer`}
            onClick={() => setSelectedOption(option)}
            key={option.strike}
          >
            <td className="pl-4">{option.strike}</td>
            <td>
              <NumberFormat value={option.IV} displayType={"text"} decimalScale={2} suffix={'%'} />
            </td>
            <td>
              <NumberFormat value={option.delta} displayType={"text"} decimalScale={2} />
            </td>
            <td className="pr-4">
              <NumberFormat value={option.price} displayType={"text"} decimalScale={2} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
