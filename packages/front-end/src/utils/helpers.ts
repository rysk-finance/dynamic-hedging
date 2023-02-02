import { BigNumber } from "ethers";
import {
  toWei,
  genOptionTimeFromUnix,
  fromWei,
  tFormatEth,
} from "./conversion-helper";
import { LiquidityPool } from "../types/LiquidityPool";
import { ERC20 } from "../types/ERC20";
import { OptionRegistry } from "../types/OptionRegistry";
import { PriceFeed } from "../types/PriceFeed";

import bs from "black-scholes";
import greeks from "greeks";
import impliedVol from "implied-volatility";

const rfr = "0.03";

export async function calculateOptionDeltaLocally(
  liquidityPool: LiquidityPool,
  priceFeed: PriceFeed,
  optionSeries: {
    expiration: number;
    isPut: boolean;
    strike: BigNumber;
    strikeAsset: string;
    underlying: string;
    collateral: string;
  },
  amount: BigNumber,
  isShort: boolean
) {
  const priceQuote = await priceFeed.getNormalizedRate(
    optionSeries.underlying,
    optionSeries.strikeAsset
  );

  // const blockNum = await ethers.provider.getBlockNumber()
  // const block = await ethers.provider.getBlock(blockNum)
  // const { timestamp } = block

  const timestamp = Math.round(+new Date() / 1000);
  const time = genOptionTimeFromUnix(timestamp, optionSeries.expiration);
  const vol = await liquidityPool.getImpliedVolatility(
    optionSeries.isPut,
    priceQuote,
    optionSeries.strike,
    optionSeries.expiration
  );
  const opType = optionSeries.isPut ? "put" : "call";
  let localDelta = greeks.getDelta(
    fromWei(priceQuote),
    fromWei(optionSeries.strike),
    time,
    fromWei(vol),
    rfr,
    opType
  );
  localDelta = isShort ? -localDelta : localDelta;
  // TODO make sure this rounding is appropriate
  return toWei(parseFloat(localDelta.toString()).toFixed(5)).mul(
    amount.div(toWei("1"))
  );
}

export async function getBlackScholesQuote(
  liquidityPool: LiquidityPool,
  optionRegistry: OptionRegistry,
  collateralAsset: ERC20,
  priceFeed: PriceFeed,
  optionSeries: {
    expiration: number;
    strike: BigNumber;
    isPut: boolean;
    strikeAsset: string;
    underlying: string;
    collateral: string;
  },
  amount: BigNumber,
  toBuy: boolean
) {
  const underlyingPrice = await priceFeed.getNormalizedRate(
    optionSeries.underlying,
    optionSeries.strikeAsset
  );
  const iv = await liquidityPool.getImpliedVolatility(
    optionSeries.isPut,
    underlyingPrice,
    optionSeries.strike,
    optionSeries.expiration
  );
  // const blockNum = await ethers.provider.getBlockNumber()
  // const block = await ethers.provider.getBlock(blockNum)
  // const { timestamp } = block

  const timestamp = Math.round(+new Date() / 1000);
  const timeToExpiration = genOptionTimeFromUnix(
    Number(timestamp),
    optionSeries.expiration
  );

  const priceNorm = fromWei(underlyingPrice);
  const bidAskSpread = tFormatEth(await liquidityPool.bidAskIVSpread());

  return (
    bs.blackScholes(
      priceNorm,
      fromWei(optionSeries.strike),
      timeToExpiration,
      toBuy ? Number(fromWei(iv)) * (1 - Number(bidAskSpread)) : fromWei(iv),
      parseFloat(rfr),
      optionSeries.isPut ? "put" : "call"
    ) * parseFloat(fromWei(amount))
  );
}

export async function returnIVFromQuote(
  quote: number,
  priceFeed: PriceFeed,
  optionSeries: {
    expiration: number;
    strike: BigNumber;
    isPut: boolean;
    strikeAsset: string;
    underlying: string;
    collateral: string;
  }
) {
  const underlyingPrice = await priceFeed.getNormalizedRate(
    optionSeries.underlying,
    optionSeries.strikeAsset
  );

  const priceNorm = fromWei(underlyingPrice);

  const timestamp = Math.round(+new Date() / 1000);
  const timeToExpiration = genOptionTimeFromUnix(
    Number(timestamp),
    optionSeries.expiration
  );

  const type = optionSeries.isPut ? "put" : "call";

  return impliedVol.getImpliedVolatility(
    quote,
    priceNorm,
    fromWei(optionSeries.strike),
    timeToExpiration,
    rfr,
    type
  );
}
