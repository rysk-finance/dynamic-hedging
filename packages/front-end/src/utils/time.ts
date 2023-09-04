const SECONDS_IN_DAY = 86400;
export const SECONDS_IN_WEEK = SECONDS_IN_DAY * 7;
export const SECONDS_IN_SIXTY_DAYS = SECONDS_IN_DAY * 60;
export const SECONDS_IN_YEAR = SECONDS_IN_DAY * 365.25;

export const parseTimestamp = (
  timestamp: number | string,
  options: Intl.DateTimeFormatOptions = {}
) => {
  const stamp = typeof timestamp === "number" ? timestamp : Number(timestamp);

  const date = new Date(stamp);

  return date.toLocaleString("en-US", {
    timeZone: "UTC",
    timeZoneName: "short",
    ...options,
  });
};
