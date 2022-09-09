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
      <div>
        <p>
          <b>Settings</b>
        </p>
        <div className="w-full flex-column">
          <div className="flex justify-between items-center">
            <span>Unlimited Approval</span>
            {/* <Toggle
              value={settings.unlimitedApproval}
              setValue={(value: boolean) =>
                setSetting("unlimitedApproval", value)
              }
            /> */}
          </div>
        </div>
      </div>
    </div>
  );
};
