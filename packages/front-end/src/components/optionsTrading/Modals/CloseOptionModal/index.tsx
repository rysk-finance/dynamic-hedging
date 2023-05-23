import type { ChangeEvent } from "react";

import type { AddressesRequired } from "../Shared/types";

import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useDebounce } from "use-debounce";

import { useSearchParams } from "react-router-dom";
import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { useGlobalContext } from "src/state/GlobalContext";
import { toOpyn, toRysk } from "src/utils/conversion-helper";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { useNotifications } from "../Shared/hooks/useNotifications";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { approveAllowance, closeLong } from "../Shared/utils/transactions";
import { Pricing } from "./components/Pricing";
import { usePositionData } from "./hooks/usePositionData";

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

  return (
    <Modal>
      <Header>{`Sell Position`}</Header>
      <Pricing positionData={positionData} />
      <Wrapper>
        <Label title="Enter how much of your position you would like to sell.">
          <Input
            name="close-amount"
            onChange={handleChange}
            placeholder="How many would you like to sell?"
            step={0.01}
            type="number"
            value={amountToClose}
          />
        </Label>

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
            {...FadeInOutQuick}
            {...getButtonProps(
              "sell",
              transactionPending,
              allowance.approved,
              handleApprove,
              handleSell
            )}
          />
        </AnimatePresence>
      </Wrapper>

      <Disclaimer>
        {`You are about to sell some or all of your position. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
