export enum LocalStorageKeys {
  ACTIVE_POSITIONS_FILTERS_COMPACT = "rysk-apfc",
  ACTIVE_POSITIONS_FILTERS_HIDE_EXPIRED = "rysk-apfhe",
  ACTIVE_POSITIONS_FILTERS_SORTING = "rysk-apfs",
  OPTION_CHAIN_FILTERS = "rysk-ocf",
  INACTIVE_POSITIONS_FILTERS_COMPACT = "rysk-ipfc",
  TRADING_PREFERENCES = "rysk-tp",
}

export const getLocalStorageObject = <
  StorageObjectType = Record<string, boolean>
>(
  localStorageKey: `${LocalStorageKeys}`,
  defaultValue = {}
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
  defaultValue = new Set()
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
