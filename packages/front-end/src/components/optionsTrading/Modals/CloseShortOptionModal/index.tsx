import type { ChangeEvent } from "react";

import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { useGlobalContext } from "src/state/GlobalContext";
import { toRysk, toUSDC } from "src/utils/conversion-helper";

import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { approveAllowance } from "src/components/shared/utils/transactions/approveAllowance";
import { closeShort } from "src/components/shared/utils/transactions/closeShort";
import { getContractAddress } from "src/utils/helpers";
import { useDebounce } from "use-debounce";
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
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { roundInputValue } from "../Shared/utils/roundNumberValue";
import { Pricing } from "./components/Pricing";
import { useShortPositionData } from "./hooks/useShortPositionData";

dayjs.extend(LocalizedFormat);

export const CloseShortOptionModal = () => {
  const {
    state: {
      geoData: { blocked },
      options: { refresh },
      userTradingPreferences: { approvals, tutorialMode },
    },
  } = useGlobalContext();

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const [amountToSell, setAmountToSell] = useState("");
  const [debouncedAmountToSell] = useDebounce(amountToSell, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, vaultId, loading] =
    useShortPositionData(debouncedAmountToSell);

  const handleCloseMax = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.checked) {
      setAmountToSell(positionData.totalSize.toString());
    } else {
      setAmountToSell("");
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rounded = roundInputValue(event);

    setAmountToSell(rounded);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.collateral && addresses.user) {
        const amount = toUSDC(positionData.requiredApproval);

        const hash = await approveAllowance(
          addresses.exchange,
          getContractAddress("USDC"),
          amount,
          approvals
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

        const hash = await closeShort(
          positionData.acceptablePremium,
          amount,
          addresses.exchange,
          addresses.collateral!,
          positionData.collateralToRemove,
          refresh,
          addresses.token,
          addresses.user,
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
        <Label title="Enter how much of your position you would like to close.">
          <Input
            name="sell-amount"
            onChange={handleChange}
            placeholder="How many would you like to close?"
            value={amountToSell}
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
                checked={amountToSell === positionData.totalSize.toString()}
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
              !Number(debouncedAmountToSell) ||
              Number(debouncedAmountToSell) > positionData.totalSize ||
              !addresses.token ||
              !positionData.hasRequiredCapital ||
              transactionPending ||
              loading ||
              blocked
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
