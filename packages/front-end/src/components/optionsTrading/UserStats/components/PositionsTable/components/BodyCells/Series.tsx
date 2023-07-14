import type { SeriesProps } from "./types";

import { DownChevron, UpChevron } from "src/Icons";

export const Series = ({ isShort, series }: SeriesProps) => {
  const dynamicClasses = isShort ? "text-red-900" : "text-green-1100";

  return (
    <td className={`col-span-2 flex justify-center ${dynamicClasses}`}>
      {isShort ? (
        <DownChevron
          aria-hidden={true}
          className="min-w-6 h-6 mx-3 stroke-red-900"
          strokeWidth={2}
        />
      ) : (
        <UpChevron
          aria-hidden={true}
          className="min-w-6 h-6 mx-3 stroke-green 1100"
          strokeWidth={2}
        />
      )}
      <span className="w-2/3">{series}</span>
    </td>
  );
};
