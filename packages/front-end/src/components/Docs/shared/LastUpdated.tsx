import type { HTMLAttributes } from "react";
import type { Dayjs } from "dayjs";

interface LastUpdatedProps extends HTMLAttributes<"span"> {
  lastUpdated: Dayjs;
}

export const LastUpdated = ({ lastUpdated }: LastUpdatedProps) => (
  <span className="font-dm-mono">
    {`Last Updated: `}
    <time dateTime={lastUpdated.format("YYYY-MM-DD")}>
      {`${lastUpdated.format("DD MMM YY")}`}
    </time>
  </span>
);
