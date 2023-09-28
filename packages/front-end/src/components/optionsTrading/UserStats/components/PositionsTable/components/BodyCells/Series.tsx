import type { SeriesProps } from "./types";

import { DownChevron, Link, UpChevron } from "src/Icons";
import { RyskTooltip } from "src/components/shared/RyskToolTip";

export const Series = ({
  isShort,
  series,
  strategyTimestampIndex,
}: SeriesProps) => {
  const dynamicClasses = isShort ? "text-red-900" : "text-green-1100";
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
      {isShort ? (
        <DownChevron
          aria-hidden={true}
          className="min-w-6 h-6 mx-1 my-auto stroke-red-900"
          strokeWidth={2}
        />
      ) : (
        <UpChevron
          aria-hidden={true}
          className="min-w-6 h-6 mx-1 my-auto stroke-green-1100"
          strokeWidth={2}
        />
      )}
      <span className={`w-4/5 text-xs 2xl:text-sm my-auto ${dynamicClasses}`}>
        {series}
      </span>
    </td>
  );
};
