import { BigNumber, ethers } from "ethers";
import React from "react";
import NumberFormat, { NumberFormatProps } from "react-number-format";

export enum Currency {
  USDC = "USDC",
  RYSK = "RYSK",
}

const CURRENCY_TO_DP_MAP: Record<Currency, number> = {
  [Currency.USDC]: 2,
  [Currency.RYSK]: 2,
};

const CURRENCY_TO_SUFFIX_MAP: Record<Currency, string> = {
  [Currency.USDC]: "USDC",
  [Currency.RYSK]: "",
};

type BigNumberDisplayProps = {
  currency: Currency;
  children: BigNumber;
  numberFormatProps?: NumberFormatProps;
};

export const BigNumberDisplay: React.FC<BigNumberDisplayProps> = ({
  children,
  currency,
  numberFormatProps = {},
}) => {
  return (
    <NumberFormat
      value={ethers.utils.formatEther(children)}
      displayType={"text"}
      decimalScale={CURRENCY_TO_DP_MAP[currency]}
      fixedDecimalScale
      suffix={` ${CURRENCY_TO_SUFFIX_MAP[currency]}`}
      {...numberFormatProps}
    />
  );
};
