import { useSearchParams } from "react-router-dom";

/**
 * Hook to read the "flag" query parameter and check that it
 * is equal to the passed in flag value. Checks are bypassed
 * in any environment that is not production.
 *
 * @param value - String value for the flag value.
 *
 * @returns [boolean]
 */
export const useFeatureFlag = (value: string): [boolean] => {
  const [searchParams] = useSearchParams();

  if (process.env.REACT_APP_ENV !== "production") return [true];

  const flag = searchParams.get("flag");

  return [flag === value];
};
