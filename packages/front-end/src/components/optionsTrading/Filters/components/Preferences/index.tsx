import type { UserTradingPreferences } from "src/state/types";

import { AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

import { Close, Cog } from "src/Icons";
import { RyskModal } from "src/components/shared/RyskModal";
import { SimpleToggle } from "src/components/shared/SimpleToggle";
import { useGlobalContext } from "src/state/GlobalContext";
import {
  LocalStorageKeys,
  setLocalStorageObject,
} from "src/state/localStorage";
import { ActionType } from "src/state/types";
import { buildPreferencesList } from "./utils";

export const Preferences = () => {
  const {
    dispatch,
    state: { userTradingPreferences },
  } = useGlobalContext();

  const [modalOpen, setModalOpen] = useState(false);

  const toggleModal = () => setModalOpen((currentState) => !currentState);

  const handleTogglePreference =
    (preference: keyof UserTradingPreferences) => () => {
      const newPreferences = {
        ...userTradingPreferences,
        [preference]: !userTradingPreferences[preference],
      };

      dispatch({
        type: ActionType.SET_USER_TRADING_PREFERENCES,
        userTradingPreferences: newPreferences,
      });

      setLocalStorageObject(
        LocalStorageKeys.TRADING_PREFERENCES,
        newPreferences
      );
    };

  const preferencesList = useMemo(
    () => buildPreferencesList(userTradingPreferences),
    [userTradingPreferences]
  );

  return (
    <>
      <button
        className="ml-auto px-8 py-2 border-black border-l-2 ease-in-out duration-100 hover:bg-bone-light"
        onClick={toggleModal}
      >
        <Cog className="h-7 w-7" />
      </button>

      <AnimatePresence mode="wait">
        {modalOpen && (
          <RyskModal lightBoxClickFn={toggleModal}>
            <span className="grid grid-cols-10 bg-black text-white bg-[url('./assets/circle-lines.png')] bg-no-repeat bg-contain">
              <h2 className="col-span-4 col-start-4 text-lg font-medium text-center py-3">
                {`Trading Preferences`}
              </h2>

              <button
                className={`col-span-1 col-start-10 mx-auto p-2`}
                onClick={toggleModal}
                title="Click to close the modal."
              >
                <Close className="text-white h-8 w-8" />
              </button>
            </span>

            <ul className="w-4/5 xl:w-3/5 mx-auto py-3">
              {preferencesList.map(
                ({ explainer, isActive, label, preferencesKey }) => (
                  <li
                    className="my-3 cursor-pointer pb-1 border-gray-600 border-b last:border-b-0"
                    key={label}
                    onClick={handleTogglePreference(preferencesKey)}
                  >
                    <span className="flex items-center">
                      <SimpleToggle isActive={Boolean(isActive)}>
                        <p className="mr-auto">{label}</p>
                      </SimpleToggle>
                    </span>
                    <small className="block leading-6 text-justify">
                      {explainer}
                    </small>
                  </li>
                )
              )}
            </ul>
          </RyskModal>
        )}
      </AnimatePresence>
    </>
  );
};
