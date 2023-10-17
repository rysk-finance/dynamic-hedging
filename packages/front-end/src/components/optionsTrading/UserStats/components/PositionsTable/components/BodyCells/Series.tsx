import type { SeriesProps } from "./types";

import { DownChevron, Link, UpChevron } from "src/Icons";
import { CallCreditSpread, PutCreditSpread } from "src/Icons/Strategy";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { OptionChainModalActions } from "src/state/types";

const getIcon = (
  collateralSeries: string,
  isPut: boolean,
  isShort: boolean
) => {
  const commonClasses = "min-w-6 h-6 mx-auto";

  switch (true) {
    case collateralSeries && isPut:
      return (
        <RyskTooltip
          content={OptionChainModalActions.PUT_CREDIT_SPREAD}
          disabled={!collateralSeries}
        >
          <div className="row-span-2">
            <PutCreditSpread aria-hidden={true} className={commonClasses} />
          </div>
        </RyskTooltip>
      );

    case collateralSeries && !isPut:
      return (
        <RyskTooltip
          content={OptionChainModalActions.CALL_CREDIT_SPREAD}
          disabled={!collateralSeries}
        >
          <div className="row-span-2">
            <CallCreditSpread aria-hidden={true} className={commonClasses} />
          </div>
        </RyskTooltip>
      );

    case isShort:
      return (
        <DownChevron
          aria-hidden={true}
          className={`${commonClasses} stroke-red-900`}
          strokeWidth={2}
        />
      );

    default:
      return (
        <UpChevron
          aria-hidden={true}
          className={`${commonClasses} stroke-green-1100`}
          strokeWidth={2}
        />
      );
  }
};

export const Series = ({
  isPut,
  isShort,
  series,
  strategyTimestampIndex,
}: SeriesProps) => {
  const [positionSeries, collateralSeries] = series;

  const height = collateralSeries ? "h-8" : "h-11";
  const showLink = strategyTimestampIndex >= 0;
  const displayIndex = strategyTimestampIndex + 1;

  return (
    <td className={`relative col-span-2 flex justify-center`}>
      {showLink && (
        <RyskTooltip
          content={
            <span className="block text-center normal-case">
              {`This position was opened as part of a strategy. The number `}
              <em className="not-italic font-dm-mono">{`'${displayIndex}'`}</em>
              {` shows the related positions.`}
            </span>
          }
          placement="right"
        >
          <div className="absolute left-0 top-1 flex">
            <Link className="w-3 h-3" />
            <small className="font-dm-mono text-2xs xl:text-xs pt-1">
              {displayIndex}
            </small>
          </div>
        </RyskTooltip>
      )}

      <div className="w-full grid grid-cols-3 items-center">
        {getIcon(collateralSeries, isPut, isShort)}

        <span
          className={`inline-flex items-center mx-auto col-span-2 text-xs 2xl:text-sm ${height} ${
            isShort ? "text-red-900" : "text-green-1100"
          }`}
        >
          {positionSeries}
        </span>

        {collateralSeries && (
          <span
            className={`inline-flex items-center mx-auto col-span-2 text-xs 2xl:text-sm text-green-1100 ${height}`}
          >
            {collateralSeries}
          </span>
        )}
      </div>
    </td>
  );
};
