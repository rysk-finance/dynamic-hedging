export enum LocalStorageKeys {
  ACTIVE_POSITIONS_FILTERS_COMPACT = "rysk-apfc",
  ACTIVE_POSITIONS_FILTERS_HIDE_EXPIRED = "rysk-apfhe",
  ACTIVE_POSITIONS_FILTERS_SORTING = "rysk-apfs",
  INACTIVE_POSITIONS_FILTERS_COMPACT = "rysk-ipfc",
  TRADING_PREFERENCES = "rysk-tp",
}

export const getLocalStorageObject = <
  StorageObjectType = Record<string, boolean>
>(
  localStorageKey: `${LocalStorageKeys}`
) => {
  const storageObject = localStorage.getItem(localStorageKey);

  return (storageObject ? JSON.parse(storageObject) : {}) as StorageObjectType;
};

export const setLocalStorageObject = (
  localStorageKey: `${LocalStorageKeys}`,
  data: Record<string, string | boolean | number>
) => localStorage.setItem(localStorageKey, JSON.stringify(data));
