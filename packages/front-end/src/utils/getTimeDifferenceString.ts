const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

export const getTimeDifferenceString = (time: number) => {
  const days = Math.floor(time / DAY_MS);
  const timeRemaining = time - days * DAY_MS;
  const hours = Math.round(timeRemaining / HOUR_MS);

  return `${days ? `${days}d` : ""} ${hours}h`;
};
