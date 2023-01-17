import dayjs from "dayjs";

import { BIG_NUMBER_DECIMALS } from "../../config/constants";
import { Currency, OptionSeries } from "../../types";
import { parseTimestamp } from "../../utils/parseTimestamp";
import { BigNumberDisplay } from "../BigNumberDisplay";

type OptionSeriesInfoProps = {
  option: OptionSeries | null;
};

export const OptionSeriesInfo = ({ option }: OptionSeriesInfoProps) => {
  const date = dayjs
    .unix(Number(option?.expiration))
    .format("DD-MMM-YY")
    .toUpperCase();
  const price = option?.strike.div(BIG_NUMBER_DECIMALS.OPYN);
  const returnType = option?.isPut ? "PUT" : "CALL";
  const returnExpiry = parseTimestamp(Number(option?.expiration) * 1000);
  const optionSymbol = `ETH ${date} $${price} ${returnType}`;

  return option ? (
    <div className="w-full">
      <div className="flex items-center">
        <h4 className="font-parabole mr-2 pb-2">{optionSymbol}</h4>
      </div>
      <p className="pt-2">Type: {returnType}</p>
      <p className="pt-2">
        Strike:{" "}
        <BigNumberDisplay currency={Currency.OPYN} suffix="USDC">
          {option.strike}
        </BigNumberDisplay>
      </p>
      {/* Converting s to ms */}
      <p className="pt-2">Expiration: {returnExpiry}</p>
    </div>
  ) : null;
};
