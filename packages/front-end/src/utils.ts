export const truncateAddress = (address: string) => {
  if (!address) return "No Account";
  const match = address.match(
    /^(0x[a-zA-Z0-9]{2})[a-zA-Z0-9]+([a-zA-Z0-9]{2})$/
  );
  if (!match) return address;
  return `${match[1]}…${match[2]}`;
};

export const truncateDecimalString = (
  numString: string,
  decimals: number = 18
) => {
  const decimalPointIndex = numString.indexOf(".");
  if (!decimalPointIndex) {
    return numString;
  }
  return `${numString.slice(0, decimalPointIndex)}.${numString.slice(
    decimalPointIndex + 1,
    decimalPointIndex + 1 + decimals
  )}`;
};

export const toHex = (num: number): string => {
  const val = Number(num);
  return "0x" + val.toString(16);
};
