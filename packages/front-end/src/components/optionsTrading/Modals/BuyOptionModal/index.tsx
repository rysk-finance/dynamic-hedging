import { ChangeEvent } from "react";

import type { AddressesRequired } from "../Shared/types";

import { BigNumber } from "ethers";
import { useState } from "react";
import { useDebounce } from "use-debounce";

import { useGlobalContext } from "src/state/GlobalContext";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { toRysk, toUSDC, toWei } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { useNotifications } from "../Shared/hooks/useNotifications";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { approveAllowance, buy } from "../Shared/utils/transactions";
import { Pricing } from "./components/Pricing";
import { useBuyOption } from "./hooks/useBuyOption";

export const BuyOptionModal = () => {
  const {
    state: {
      options: { activeExpiry, refresh },
    },
  } = useGlobalContext();

  const {
    state: { selectedOption },
  } = useOptionsTradingContext();

  const [amountToBuy, setAmountToBuy] = useState("");
  const [debouncedAmountToBuy] = useDebounce(amountToBuy, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    useBuyOption(debouncedAmountToBuy);

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");
    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;

    setAmountToBuy(rounded);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toUSDC(positionData.requiredApproval);

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
      <Header>{`Buy Position`}</Header>

      <Pricing positionData={positionData} />

      <Wrapper>
        <Label title="Enter how many contracts you would like to buy.">
          <Input
            name="sell-amount"
            onChange={handleChange}
            placeholder="How many would you like to buy?"
            value={amountToBuy}
          />
        </Label>

        <Button
          className="w-1/3 !border-0"
          disabled={
            !Number(amountToBuy) ||
            !addresses.user ||
            positionData.remainingBalance < 0 ||
            transactionPending ||
            loading
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
