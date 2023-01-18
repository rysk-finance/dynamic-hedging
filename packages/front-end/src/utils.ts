import dayjs from "dayjs";
import { BigNumber } from "ethers";

import { BIG_NUMBER_DECIMALS } from "./config/constants";

export const truncateAddress = (address: string) => {
  if (!address) return "No Account";
  const match = address.match(
    /^(0x[a-zA-Z0-9]{2})[a-zA-Z0-9]+([a-zA-Z0-9]{2})$/
  );
  if (!match) return address;
  return `${match[1]}…${match[2]}`;
};

export const truncateDecimalString = (
  numString: string,
  decimals: number = 18
) => {
  const decimalPointIndex = numString.indexOf(".");
  if (!decimalPointIndex) {
    return numString;
  }
  return `${numString.slice(0, decimalPointIndex)}.${numString.slice(
    decimalPointIndex + 1,
    decimalPointIndex + 1 + decimals
  )}`;
};

export const toHex = (num: number): string => {
  const val = Number(num);
  return "0x" + val.toString(16);
};

export const optionSymbolFormat = (
  isPut: boolean,
  expiryTimestamp: string,
  strikePrice: string
) => {
  const date = dayjs
    .unix(Number(expiryTimestamp))
    .format("DD-MMM-YY")
    .toUpperCase();
  const price = BigNumber.from(strikePrice).div(BIG_NUMBER_DECIMALS.OPYN);
  const returnType = isPut ? "PUT" : "CALL";
  const optionSymbol = `ETH ${date} $${price} ${returnType}`;

  return optionSymbol;
};
