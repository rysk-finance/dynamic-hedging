import type { ChangeEvent } from "react";

import type {
  AddressesRequired,
  AddressesRequiredVaultSell,
} from "../Shared/types";

import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useDebounce } from "use-debounce";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { Button } from "src/components/shared/Button";
import { useGlobalContext } from "src/state/GlobalContext";
import { toOpyn, toRysk, tFormatUSDC } from "src/utils/conversion-helper";

import { Disclaimer } from "../Shared/components/Disclaimer";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { useNotifications } from "../Shared/hooks/useNotifications";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import {
  approveAllowance,
  closeLong,
  sell,
  vaultSell,
} from "../Shared/utils/transactions";
import { Pricing } from "./components/Pricing";
import { usePositionData } from "./hooks/usePositionData";
import { useVaultData } from "./hooks/useVaultData";
import { BigNumber } from "ethers";
import { getContractAddress } from "../../../../utils/helpers";
import { useSearchParams } from "react-router-dom";

dayjs.extend(LocalizedFormat);

export const CloseOptionModal = () => {
  const {
    state: {
      options: { refresh },
    },
  } = useGlobalContext();

  const [amountToClose, setAmountToClose] = useState("");
  const [debouncedAmountToClose] = useDebounce(amountToClose, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    usePositionData(debouncedAmountToClose);
  const [searchParams] = useSearchParams();

  const [collateralAmount, collateralPerOption] = useVaultData(
    searchParams.get("vault") // @TODO: Add vault ID
  );

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");

    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;

    const maxAmount = Math.min(
      positionData.totalSize,
      parseFloat(rounded || "0")
    );

    setAmountToClose(maxAmount ? maxAmount.toString() : amount);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toOpyn(amountToClose);

        const hash = await approveAllowance(
          addresses as AddressesRequired,
          amount
        );

        if (hash) {
          setAllowance({ approved: true, amount });
          setTransactionPending(false);
          notifyApprovalSuccess(hash);
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  const handleSell = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toRysk(amountToClose);

        const hash = await closeLong(
          positionData.acceptablePremium,
          addresses as AddressesRequired,
          amount,
          refresh
        );

        if (hash) {
          setTransactionPending(false);
          handleTransactionSuccess(hash, "Sale");
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  const collateralToRemove = collateralPerOption.mul(amountToClose || 0);

  const handleVaultClose = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toRysk(amountToClose);

        const hash = await vaultSell(
          {
            ...addresses,
            vaultId: BigNumber.from(searchParams.get("vault")),
            collateralAsset: getContractAddress("USDC"),
          } as AddressesRequiredVaultSell,
          amount,
          refresh,
          collateralToRemove
        );

        if (hash) {
          setTransactionPending(false);
          handleTransactionSuccess(hash, "Sale");
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  return (
    <Modal>
      <Header>{`Sell Position`}</Header>
      <Pricing positionData={positionData} />
      {!collateralToRemove.isZero() &&
        collateralToRemove.lte(collateralAmount) && (
          <div className="flex justify-center mb-5">
            After sale collateral: $
            {tFormatUSDC(collateralAmount.sub(collateralToRemove))} $
            <del>{tFormatUSDC(collateralAmount)}</del>
          </div>
        )}
      <div className="flex border-blackWrapper border-y-2">
        <label
          className="grow"
          title="Enter how much of your position you would like to sell."
        >
          <input
            className="text-center w-full h-12 number-input-hide-arrows border-r-2 border-black"
            inputMode="numeric"
            name="sell-amount"
            onChange={handleChange}
            placeholder="How many would you like to sell?"
            step={0.01}
            type="number"
            value={amountToClose}
          />
        </label>

        <AnimatePresence mode="wait">
          <Button
            className="w-1/3 !border-0"
            disabled={
              Number(amountToClose) > positionData.totalSize ||
              !Number(amountToClose) ||
              !addresses.user ||
              !addresses.token ||
              transactionPending
            }
            requiresConnection
            {...FadeInOutQuick}
            {...getButtonProps(
              "sell",
              transactionPending,
              allowance.approved,
              handleApprove,
              searchParams.get("ref") === "close"
                ? handleSell
                : handleVaultClose
            )}
          />
        </AnimatePresence>
      </div>

      <Disclaimer>
        {`You are about to sell some or all of your position. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
