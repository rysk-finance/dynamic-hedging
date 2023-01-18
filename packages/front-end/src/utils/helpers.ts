import { BigNumber, ethers, utils } from "ethers";
import {
  toWei,
  genOptionTimeFromUnix,
  fromWei,
  tFormatUSDC,
  tFormatEth,
} from "./conversion-helper";
import { LiquidityPool } from "../types/LiquidityPool";
import { ERC20 } from "../types/ERC20";
import { OptionRegistry } from "../types/OptionRegistry";
import { PriceFeed } from "../types/PriceFeed";
import { PortfolioValuesFeed } from "../types/PortfolioValuesFeed";

import bs from "black-scholes";
import greeks from "greeks";
import impliedVol from "implied-volatility";
import { truncateDecimalString } from "../utils";

const rfr = "0.03";
const belowUtilizationThresholdGradient = 0.1;
const aboveUtilizationThresholdGradient = 1.5;
const utilizationFunctionThreshold = 0.6;
const yIntercept = -0.84;

export async function calculateOptionQuoteLocally(
  liquidityPool: LiquidityPool,
  optionRegistry: OptionRegistry,
  portfolioValuesFeed: PortfolioValuesFeed,
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
  // const blockNum = await ethers.provider.getBlockNumber()
  // const block = await ethers.provider.getBlock(blockNum)
  // const { timestamp } = block

  const timestamp = Math.round(+new Date() / 1000);
  const timeToExpiration = genOptionTimeFromUnix(
    Number(timestamp),
    optionSeries.expiration
  );

  console.log("timeToExpiration in d:", timeToExpiration * 365);

  const underlyingPrice = await priceFeed.getNormalizedRate(
    optionSeries.underlying,
    optionSeries.strikeAsset
  );

  const priceNorm = fromWei(underlyingPrice);
  const iv = await liquidityPool.getImpliedVolatility(
    optionSeries.isPut,
    underlyingPrice,
    optionSeries.strike,
    optionSeries.expiration
  );
  const maxDiscount = ethers.utils.parseUnits("1", 17); // 10%

  // TODO update once new LP is deployed
  const getAltNAV = (await liquidityPool.getAssets())
    .sub(await liquidityPool.ephemeralLiabilities())
    .sub(
      (
        await portfolioValuesFeed.getPortfolioValues(
          optionSeries.underlying,
          optionSeries.strikeAsset
        )
      ).callPutsValue
    );

  const NAV = await liquidityPool
    .getNAV()
    .catch((e) => {
      console.log(e);
      // TODO update once LP is deployed
      // getAssets() - effephemeralLiabalities - portfolioValueFeed.getPortfolioVaules.callPutsValue
      return getAltNAV;
    })
    .then((res) => {
      return res;
    });

  // try {
  // 	let NAV = await liquidityPool.getNAV()
  // } catch(e) {
  // 	console.error(e);
  // } finally {
  // 	let NAV = 100
  // }

  console.log("NAV IS:", NAV);
  const collateralAllocated = await liquidityPool.collateralAllocated();
  const lpUSDBalance = await collateralAsset.balanceOf(liquidityPool.address);
  const portfolioDeltaBefore = await liquidityPool.getPortfolioDelta();
  const optionDelta = await calculateOptionDeltaLocally(
    liquidityPool,
    priceFeed,
    optionSeries,
    amount,
    !toBuy
  );
  // optionDelta will already be inverted if we are selling it
  const portfolioDeltaAfter = portfolioDeltaBefore.add(optionDelta);
  const portfolioDeltaIsDecreased = portfolioDeltaAfter
    .abs()
    .sub(portfolioDeltaBefore.abs())
    .lt(0);
  const normalisedDelta = portfolioDeltaBefore
    .add(portfolioDeltaAfter)
    .div(2)
    .abs()
    .div(NAV.div(underlyingPrice));

  const deltaTiltAmount = parseFloat(
    utils.formatEther(
      normalisedDelta.gt(maxDiscount) ? maxDiscount : normalisedDelta
    )
  );
  const liquidityAllocated = await optionRegistry.getCollateral(
    {
      expiration: optionSeries.expiration,
      strike: optionSeries.strike.div(10 ** 10),
      isPut: optionSeries.isPut,
      underlying: optionSeries.underlying,
      strikeAsset: optionSeries.strikeAsset,
      collateral: optionSeries.collateral,
    },
    amount
  );
  const utilizationBefore =
    tFormatUSDC(collateralAllocated) /
    tFormatUSDC(collateralAllocated.add(lpUSDBalance));
  const utilizationAfter =
    tFormatUSDC(collateralAllocated.add(liquidityAllocated)) /
    tFormatUSDC(collateralAllocated.add(lpUSDBalance));
  const bidAskSpread = tFormatEth(await liquidityPool.bidAskIVSpread());
  const localBS =
    bs.blackScholes(
      priceNorm,
      fromWei(optionSeries.strike),
      timeToExpiration,
      toBuy ? Number(fromWei(iv)) * (1 - Number(bidAskSpread)) : fromWei(iv),
      parseFloat(rfr),
      optionSeries.isPut ? "put" : "call"
    ) * parseFloat(fromWei(amount));
  let utilizationPrice = toBuy
    ? localBS
    : getUtilizationPrice(utilizationBefore, utilizationAfter, localBS);
  // if delta exposure reduces, subtract delta skew from  pricequotes
  if (portfolioDeltaIsDecreased) {
    if (toBuy) {
      utilizationPrice = utilizationPrice + utilizationPrice * deltaTiltAmount;
    } else {
      utilizationPrice = utilizationPrice - utilizationPrice * deltaTiltAmount;
    }
    return utilizationPrice;
    // if delta exposure increases, add delta skew to price quotes
  } else {
    if (toBuy) {
      utilizationPrice = utilizationPrice - utilizationPrice * deltaTiltAmount;
    } else {
      utilizationPrice = utilizationPrice + utilizationPrice * deltaTiltAmount;
    }

    return utilizationPrice;
  }
}

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
  return toWei(truncateDecimalString(localDelta.toString())).mul(
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
  const localBS =
    bs.blackScholes(
      priceNorm,
      fromWei(optionSeries.strike),
      timeToExpiration,
      toBuy ? Number(fromWei(iv)) * (1 - Number(bidAskSpread)) : fromWei(iv),
      parseFloat(rfr),
      optionSeries.isPut ? "put" : "call"
    ) * parseFloat(fromWei(amount));

  return localBS;
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

  const iv = impliedVol.getImpliedVolatility(
    quote,
    priceNorm,
    fromWei(optionSeries.strike),
    timeToExpiration,
    rfr,
    type
  );

  return iv;
}

function getUtilizationPrice(
  utilizationBefore: number,
  utilizationAfter: number,
  optionPrice: number
) {
  if (
    utilizationBefore < utilizationFunctionThreshold &&
    utilizationAfter < utilizationFunctionThreshold
  ) {
    return (
      optionPrice +
      ((optionPrice * (utilizationBefore + utilizationAfter)) / 2) *
        belowUtilizationThresholdGradient
    );
  } else if (
    utilizationBefore > utilizationFunctionThreshold &&
    utilizationAfter > utilizationFunctionThreshold
  ) {
    const utilizationPremiumFactor =
      ((utilizationBefore + utilizationAfter) / 2) *
        aboveUtilizationThresholdGradient +
      yIntercept;
    return optionPrice + optionPrice * utilizationPremiumFactor;
  } else {
    const weightingRatio =
      (utilizationFunctionThreshold - utilizationBefore) /
      (utilizationAfter - utilizationFunctionThreshold);
    const averageFactorBelow =
      ((utilizationFunctionThreshold + utilizationBefore) / 2) *
      belowUtilizationThresholdGradient;
    const averageFactorAbove =
      ((utilizationFunctionThreshold + utilizationAfter) / 2) *
        aboveUtilizationThresholdGradient +
      yIntercept;
    const multiplicationFactor =
      (weightingRatio * averageFactorBelow + averageFactorAbove) /
      (1 + weightingRatio);
    return optionPrice + optionPrice * multiplicationFactor;
  }
}
