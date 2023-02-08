import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { useContractRead } from "wagmi";

import { captureException } from "@sentry/react";
import { OptionCatalogueABI } from "src/abis/OptionCatalogue_ABI";
import { getContractAddress } from "src/utils/helpers";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import { RadioButtonList } from "../shared/RadioButtonList";

interface OptionExpiryDict {
  value: number;
  label: string;
  key: string;
}

export const ExpiryDatePicker = () => {
  const {
    state: { expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  const [expiryDateOptions, setExpiryDateOptions] = useState<any[]>([]);

  const setExpiryDate = useCallback(
    (date: number | null) => {
      dispatch({ type: OptionsTradingActionType.SET_EXPIRY_DATE, date });
    },
    [dispatch]
  );

  const handleRadioExpiryClick = useCallback(
    (date: number) => {
      setExpiryDate(date);
    },
    [setExpiryDate]
  );

  const { data, error } = useContractRead({
    address: getContractAddress("optionCatalogue"),
    abi: OptionCatalogueABI,
    functionName: "getExpirations",
  });

  useEffect(() => {
    const fetchExpirations = async () => {
      if (data) {
        const expirationsToDict = data.reduce(
          (expirationDicts: OptionExpiryDict[], expiration: BigNumber) => {
            const now = dayjs().unix();
            const date = dayjs.unix(BigNumber.from(expiration._hex).toNumber());

            if (date.unix() > now) {
              expirationDicts.push({
                value: date.unix(),
                label: date.format("MMM DD"),
                key: date.toISOString(),
              });
            }

            return expirationDicts;
          },
          []
        );

        setExpiryDateOptions(expirationsToDict);
        setExpiryDate(expirationsToDict[0].value);
      }
    };

    if (error) {
      captureException(error);
    } else {
      fetchExpirations();
    }
  }, [data, setExpiryDate]);

  return (
    <div className="w-full">
      <div className="w-full border-y-2 border-black flex justify-center relative">
        <div className="w-full">
          <RadioButtonList
            options={expiryDateOptions}
            selected={expiryDate}
            setSelected={handleRadioExpiryClick}
            removeOuterBorder
          />
        </div>
      </div>
    </div>
  );
};
