import type { ChangeEvent } from "react";

import { BigNumber } from "ethers";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { approveAllowance } from "src/components/shared/utils/transactions/approveAllowance";
import { closeSpread } from "src/components/shared/utils/transactions/closeSpread";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
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
import { MAX_TRADE_SIZE, MIN_TRADE_SIZE } from "../Shared/utils/constants";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { roundInputValue } from "../Shared/utils/roundNumberValue";
import { Pricing } from "./components/Pricing";
import { useShortPositionData } from "./hooks/useCloseSpread";

export const CloseSpreadModal = () => {
  const {
    state: {
      geoData: { blocked },
      options: { activeExpiry, refresh },
      userTradingPreferences: { approvals, tutorialMode },
    },
  } = useGlobalContext();

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const [amountToSell, setAmountToSell] = useState("");
  const [debouncedAmountToSell] = useDebounce(amountToSell, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [
    addresses,
    approvedUSDC,
    approvedOToken,
    setAllowanceUSDC,
    setAllowanceOToken,
    positionData,
    vaultId,
    loading,
  ] = useShortPositionData(debouncedAmountToSell);

  const handleCloseMax = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.checked) {
      setAmountToSell(Convert.fromInt(positionData.totalSize).toStr());
    } else {
      setAmountToSell("");
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rounded = roundInputValue(event);

    const maxAmount = Math.min(
      positionData.totalSize,
      parseFloat(rounded || "0")
    );

    setAmountToSell((maxAmount ? maxAmount : rounded).toString());
  };

  const [shortOTokenAddress, longOTokenAddress] = addresses.token;

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.collateral && longOTokenAddress && addresses.user) {
        if (!approvedUSDC) {
          const requiredUSDC = Convert.fromStr(
            positionData.requiredApproval
          ).toUSDC();

          const hash = await approveAllowance(
            addresses.exchange,
            addresses.collateral,
            requiredUSDC,
            approvals
          );

          if (hash) {
            setAllowanceUSDC({ approved: true, amount: requiredUSDC });
            setTransactionPending(false);
            notifyApprovalSuccess(hash);
          }
        }

        if (!approvedOToken) {
          const requiredOToken = Convert.fromStr(amountToSell).toOpyn();

          const hash = await approveAllowance(
            addresses.marginPool,
            longOTokenAddress,
            requiredOToken
          );

          if (hash) {
            setAllowanceOToken({ approved: true, amount: requiredOToken });
            setTransactionPending(false);
            notifyApprovalSuccess(hash);
          }
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  const handleSpreadClose = async () => {
    setTransactionPending(true);

    try {
      if (
        addresses.collateral &&
        shortOTokenAddress &&
        longOTokenAddress &&
        addresses.user &&
        positionData.strikes &&
        vaultId
      ) {
        const amount = Convert.fromStr(amountToSell).toWei();

        const optionSeries = {
          expiration: BigNumber.from(activeExpiry),
          strikeAsset: addresses.collateral,
          underlying: getContractAddress("WETH"),
          collateral: addresses.collateral,
          isPut: positionData.isPut,
        };

        const hash = await closeSpread(
          positionData.acceptablePremium,
          amount,
          positionData.collateralToRemove,
          addresses.collateral,
          addresses.exchange,
          positionData.exposure,
          longOTokenAddress,
          positionData.operation,
          optionSeries,
          refresh,
          shortOTokenAddress,
          positionData.strikes,
          addresses.user,
          BigNumber.from(vaultId)
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
      <Header>{`Close Spread`}</Header>

      <Pricing positionData={positionData} size={amountToSell} />

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
                checked={
                  amountToSell ===
                  Convert.fromInt(positionData.totalSize).toStr()
                }
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
              !Number(amountToSell) ||
              Number(amountToSell) < MIN_TRADE_SIZE ||
              Number(amountToSell) > MAX_TRADE_SIZE ||
              Number(amountToSell) > positionData.totalSize ||
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
              [approvedUSDC, approvedOToken],
              handleApprove,
              handleSpreadClose
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
