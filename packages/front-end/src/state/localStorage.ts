export enum LocalStorageKeys {
  ACTIVE_POSITIONS_FILTERS_COMPACT = "rysk-apfc",
  ACTIVE_POSITIONS_FILTERS_HIDE_EXPIRED = "rysk-apfhe",
  ACTIVE_POSITIONS_FILTERS_SORTING = "rysk-apfs",
  ACTIVE_POSITIONS_RETURN_FORMAT = "rysk-aprf",
  NATIVE_USDC_BANNER_VISIBLE = "rysk-nubv",
  OPTION_CHAIN_FILTERS = "rysk-ocf",
  INACTIVE_POSITIONS_FILTERS_COMPACT = "rysk-ipfc",
  TRADING_PREFERENCES = "rysk-tp",
}

export const getLocalStorageObject = <
  StorageObjectType = Record<string, boolean>,
>(
  localStorageKey: `${LocalStorageKeys}`,
  defaultValue: StorageObjectType
) => {
  const storageObject = localStorage.getItem(localStorageKey);

  return (
    storageObject ? JSON.parse(storageObject) : defaultValue
  ) as StorageObjectType;
};

export const setLocalStorageObject = (
  localStorageKey: `${LocalStorageKeys}`,
  data: Record<string, string | boolean | number>
) => localStorage.setItem(localStorageKey, JSON.stringify(data));

export const getLocalStorageSet = <StorageObjectType = Set<string>>(
  localStorageKey: `${LocalStorageKeys}`,
  defaultValue: StorageObjectType
) => {
  const storageObject = localStorage.getItem(localStorageKey);

  return (
    storageObject ? new Set(JSON.parse(storageObject)) : defaultValue
  ) as StorageObjectType;
};

export const setLocalStorageSet = (
  localStorageKey: `${LocalStorageKeys}`,
  data: Set<string | boolean | number>
) => {
  const asArray = Array.from(data);

  localStorage.setItem(localStorageKey, JSON.stringify(asArray));
};

/**
 * Getter for local storage booleans.
 * This function assumes that boolean values stored in local storage are
 * represented as numbers, where 0 === false and 1 === true.
 *
 * @param localStorageKey - String key from the LocalStorageKeys enum.
 * @param defaultValue - Boolean default value to return if nothing is found in local storage.
 *
 * @returns - Boolean
 */
export const getLocalStorageBoolean = (
  localStorageKey: `${LocalStorageKeys}`,
  defaultValue: boolean
) => {
  const storageObject = localStorage.getItem(localStorageKey);

  return storageObject ? Boolean(Number(storageObject)) : defaultValue;
};

/**
 * Setter for local storage booleans.
 *
 * @param localStorageKey - String key from the LocalStorageKeys enum.
 * @param data - Value to be set into local storage.
 *
 * @returns - void
 */
export const setLocalStorageBoolean = (
  localStorageKey: `${LocalStorageKeys}`,
  data: 0 | 1
) => localStorage.setItem(localStorageKey, String(data));
