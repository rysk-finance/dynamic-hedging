export enum LocalStorageKeys {
  TRADING_PREFERENCES = "rysk-up",
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
