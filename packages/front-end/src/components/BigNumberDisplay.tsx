import { BigNumber, ethers } from "ethers";
import React from "react";
import NumberFormat, { NumberFormatProps } from "react-number-format";
import { DECIMALS } from "../config/constants";
import { Currency } from "../types";
import { Loader } from "./Loader";

const CURRENCY_TO_DP_MAP: Record<Currency, number> = {
  [Currency.USDC]: 2,
  [Currency.RYSK]: 2,
  [Currency.OPYN]: 2,
};

type BigNumberDisplayProps = {
  currency: Currency;
  children: BigNumber | null;
  numberFormatProps?: NumberFormatProps;
  loaderProps?: React.HTMLProps<HTMLImageElement>;
  suffix?: string;
};

export const BigNumberDisplay: React.FC<BigNumberDisplayProps> = ({
  children,
  currency,
  numberFormatProps = {},
  suffix,
  loaderProps: { className: loaderClassName, ...restLoaderProps } = {},
}) => {
  return children ? (
    <NumberFormat
      value={ethers.utils.formatUnits(children, DECIMALS[currency])}
      displayType={"text"}
      decimalScale={CURRENCY_TO_DP_MAP[currency]}
      thousandSeparator={true}
      fixedDecimalScale
      suffix={suffix ? ` ${suffix}` : undefined}
      {...numberFormatProps}
    />
  ) : (
    <Loader
      className={`inline mr-2 !h-[24px] ${loaderClassName}`}
      {...restLoaderProps}
    />
  );
};
