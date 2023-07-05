import type { ChangeEvent } from "react";

import type { AddressesRequired } from "../Shared/types";

import { useState } from "react";
import { useDebounce } from "use-debounce";

import { useGlobalContext } from "src/state/GlobalContext";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { useCollateralData } from "./hooks/useCollateralData";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import {
  approveAllowance,
  updateCollateral,
} from "../Shared/utils/transactions";
import { useNotifications } from "../../hooks/useNotifications";
import { toUSDC, toWei } from "src/utils/conversion-helper";
import { Pricing } from "./components/Pricing";
import { Symbol } from "./components/Symbol";
import { Toggle } from "./components/Toggle";

export const AdjustCollateralModal = () => {
  const {
    state: {
      adjustingOption,
      options: { refresh },
    },
  } = useGlobalContext();

  const [amountToAdjust, setAmountToAdjust] = useState("");
  const [debouncedAmountToSell] = useDebounce(amountToAdjust, 300);
  const [transactionPending, setTransactionPending] = useState(false);
  const [isDepositing, setIsDepositing] = useState(true);

  const [addresses, allowance, setAllowance, collateralData, loading] =
    useCollateralData(debouncedAmountToSell, isDepositing);

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");
    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;

    setAmountToAdjust(rounded);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (adjustingOption && addresses.token && addresses.user) {
        const amount =
          adjustingOption.asset === "USDC"
            ? toUSDC(collateralData.requiredApproval)
            : toWei(collateralData.requiredApproval);

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

  const handleUpdate = async () => {
    setTransactionPending(true);

    try {
      if (adjustingOption && addresses.user && addresses.token) {
        const amount =
          adjustingOption.asset === "USDC"
            ? toUSDC(collateralData.requiredApproval)
            : toWei(collateralData.requiredApproval);

        const hash = await updateCollateral(
          {
            token: addresses.token,
            user: addresses.user,
            exchange: addresses.exchange,
          },
          amount,
          isDepositing,
          refresh,
          adjustingOption.vault.vaultId
        );

        if (hash) {
          setTransactionPending(false);
          handleTransactionSuccess(hash, "Update");
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  return (
    <Modal>
      <Header>{`Adjust Collateral`}</Header>

      <div className="flex flex-col">
        <Symbol series={collateralData.series} />

        <Toggle depositToggleState={{ isDepositing, setIsDepositing }} />

        <Pricing collateralData={collateralData} />
      </div>

      <Wrapper>
        <Label
          id="adjust-collateral"
          title={`Enter how much collateral you would like to ${
            isDepositing ? "add" : "remove"
          }.`}
        >
          <Input
            name="adjust-collateral"
            onChange={handleChange}
            placeholder={`How much would you like to ${
              isDepositing ? "add" : "remove"
            }?`}
            value={amountToAdjust}
          />
        </Label>

        <Button
          className="w-1/4 !border-0"
          disabled={
            !Number(amountToAdjust) ||
            !collateralData.hasRequiredCapital ||
            collateralData.disabled ||
            !addresses.user ||
            transactionPending ||
            loading
          }
          id="buy-button"
          {...getButtonProps(
            "update",
            transactionPending || loading,
            allowance.approved,
            handleApprove,
            handleUpdate
          )}
        />
      </Wrapper>

      <Disclaimer>
        {`You are about to adjust the collateral for this position. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
