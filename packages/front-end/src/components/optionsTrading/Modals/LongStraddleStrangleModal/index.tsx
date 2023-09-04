import type { ModalProps, StrategyStrikesTuple } from "./types";

import { ChangeEvent } from "react";

import { BigNumber } from "ethers";
import { useState } from "react";
import { useDebounce } from "use-debounce";

import { approveAllowance } from "src/components/shared/utils/transactions/approveAllowance";
import { openLongStraddleStrangle } from "src/components/shared/utils/transactions/openLongStraddleStrangle";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { useNotifications } from "../../hooks/useNotifications";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { MAX_TRADE_SIZE, MIN_TRADE_SIZE } from "../Shared/utils/constants";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { roundInputValue } from "../Shared/utils/roundNumberValue";
import { Icon } from "./components/Icon";
import { Info } from "./components/Info";
import { Pricing } from "./components/Pricing";
import { useLongStraddleStrangle } from "./hooks/useLongStraddle";

export const LongStraddleStrangleModal = ({ strategy }: ModalProps) => {
  const {
    state: {
      geoData: { blocked },
      options: { activeExpiry, refresh },
      userTradingPreferences: { approvals },
    },
  } = useGlobalContext();

  const [amountToOpen, setAmountToOpen] = useState("");
  const [selectedStrikes, setSelectedStrikes] = useState<StrategyStrikesTuple>([
    "",
    "",
  ]);
  const [debouncedAmountToOpen] = useDebounce(amountToOpen, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    useLongStraddleStrangle(debouncedAmountToOpen, selectedStrikes);

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rounded = roundInputValue(event);

    setAmountToOpen(rounded);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = Convert.fromStr(positionData.requiredApproval).toUSDC;

        const hash = await approveAllowance(
          addresses.exchange,
          addresses.token,
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

  const handleTransaction = async () => {
    setTransactionPending(true);

    try {
      if (addresses.collateral && addresses.token && addresses.user) {
        const amount = Convert.fromStr(amountToOpen).toWei;

        const optionSeries = {
          expiration: BigNumber.from(activeExpiry),
          strikeAsset: addresses.token,
          underlying: getContractAddress("WETH"),
          collateral: addresses.collateral,
        };

        const hash = await openLongStraddleStrangle(
          positionData.acceptablePremium,
          amount,
          addresses.exchange,
          positionData.exposure,
          optionSeries,
          refresh,
          selectedStrikes,
          addresses.user
        );

        if (hash) {
          setTransactionPending(false);
          handleTransactionSuccess(hash, strategy);
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  return (
    <Modal>
      <Header>{strategy}</Header>

      <div className="flex">
        <Info positionData={positionData} strategy={strategy} />
        <Icon strategy={strategy} />
      </div>

      <Pricing
        positionData={positionData}
        size={debouncedAmountToOpen}
        strategy={strategy}
        strikeState={{
          selectedStrike: selectedStrikes,
          setSelectedStrike: setSelectedStrikes,
        }}
      />

      <Wrapper>
        <Label title="Enter how many positions would like to open.">
          <Input
            name={strategy}
            onChange={handleChange}
            placeholder="How many would you like to open?"
            value={amountToOpen}
          />
        </Label>

        <Button
          className="w-1/4 !border-0"
          disabled={
            !Number(amountToOpen) ||
            Number(amountToOpen) < MIN_TRADE_SIZE ||
            Number(amountToOpen) > MAX_TRADE_SIZE ||
            !addresses.user ||
            positionData.remainingBalance < 0 ||
            transactionPending ||
            loading ||
            blocked
          }
          {...getButtonProps(
            "open",
            transactionPending || loading,
            allowance.approved,
            handleApprove,
            handleTransaction
          )}
        />
      </Wrapper>

      <Disclaimer>
        {`You are about to make a trade using your USDC balance to pay for the options premium and fees. This strategy will open one CALL and one PUT for each position. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
