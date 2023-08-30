import dayjs from "dayjs";

export const formatExpiry = (expiry?: string) =>
  dayjs.unix(Number(expiry)).format("DDMMMYY");

export const dateTimeNow = () => dayjs().format("MMM DD, YYYY HH:mm A");
