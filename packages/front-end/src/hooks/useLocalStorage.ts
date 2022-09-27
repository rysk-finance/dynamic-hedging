import { useCallback } from "react";

export const useLocalStorage = () => {
  const get = useCallback(<T = any>(key: string) => {
    const items = window.localStorage.getItem(key);
    return items ? (JSON.parse(items) as T) : null;
  }, []);

  const set = useCallback(
    (
      key: string,
      value:
        | string
        | Record<string, string | boolean | number>
        | string[]
        | boolean
    ) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    []
  );

  return [get, set] as const;
};
