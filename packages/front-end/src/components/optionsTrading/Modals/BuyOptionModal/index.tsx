import { ChangeEvent } from "react";

import { BigNumber } from "ethers";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";

import { approveAllowance } from "src/components/shared/utils/transactions/approveAllowance";
import { buy } from "src/components/shared/utils/transactions/buy";
import { useGlobalContext } from "src/state/GlobalContext";
import { toRysk, toUSDC, toWei } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { useNotifications } from "../../hooks/useNotifications";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { MAX_TRADE_SIZE, MIN_TRADE_SIZE } from "../Shared/utils/constants";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { roundInputValue } from "../Shared/utils/roundNumberValue";
import { Pricing } from "./components/Pricing";
import { useBuyOption } from "./hooks/useBuyOption";

export const BuyOptionModal = () => {
  const {
    state: {
      geoData: { blocked },
      options: { activeExpiry, refresh },
      selectedOption,
      userTradingPreferences: { approvals },
    },
  } = useGlobalContext();

  const [amountToBuy, setAmountToBuy] = useState("");
  const [debouncedAmountToBuy] = useDebounce(amountToBuy, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    useBuyOption(debouncedAmountToBuy);

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rounded = roundInputValue(event);

    setAmountToBuy(rounded);
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

  const handleBuy = async () => {
    setTransactionPending(true);

    try {
      if (
        addresses.collateral &&
        addresses.token &&
        addresses.user &&
        selectedOption
      ) {
        const amount = toRysk(amountToBuy);

        const optionSeries = {
          expiration: BigNumber.from(activeExpiry),
          strike: toWei(selectedOption.strikeOptions.strike.toString()),
          isPut: selectedOption.callOrPut === "put",
          strikeAsset: addresses.token,
          underlying: getContractAddress("WETH"),
          collateral: addresses.collateral,
        };

        const hash = await buy(
          positionData.acceptablePremium,
          amount,
          addresses.exchange,
          positionData.exposure,
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

  const disableChangeButton = useMemo(() => {
    const isPut = selectedOption?.callOrPut === "put";

    if (selectedOption && isPut && selectedOption.strikeOptions.put) {
      const sellData = selectedOption.strikeOptions.put.sell;

      return sellData.disabled || !sellData.quote.total;
    }

    if (selectedOption && !isPut && selectedOption.strikeOptions.call) {
      const sellData = selectedOption.strikeOptions.call.sell;

      return sellData.disabled || !sellData.quote.total;
    } else {
      return true;
    }
  }, [selectedOption]);

  return (
    <Modal>
      <Header changeVisible={!disableChangeButton}>{`Buy Position`}</Header>

      <Pricing positionData={positionData} size={amountToBuy} />

      <Wrapper>
        <Label title="Enter how many contracts you would like to buy.">
          <Input
            name="buy-amount"
            onChange={handleChange}
            placeholder="How many would you like to buy?"
            value={amountToBuy}
          />
        </Label>

        <Button
          className="w-1/4 !border-0"
          disabled={
            !Number(amountToBuy) ||
            Number(amountToBuy) < MIN_TRADE_SIZE ||
            Number(amountToBuy) > MAX_TRADE_SIZE ||
            !addresses.user ||
            positionData.remainingBalance < 0 ||
            transactionPending ||
            loading ||
            blocked
          }
          {...getButtonProps(
            "buy",
            transactionPending || loading,
            allowance.approved,
            handleApprove,
            handleBuy
          )}
        />
      </Wrapper>

      <Disclaimer>
        {`You are about to make a trade using your USDC balance to pay for the options premium and fees. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
