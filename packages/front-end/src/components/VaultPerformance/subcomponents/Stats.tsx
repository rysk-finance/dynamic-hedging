import type { ChartData } from "../VaultPerformance.types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import {
  SECONDS_IN_YEAR,
  SECONDS_IN_SIXTY_DAYS,
} from "src/utils/conversion-helper";
import { toTwoDecimalPlaces } from "src/utils/rounding";

export const Stats = ({ chartData }: { chartData: ChartData[] }) => {
  if (!chartData.length) return null;

  const firstEpoch = chartData[0];
  const latestEpoch = chartData[chartData.length - 2];
  const totalEpochTime =
    parseInt(latestEpoch.timestamp) - parseInt(firstEpoch.timestamp);

  const historical = latestEpoch.growthSinceFirstEpoch;
  const annualised = toTwoDecimalPlaces(
    (Math.pow(1 + historical / 100, SECONDS_IN_YEAR / totalEpochTime) - 1) * 100
  );

  const showAnnualisedReturns =
    totalEpochTime >= SECONDS_IN_SIXTY_DAYS && historical > 0;

  return (
    <div className="flex flex-col py-8 pl-8 justify-around">
      <p className="text-sm xl:text-xl mb-2">{`Historical Returns`}</p>
      <p className="after:content-['_%'] mb-8 font-dm-mono text-xl xl:text-2xl text-green-1100">
        <RyskCountUp value={historical} />
      </p>

      {showAnnualisedReturns ? (
        <>
          <p className="text-sm xl:text-xl mb-2">{`Annualised Returns`}</p>
          <p className="after:content-['_%'] font-dm-mono text-xl xl:text-2xl text-green-1100">
            <RyskCountUp value={annualised} />
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
