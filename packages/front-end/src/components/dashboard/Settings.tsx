import React from "react";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useGlobalContext } from "../../state/GlobalContext";
import { ActionType, AppSettings } from "../../state/types";
import { Toggle } from "../shared/Toggle";

export const LOCAL_STORAGE_SETTINGS_KEY = "settings";

export const Settings = () => {
  const {
    state: { settings },
    dispatch,
  } = useGlobalContext();

  const [_, setLocalStorage] = useLocalStorage();

  const setSetting = (
    key: keyof AppSettings,
    value: AppSettings[typeof key]
  ) => {
    const updatedSettings = { ...settings, [key]: value } as AppSettings;
    setLocalStorage(LOCAL_STORAGE_SETTINGS_KEY, updatedSettings);
    dispatch({ type: ActionType.SET_SETTINGS, settings: updatedSettings });
  };

  return (
    <div className="w-full">
      <h4 className="mb-4">Settings</h4>
      <div>
        <div className="w-[50%] flex-column">
          <div className="flex justify-between items-center">
            <span>Unlimited Approval</span>
            <Toggle
              value={settings.unlimitedApproval}
              setValue={(value: boolean) =>
                setSetting("unlimitedApproval", value)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};
