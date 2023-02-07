export const toTwoDecimalPlaces = (number: number) => {
  return Math.round(number * 100) / 100;
};
