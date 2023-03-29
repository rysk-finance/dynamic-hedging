import { ChangeEvent } from "react";

import type { AddressesRequired } from "../Shared/types";

import { useAddRecentTransaction } from "@rainbow-me/rainbowkit";
import { captureException } from "@sentry/react";
import { BigNumber } from "ethers";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { toast } from "react-toastify";
import { useDebounce } from "use-debounce";

import FadeInOut from "src/animation/FadeInOut";
import { Button } from "src/components/shared/Button";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { useGlobalContext } from "src/state/GlobalContext";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";
import { toRysk, toUSDC, toWei } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { toTwoDecimalPlaces } from "src/utils/rounding";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { approveAllowance, buy } from "../Shared/utils/transactions";
import { useBuyOption } from "./hooks/useBuyOption";

export const BuyOptionModal = () => {
  const addRecentTransaction = useAddRecentTransaction();

  const {
    state: {
      options: { activeExpiry, refresh },
    },
  } = useGlobalContext();

  const {
    state: { selectedOption },
    dispatch,
  } = useOptionsTradingContext();

  const [amountToBuy, setAmountToBuy] = useState("");
  const [debouncedAmountToBuy] = useDebounce(amountToBuy, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [
    addresses,
    allowance,
    setAllowance,
    {
      callOrPut,
      expiry,
      fee,
      now,
      premium,
      quote,
      remainingBalance,
      requiredApproval,
      strike,
    },
    loading,
  ] = useBuyOption(debouncedAmountToBuy);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputAmount = toTwoDecimalPlaces(Number(event.currentTarget.value));
    setAmountToBuy(inputAmount.toString());
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toUSDC(requiredApproval);

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

  const handleBuy = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user && selectedOption) {
        const amount = toRysk(amountToBuy);
        const optionSeries = {
          expiration: BigNumber.from(activeExpiry),
          strike: toWei(selectedOption.strikeOptions.strike.toString()),
          isPut: selectedOption.callOrPut === "put",
          strikeAsset: addresses.token,
          underlying: getContractAddress("WETH"),
          collateral: addresses.token,
        };

        const hash = await buy(
          addresses as AddressesRequired,
          amount,
          optionSeries,
          refresh
        );

        if (hash) {
          setTransactionPending(false);
          addRecentTransaction({ hash, description: "Purchase" });
          toast("Purchase completed!");
          dispatch({
            type: OptionsTradingActionType.RESET,
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
      <Header>{`Buy Position`}</Header>

      <div className="flex flex-col">
        <p className="text-center py-4 bg-white border-b-2 border-black font-dm-mono">
          {`ETH ${expiry} $${strike} ${callOrPut}`.toUpperCase()}
        </p>

        <div className="w-3/5 mx-auto py-4">
          <span className="flex">
            <p className="mr-auto">{`Premium:`}</p>
            <p className="font-medium">
              {`$ `}
              <RyskCountUp value={premium} />
            </p>
          </span>

          <span className="flex pb-2 border-gray-600 border-b">
            <p className="mr-auto">{`Fee:`}</p>
            <p className="font-medium">
              {`$ `}
              <RyskCountUp value={fee} />
            </p>
          </span>

          <span className="flex py-2 border-gray-600 border-b">
            <p className="mr-auto">{`Total to pay:`}</p>
            <p className="font-medium">
              {`$ `}
              <RyskCountUp value={quote} />
            </p>
          </span>

          <span className="flex pt-2">
            <p className="mr-auto">{`Balance after:`}</p>
            <p className="font-medium">
              {`$ `}
              <RyskCountUp value={remainingBalance} />
            </p>
          </span>
        </div>

        <small className="pb-4 text-center leading-6 text-gray-600">{`Last updated: ${now}`}</small>
      </div>

      <div className="flex border-black border-y-2">
        <label
          className="grow"
          title="Enter how many contracts you would like to buy."
        >
          <input
            className="text-center w-full h-12 number-input-hide-arrows border-r-2 border-black"
            inputMode="numeric"
            name="sell-amount"
            onChange={handleChange}
            placeholder="How many would you like to buy?"
            step={0.01}
            type="number"
            value={amountToBuy}
          />
        </label>

        <AnimatePresence mode="wait">
          <Button
            className="w-1/3 !border-0"
            disabled={
              !Number(amountToBuy) ||
              !addresses.user ||
              remainingBalance < 0 ||
              transactionPending ||
              loading
            }
            requiresConnection
            {...FadeInOut()}
            {...getButtonProps(
              "buy",
              transactionPending || loading,
              allowance.approved,
              handleApprove,
              handleBuy
            )}
          />
        </AnimatePresence>
      </div>

      <Disclaimer>
        {`You are about to make a purchase which will consume your USDC balance. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
