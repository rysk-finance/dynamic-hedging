import type { ContractAddresses, ETHNetwork } from "src/types";

import { getNetwork, readContract } from "@wagmi/core";
import { BigNumber, BigNumberish, utils } from "ethers";
import greeks from "greeks";
import impliedVol from "implied-volatility";

import { LiquidityPoolABI } from "src/abis/LiquidityPool_ABI";
import { PriceFeedABI } from "src/abis/PriceFeed_ABI";
import addresses from "src/contracts.json";
import { fromWei, genOptionTimeFromUnix, toWei } from "./conversion-helper";

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
    expiration: BigNumber;
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

  return (
    impliedVol.getImpliedVolatility(
      quote,
      priceNorm,
      fromWei(optionSeries.strike),
      timeToExpiration,
      rfr,
      type
    ) * 100
  );
};

export const getOptionHash = (
  expiry: number,
  strike: BigNumberish,
  isPut: boolean
) => {
  return utils.solidityKeccak256(
    ["uint64", "uint128", "bool"],
    [expiry, strike, isPut]
  ) as HexString;
};
