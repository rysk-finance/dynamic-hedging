import type { ChangeEvent } from "react";

import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useDebounce } from "use-debounce";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { approveAllowance } from "src/components/shared/utils/transactions/approveAllowance";
import { closeLong } from "src/components/shared/utils/transactions/closeLong";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
import { toOpyn } from "src/utils/conversion-helper";
import { useNotifications } from "../../hooks/useNotifications";
import { Disclaimer } from "../Shared/components/Disclaimer";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Wrapper,
} from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { MAX_TRADE_SIZE, MIN_TRADE_SIZE } from "../Shared/utils/constants";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { roundInputValue } from "../Shared/utils/roundNumberValue";
import { Pricing } from "./components/Pricing";
import { usePositionData } from "./hooks/usePositionData";

dayjs.extend(LocalizedFormat);

export const CloseOptionModal = () => {
  const {
    state: {
      geoData: { blocked },
      options: { refresh },
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const [amountToClose, setAmountToClose] = useState("");
  const [debouncedAmountToClose] = useDebounce(amountToClose, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    usePositionData(debouncedAmountToClose);

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleCloseMax = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.checked) {
      setAmountToClose(positionData.totalSize.toString());
    } else {
      setAmountToClose("");
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rounded = roundInputValue(event);

    const maxAmount = Math.min(
      positionData.totalSize,
      parseFloat(rounded || "0")
    );

    setAmountToClose((maxAmount ? maxAmount : rounded).toString());
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toOpyn(amountToClose);

        const hash = await approveAllowance(
          addresses.exchange,
          addresses.token,
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
        const amount = Convert.fromStr(amountToClose).toWei;

        const hash = await closeLong(
          positionData.acceptablePremium,
          amount,
          addresses.exchange,
          refresh,
          addresses.token,
          addresses.user
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
      <Pricing positionData={positionData} size={amountToClose} />
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

        <RyskTooltip
          content="Use this toggle to sell your entire position."
          disabled={!tutorialMode}
          placement="top"
        >
          <span className="flex">
            <Label className="flex items-center justify-center select-none cursor-pointer w-min border-black border-r-2 px-2">
              <Checkbox
                checked={amountToClose === positionData.totalSize.toString()}
                name="close-max"
                onChange={handleCloseMax}
              />
              {`Max`}
            </Label>
          </span>
        </RyskTooltip>

        <AnimatePresence mode="wait">
          <Button
            className="w-1/4 !border-0"
            disabled={
              Number(amountToClose) > positionData.totalSize ||
              !Number(amountToClose) ||
              Number(amountToClose) < MIN_TRADE_SIZE ||
              Number(amountToClose) > MAX_TRADE_SIZE ||
              !addresses.user ||
              !addresses.token ||
              transactionPending ||
              loading ||
              blocked
            }
            {...FadeInOutQuick}
            {...getButtonProps(
              "sell",
              transactionPending || loading,
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
