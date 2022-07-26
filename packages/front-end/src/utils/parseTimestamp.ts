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
