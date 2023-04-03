import type { ChangeEvent } from "react";

import type { AddressesRequired } from "../Shared/types";

import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import FadeInOut from "src/animation/FadeInOut";
import { Button } from "src/components/shared/Button";
import { useGlobalContext } from "src/state/GlobalContext";
import { toOpyn, toRysk } from "src/utils/conversion-helper";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { useNotifications } from "../Shared/hooks/useNotifications";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { approveAllowance, sell } from "../Shared/utils/transactions";
import { Pricing } from "./components/Pricing";
import { usePositionData } from "./hooks/usePositionData";

dayjs.extend(LocalizedFormat);

export const CloseOptionModal = () => {
  const {
    state: {
      options: { refresh },
    },
  } = useGlobalContext();

  const [addresses, allowance, setAllowance, positionData] = usePositionData();

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const [amountToSell, setAmountToSell] = useState("");
  const [transactionPending, setTransactionPending] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");

    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;
    const approved = Boolean(amount && toOpyn(rounded).lte(allowance.amount));

    setAmountToSell(rounded);
    setAllowance((currentState) => ({ ...currentState, approved }));
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toOpyn(amountToSell);

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
        const amount = toRysk(amountToSell);

        const hash = await sell(
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

      <div className="flex border-black border-y-2">
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
            value={amountToSell}
          />
        </label>

        <AnimatePresence mode="wait">
          <Button
            className="w-1/3 !border-0"
            disabled={
              Number(amountToSell) > positionData.totalSize ||
              !Number(amountToSell) ||
              !addresses.user ||
              !addresses.token ||
              transactionPending
            }
            requiresConnection
            {...FadeInOut()}
            {...getButtonProps(
              "sell",
              transactionPending,
              allowance.approved,
              handleApprove,
              handleSell
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
