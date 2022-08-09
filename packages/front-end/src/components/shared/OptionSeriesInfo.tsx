import { ethers } from "ethers";
import React from "react";
import { Currency, OptionSeries } from "../../types";
import { parseTimestamp } from "../../utils/parseTimestamp";
import { BigNumberDisplay } from "../BigNumberDisplay";

type OptionSeriesInfoProps = {
  option: OptionSeries | null;
};

export const OptionSeriesInfo: React.FC<OptionSeriesInfoProps> = ({
  option,
}) => {
  return option ? (
    <div className="w-full">
      <div className="flex items-center">
        <h4 className="font-parabole mr-2 pb-2">Option:</h4>
        {option && <p className="pb-1">{option.isPut ? "PUT" : "CALL"}</p>}
      </div>
      <p>
        Strike:{" "}
        <BigNumberDisplay currency={Currency.OPYN} suffix="USDC">
          {option.strike}
        </BigNumberDisplay>
      </p>
      {/* Converting s to ms */}
      <p>Expiration: {parseTimestamp(Number(option.expiration) * 1000)}</p>
    </div>
  ) : null;
};
