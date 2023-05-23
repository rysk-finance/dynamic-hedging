import type { ChangeEvent } from "react";

import type {
  AddressesRequired,
  AddressesRequiredVaultSell,
} from "../Shared/types";

import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { useGlobalContext } from "src/state/GlobalContext";
import { toRysk, toUSDC } from "src/utils/conversion-helper";

import { getContractAddress } from "src/utils/helpers";
import { useDebounce } from "use-debounce";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { useNotifications } from "../Shared/hooks/useNotifications";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { approveAllowance, vaultSell } from "../Shared/utils/transactions";
import { Pricing } from "./components/Pricing";
import { useShortPositionData } from "./hooks/useShortPositionData";

dayjs.extend(LocalizedFormat);

export const CloseShortOptionModal = () => {
  const {
    state: {
      options: { refresh },
    },
  } = useGlobalContext();

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const [amountToSell, setAmountToSell] = useState("");
  const [debouncedAmountToSell] = useDebounce(amountToSell, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, vaultId, loading] =
    useShortPositionData(debouncedAmountToSell);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");

    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;

    setAmountToSell(rounded);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.collateral && addresses.user) {
        const amount = toUSDC(positionData.requiredApproval);

        const hash = await approveAllowance(
          {
            ...addresses,
            token: getContractAddress("USDC"),
          } as AddressesRequired,
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

  const handleShortClose = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user && vaultId) {
        const amount = toRysk(amountToSell);

        const hash = await vaultSell(
          positionData.acceptablePremium,
          addresses as AddressesRequiredVaultSell,
          amount,
          refresh,
          positionData.collateralToRemove,
          vaultId
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
      <Header>{`Close Position`}</Header>

      <Pricing
        collateralAddress={addresses.collateral}
        remainingCollateral={positionData.remainingCollateral}
        positionData={positionData}
      />

      <Wrapper>
        <Label
          className="grow"
          title="Enter how much of your position you would like to close."
        >
          <Input
            name="sell-amount"
            onChange={handleChange}
            placeholder="How many would you like to close?"
            value={amountToSell}
          />
        </Label>

        <AnimatePresence mode="wait">
          <Button
            className="w-1/3 !border-0"
            disabled={
              !Number(debouncedAmountToSell) ||
              Number(debouncedAmountToSell) >
                Math.abs(positionData.totalSize) ||
              !addresses.token ||
              !positionData.hasRequiredCapital ||
              transactionPending ||
              loading
            }
            {...FadeInOutQuick}
            {...getButtonProps(
              "close",
              transactionPending || loading,
              allowance.approved,
              handleApprove,
              handleShortClose
            )}
          />
        </AnimatePresence>
      </Wrapper>

      <Disclaimer>
        {`You are about to close some or all of your position. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
