import type { ChartData } from "../VaultPerformance.types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import {
  SECONDS_IN_YEAR,
  SECOND_IN_THIRTY_DAYS,
} from "src/utils/conversion-helper";
import { toTwoDecimalPlaces } from "src/utils/rounding";

export const Stats = ({ chartData }: { chartData: ChartData[] }) => {
  if (!chartData.length) return null;

  const firstEpoch = chartData[0];
  const latestEpoch = chartData[chartData.length - 1];
  const totalEpochTime =
    parseInt(latestEpoch.timestamp) - parseInt(firstEpoch.timestamp);

  const historicalReturns = latestEpoch?.growthSinceFirstEpoch;
  const showAnnualisedReturns = totalEpochTime >= SECOND_IN_THIRTY_DAYS;
  const annualisedReturns = toTwoDecimalPlaces(
    (Math.pow(1 + historicalReturns / 100, SECONDS_IN_YEAR / totalEpochTime) -
      1) *
      100
  );

  return (
    <div className="flex flex-col py-8 pl-8 justify-around">
      <p className="text-sm xl:text-xl mb-2">{`Historical Returns`}</p>
      <p className="after:content-['_%'] mb-8 font-dm-mono text-xl xl:text-2xl text-green-1100">
        <RyskCountUp value={historicalReturns} />
      </p>

      {showAnnualisedReturns ? (
        <>
          <p className="text-sm xl:text-xl mb-2">{`Annualised Returns`}</p>
          <p className="after:content-['_%'] font-dm-mono text-xl xl:text-2xl text-green-1100">
            <RyskCountUp value={annualisedReturns} />
          </p>
        </>
      ) : (
        <>
          <p className="text-sm xl:text-xl mb-2">{`Annualised Returns`}</p>
          <p className="text-xl xl:text-2xl">{`Soon™`}</p>
        </>
      )}
    </div>
  );
};
