import { ChangeEvent } from "react";

/**
 * Utility function to round a numeric value entered into a string input.
 * Rounding is to two decimal places.
 *
 * @param event - Event passed from the onChange of the input.
 *
 * @returns The rounded number as a string.
 */
export const roundInputValue = (event: ChangeEvent<HTMLInputElement>) => {
  const amount = event.currentTarget.value;
  const decimals = amount.split(".");
  const rounded =
    decimals.length > 1
      ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
      : event.currentTarget.value;

  return rounded;
};
