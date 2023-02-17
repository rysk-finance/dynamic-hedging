import type { ContractAddresses, ETHNetwork } from "src/types";

import { getNetwork, readContract } from "@wagmi/core";
import { BigNumber } from "ethers";
import greeks from "greeks";
import impliedVol from "implied-volatility";

const rfr = "0.03";

export const getContractAddress = (contractName: keyof ContractAddresses) => {
  const { chain } = getNetwork();
  const typedAddresses = addresses as Record<ETHNetwork, ContractAddresses>;
  const network =
    !chain?.unsupported && chain?.network
      ? (chain.network as ETHNetwork)
      : (process.env.REACT_APP_NETWORK as ETHNetwork);

  return typedAddresses[network][contractName] as `0x${string}`;
};

export const calculateOptionDeltaLocally = async (
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

  const NAV = await getAltNAV;

  // BUG getNAV will only work 10 minutes after a fulfill happens
  // await liquidityPool
  //   .getNAV()
  //   .catch((e) => {
  //     console.log("errore");
  //     // TODO update once LP is deployed
  //     // getAssets() - effephemeralLiabalities - portfolioValueFeed.getPortfolioVaules.callPutsValue
  //     return getAltNAV;
  //   })
  //   .then((res) => {
  //     return res;
  //   });

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
  // BUG getPortfolioDelta will only work 10 minutes after a fulfill happens
  const portfolioDeltaBefore = BigNumber.from(0); // await liquidityPool.getPortfolioDelta();
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
    strikeAsset: HexString;
    underlying: HexString;
    collateral: HexString;
  },
  amount: BigNumber,
  isShort: boolean
): Promise<BigNumber> => {
  const priceQuote = await readContract({
    address: getContractAddress("priceFeed"),
    abi: PriceFeedABI,
    functionName: "getNormalizedRate",
    args: [optionSeries.underlying, optionSeries.strikeAsset],
  });

  const vol = await readContract({
    address: getContractAddress("liquidityPool"),
    abi: LiquidityPoolABI,
    functionName: "getImpliedVolatility",
    args: [
      optionSeries.isPut,
      priceQuote,
      optionSeries.strike,
      optionSeries.expiration,
    ],
  });

  const timestamp = Math.round(+new Date() / 1000);
  const time = genOptionTimeFromUnix(
    timestamp,
    optionSeries.expiration.toNumber()
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
};

export const returnIVFromQuote = async (
  quote: number,
  optionSeries: {
    expiration: BigNumber;
    strike: BigNumber;
    isPut: boolean;
    strikeAsset: HexString;
    underlying: HexString;
    collateral: HexString;
  }
): Promise<number> => {
  const underlyingPrice = await readContract({
    address: getContractAddress("priceFeed"),
    abi: PriceFeedABI,
    functionName: "getNormalizedRate",
    args: [optionSeries.underlying, optionSeries.strikeAsset],
  });

  const priceNorm = fromWei(underlyingPrice);

  const timestamp = Math.round(+new Date() / 1000);
  const timeToExpiration = genOptionTimeFromUnix(
    Number(timestamp),
    optionSeries.expiration.toNumber()
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
};
