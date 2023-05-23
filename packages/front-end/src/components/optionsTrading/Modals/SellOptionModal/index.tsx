import type { ChangeEvent } from "react";

import type { AddressesRequired } from "../Shared/types";

import { BigNumber } from "ethers";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { toRysk, toUSDC, toWei } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { useNotifications } from "../Shared/hooks/useNotifications";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { approveAllowance, sell } from "../Shared/utils/transactions";
import { Filters } from "./components/Filters";
import { Pricing } from "./components/Pricing";
import { Symbol } from "./components/Symbol";
import { useSellOption } from "./hooks/useSellOption";

export const SellOptionModal = () => {
  const {
    state: {
      collateralPreferences,
      options: { activeExpiry, refresh, vaults },
      selectedOption,
    },
    dispatch,
  } = useGlobalContext();

  const [amountToSell, setAmountToSell] = useState("");
  const [debouncedAmountToSell] = useDebounce(amountToSell, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    useSellOption(debouncedAmountToSell);

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");
    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;

    setAmountToSell(rounded);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount =
          collateralPreferences.type === "USDC"
            ? toUSDC(positionData.requiredApproval)
            : toRysk(positionData.requiredApproval);

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
      if (addresses.token && addresses.user && selectedOption) {
        const optionSeries = {
          expiration: BigNumber.from(activeExpiry),
          strike: toWei(selectedOption.strikeOptions.strike.toString()),
          isPut: selectedOption.callOrPut === "put",
          strikeAsset: getContractAddress("USDC"),
          underlying: getContractAddress("WETH"),
          collateral: addresses.token,
        };

        const hash = await sell(
          positionData.acceptablePremium,
          addresses as AddressesRequired,
          toRysk(amountToSell),
          optionSeries,
          refresh,
          vaults,
          collateralPreferences.type === "USDC"
            ? toUSDC(positionData.collateral.toString())
            : toRysk(positionData.collateral.toString())
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
    if (selectedOption) {
      const buyData =
        selectedOption.strikeOptions[selectedOption.callOrPut].buy;

      return buyData.disabled || !buyData.quote.total;
    }
  }, [selectedOption]);

  const handleTutorialClick = () => {
    dispatch({ type: ActionType.SET_SELL_TUTORIAL_INDEX, index: 0 });
  };

  return (
    <Modal>
      <Header
        changeVisible={!disableChangeButton}
        tutorialVisible={handleTutorialClick}
      >
        {`Sell Position`}
      </Header>

      <div className="flex flex-col">
        <Symbol positionData={positionData} />

        <Filters />

        <Pricing
          loading={loading}
          positionData={positionData}
          type={collateralPreferences.type}
        />
      </div>

      <Wrapper>
        <Label
          id="sell-input"
          title="Enter how many contracts you would like to sell."
        >
          <Input
            name="sell-amount"
            onChange={handleAmountChange}
            placeholder="How many would you like to sell?"
            value={amountToSell}
          />
        </Label>

        <Button
          disabled={
            !Number(debouncedAmountToSell) ||
            (collateralPreferences.type === "USDC" &&
              positionData.remainingBalanceUSDC <= 0) ||
            (collateralPreferences.type === "WETH" &&
              positionData.remainingBalanceWETH <= 0) ||
            !positionData.hasRequiredCapital ||
            transactionPending ||
            loading
          }
          id="sell-button"
          {...getButtonProps(
            "sell",
            transactionPending || loading,
            allowance.approved,
            handleApprove,
            handleSell
          )}
        />
      </Wrapper>

      <Disclaimer>
        {`You are about to make a trade using your balance to collateralize the options and receive a USDC premium for the trade. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
