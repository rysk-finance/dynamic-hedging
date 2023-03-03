import type { AddressesRequired } from "./types";

import { useAddRecentTransaction } from "@rainbow-me/rainbowkit";
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { AnimatePresence } from "framer-motion";
import { ChangeEvent, useState } from "react";
import { toast } from "react-toastify";

import FadeInOut from "src/animation/FadeInOut";
import { Button } from "src/components/shared/Button";
import { Loading } from "src/Icons";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";
import { toOpyn, toRysk } from "src/utils/conversion-helper";

import { Disclaimer } from "./components/Disclaimer";
import { Header } from "./components/Header";
import { Modal } from "./components/Modal";
import { Pricing } from "./components/Pricing";
import { usePositionData } from "./hooks/usePositionData";
import { approveAllowance } from "./utils/approveAllowance";
import { sell } from "./utils/sell";

dayjs.extend(LocalizedFormat);

export const SellOptionModal = () => {
  const addRecentTransaction = useAddRecentTransaction();

  const { dispatch } = useOptionsTradingContext();

  const [addresses, allowance, setAllowance, positionData] = usePositionData();

  const [amountToSell, setAmountToSell] = useState("");
  const [transactionPending, setTransactionPending] = useState(false);

  const getButtonProps = () => {
    switch (true) {
      case transactionPending:
        return {
          children: (
            <Loading className="h-8 mx-auto animate-spin text-gray-600" />
          ),
          key: "pending",
          onClick: () => {},
          title: "Transaction pending.",
        };

      case allowance.approved:
        return {
          children: "Sell",
          key: "sell",
          onClick: handleSell,
          title: "Click to sell your position.",
        };

      default:
        return {
          children: "Approve",
          key: "approve",
          onClick: handleApprove,
          title: "Click to approve your position.",
        };
    }
  };

  const disableButton =
    Number(amountToSell) > positionData.totalSize ||
    !Number(amountToSell) ||
    !addresses.user ||
    !addresses.token;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const approved = Boolean(amount && toOpyn(amount).lte(allowance.amount));

    setAmountToSell(amount.split(".")[0]);
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
          addRecentTransaction({ hash, description: "Approval" });
          toast("Transaction approved!");
        }
      }
    } catch (error) {
      setTransactionPending(false);
      captureException(error);
      toast(
        "Sorry, but there was a problem completing your transaction. The team has been informed and we will be looking into it."
      );
    }
  };

  const handleSell = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toRysk(amountToSell);

        const hash = await sell(addresses as AddressesRequired, amount);

        if (hash) {
          setTransactionPending(false);
          addRecentTransaction({ hash, description: "Sale" });
          toast("Sale completed!");
          dispatch({
            type: OptionsTradingActionType.SET_SELL_MODAL_VISIBLE,
            visible: false,
          });
        }
      }
    } catch (error) {
      setTransactionPending(false);
      captureException(error);
      toast(
        "Sorry, but there was a problem completing your transaction. The team has been informed and we will be looking into it."
      );
    }
  };

  return (
    <Modal>
      <Header />
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
            step={1}
            type="number"
            value={amountToSell}
          />
        </label>

        <AnimatePresence mode="wait">
          <Button
            className="w-1/3 !border-0"
            disabled={disableButton}
            requiresConnection
            {...FadeInOut()}
            {...getButtonProps()}
          />
        </AnimatePresence>
      </div>

      <Disclaimer />
    </Modal>
  );
};
