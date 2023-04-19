import { Header } from "../Shared/components/Header";
import { useSearchParams } from "react-router-dom";
import NumberFormat from "react-number-format";
import { ethers } from "ethers";
import { DECIMALS } from "src/config/constants";
import { getContractAddress } from "src/utils/helpers";
import { toWei, toUSDC } from "src/utils/conversion-helper";
import { ChangeEvent, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "src/components/shared/Button";
import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { useAccount } from "wagmi";
import { updateCollateral } from "../Shared/utils/transactions";
import { ActionType } from "src/state/types";
import { useGlobalContext } from "src/state/GlobalContext";

import { useNotifications } from "src/components/optionsTrading/Modals/Shared/hooks/useNotifications";
import { getButtonProps } from "src/components/optionsTrading/Modals/Shared/utils/getButtonProps";
import { approveAllowance } from "src/components/optionsTrading/Modals/Shared/utils/transactions";
import { AddressesRequired } from "src/components/optionsTrading/Modals/Shared/types";
import { Disclaimer } from "src/components/optionsTrading/Modals/Shared/components/Disclaimer";
import { Modal } from "src/components/optionsTrading/Modals/Shared/components/Modal";
import { useAllowance } from "src/components/optionsTrading/Modals/Shared/hooks/useAllowance";
import { useShortPositionData } from "src/components/optionsTrading/Modals/CloseShortOptionModal/hooks/useShortPositionData";

const AdjustCollateralModal = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const USDCAddress = getContractAddress("USDC");
  const WETHAddress = getContractAddress("WETH");

  const { dispatch } = useGlobalContext();

  const { address } = useAccount();

  const [, , , , collateralAmount, collateralPerOption, collateralAsset] =
    useShortPositionData("");

  const [notifyApprovalSuccess, , notifyFailure] = useNotifications();

  const isWETHVault = collateralAsset === WETHAddress.toLowerCase();

  // User allowance state for USDC.
  const [allowance, setAllowance] = useAllowance(
    isWETHVault ? WETHAddress : USDCAddress,
    address
  );

  const [isWithdrawCollateral, setIsWithdrawCollateral] = useState(false);
  const [newCollateralAmount, setNewCollateralAmount] = useState("");
  const [transactionPending, setTransactionPending] = useState(false);

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (collateralAsset && address) {
        const amount = isWETHVault
          ? toWei(newCollateralAmount)
          : toUSDC(newCollateralAmount);

        const hash = await approveAllowance(
          {
            token: collateralAsset,
            user: address,
            exchange: getContractAddress("optionExchange"),
          } as AddressesRequired,
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

  const handleCollateralUpdate = async () => {
    setTransactionPending(true);

    try {
      if (collateralAsset && address) {
        const amount = isWETHVault
          ? toWei(newCollateralAmount)
          : toUSDC(newCollateralAmount);

        const hash = await updateCollateral(
          {
            token: collateralAsset,
            user: address,
            exchange: getContractAddress("optionExchange"),
          } as AddressesRequired,

          amount,
          searchParams.get("vault") as string,
          isWithdrawCollateral
        );

        if (hash) {
          setTransactionPending(false);
          dispatch({
            type: ActionType.SET_DASHBOARD_MODAL_VISIBLE,
          });
          setSearchParams({});
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");
    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;

    setNewCollateralAmount(rounded);
  };

  const handleAddOrRemove = (event: ChangeEvent<HTMLSelectElement>) => {
    setIsWithdrawCollateral(event.currentTarget.value === "REMOVE");
  };

  return (
    <Modal>
      <Header>{`Adjust Collateral`}</Header>
      <div className="flex flex-col">
        <div className="w-3/5 mx-auto py-4">
          <p>Current:</p>
          {collateralAmount && (
            <NumberFormat
              value={ethers.utils.formatUnits(
                collateralAmount,
                isWETHVault ? DECIMALS.RYSK : DECIMALS.USDC
              )}
              displayType={"text"}
              prefix={isWETHVault ? "Ξ " : "$ "}
              decimalScale={2}
              thousandSeparator={true}
            />
          )}
        </div>
      </div>

      <div className="flex border-black border-y-2">
        <select onChange={handleAddOrRemove}>
          <option>ADD</option>
          <option>REMOVE</option>
        </select>
        <label
          className="grow"
          title="Enter how many contracts you would like to buy."
        >
          <input
            className="text-center w-full h-12 number-input-hide-arrows border-r-2 border-black"
            inputMode="numeric"
            name="collateral-amount"
            onChange={handleChange}
            placeholder="How many would you like to add or remove?"
            step={0.01}
            type="number"
            value={newCollateralAmount}
          />
        </label>

        <AnimatePresence mode="wait">
          <Button
            className="w-1/3 !border-0"
            disabled={!Number(newCollateralAmount) || transactionPending}
            requiresConnection
            {...FadeInOutQuick}
            {...getButtonProps(
              "update",
              transactionPending,
              allowance.approved,
              handleApprove,
              handleCollateralUpdate
            )}
          />
        </AnimatePresence>
      </div>
      <Disclaimer>
        {`You are about to change the collateral amount of one of your vaults. Please ensure this is what you want.`}
      </Disclaimer>
    </Modal>
  );
};

export default AdjustCollateralModal;
