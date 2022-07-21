import { BigNumber, ethers } from "ethers";
import React from "react";
import NumberFormat, { NumberFormatProps } from "react-number-format";
import { DECIMALS } from "../config/constants";
import { Currency } from "../types";

const CURRENCY_TO_DP_MAP: Record<Currency, number> = {
  [Currency.USDC]: 2,
  [Currency.RYSK]: 2,
  [Currency.OPYN]: 2,
};

type BigNumberDisplayProps = {
  currency: Currency;
  children: BigNumber;
  numberFormatProps?: NumberFormatProps;
  suffix?: string;
};

export const BigNumberDisplay: React.FC<BigNumberDisplayProps> = ({
  children,
  currency,
  numberFormatProps = {},
  suffix,
}) => {
  return (
    <NumberFormat
      value={ethers.utils.formatUnits(children, DECIMALS[currency])}
      displayType={"text"}
      decimalScale={CURRENCY_TO_DP_MAP[currency]}
      fixedDecimalScale
      suffix={suffix ? ` ${suffix}` : undefined}
      {...numberFormatProps}
    />
  );
};
