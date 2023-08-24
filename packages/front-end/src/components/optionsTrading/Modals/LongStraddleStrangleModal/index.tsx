import { ChangeEvent } from "react";

import { BigNumber } from "ethers";
import { useState } from "react";
import { useDebounce } from "use-debounce";

import { approveAllowance } from "src/components/shared/utils/transactions/approveAllowance";
import { openLongStraddle } from "src/components/shared/utils/transactions/openLongStraddle";
import { useGlobalContext } from "src/state/GlobalContext";
import { toUSDC, toWei } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { useNotifications } from "../../hooks/useNotifications";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { roundInputValue } from "../Shared/utils/roundNumberValue";
import { Icon } from "./components/Icon";
import { Info } from "./components/Info";
import { Pricing } from "./components/Pricing";
import { useLongStraddle } from "./hooks/useLongStraddle";

export const LongStraddleStrangleModal = () => {
  const {
    state: {
      geoData: { blocked },
      options: { activeExpiry, refresh },
      userTradingPreferences: { approvals },
    },
  } = useGlobalContext();

  const [amountToOpen, setAmountToOpen] = useState("");
  const [selectedStrike, setSelectedStrike] = useState("");
  const [debouncedAmountToOpen] = useDebounce(amountToOpen, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    useLongStraddle(debouncedAmountToOpen, selectedStrike);

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
        const amount = toUSDC(positionData.requiredApproval);

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
        const amount = toWei(amountToOpen);

        const optionSeries = {
          expiration: BigNumber.from(activeExpiry),
          strike: toWei(selectedStrike),
          strikeAsset: addresses.token,
          underlying: getContractAddress("WETH"),
          collateral: addresses.collateral,
        };

        const hash = await openLongStraddle(
          positionData.acceptablePremium,
          amount,
          addresses.exchange,
          optionSeries,
          refresh,
          addresses.user
        );

        if (hash) {
          setTransactionPending(false);
          handleTransactionSuccess(hash, "Purchase");
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  return (
    <Modal>
      <Header>{`Long Straddle`}</Header>

      <div className="flex">
        <Info positionData={positionData} />
        <Icon />
      </div>

      <Pricing
        amount={debouncedAmountToOpen}
        positionData={positionData}
        strikeState={{ selectedStrike, setSelectedStrike }}
      />

      <Wrapper>
        <Label title="Enter how many positions would like to open.">
          <Input
            name="long-straddle"
            onChange={handleChange}
            placeholder="How many would you like to open?"
            value={amountToOpen}
          />
        </Label>

        <Button
          className="w-1/4 !border-0"
          disabled={
            !Number(amountToOpen) ||
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
        {`You are about to make a trade using your USDC balance to pay for the options premium and fees. This strategy will open one PUT and one CALL for each position. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
