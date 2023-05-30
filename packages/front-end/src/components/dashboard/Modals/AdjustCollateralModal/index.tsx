import { Header } from "../Shared/components/Header";
import { useSearchParams } from "react-router-dom";
import NumberFormat from "react-number-format";
import { BigNumber, ethers } from "ethers";
import { DECIMALS } from "src/config/constants";
import { getContractAddress } from "src/utils/helpers";
import {
  toWei,
  toUSDC,
  fromOpyn,
  fromUSDC,
  fromWei,
} from "src/utils/conversion-helper";
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
import { getLiquidationPrice } from "src/components/optionsTrading/Modals/Shared/utils/getLiquidationPrice";
import { useDebouncedCallback } from "use-debounce";

const calculateNewCollateralAmount = (
  symbol: "USDC" | "WETH",
  collateral: BigNumber,
  amount: string,
  isWithdraw: boolean
) => {
  const newCollateralAmount = isWithdraw ? -amount : amount;
  return (
    Number(symbol === "USDC" ? fromUSDC(collateral) : fromWei(collateral)) +
    Number(newCollateralAmount)
  );
};
const AdjustCollateralModal = () => {
  const [, setSearchParams] = useSearchParams();

  const {
    state: {
      ethPrice,
      options: { refresh, spotShock, timesToExpiry },
      dashboard: { modalPosition },
    },
    dispatch,
  } = useGlobalContext();
  const { address } = useAccount();
  const [notifyApprovalSuccess, , notifyFailure] = useNotifications();

  // state current position data
  const collateralAmount = BigNumber.from(modalPosition?.collateralAmount || 0);
  const liquidationPrice = modalPosition?.liquidationPrice || 0;
  const oTokenAmount = modalPosition?.amount || 0;
  const isPut = modalPosition?.isPut;
  const collateralAssetSymbol =
    modalPosition?.collateralAsset === "USDC" ? "USDC" : "WETH";
  const expiryTimestamp = modalPosition?.expiryTimestamp || "0";
  const strikePrice = modalPosition?.strikePrice || "0";
  const vaultId = modalPosition?.vaultId || "0";

  const isWETHVault = collateralAssetSymbol === "WETH";

  // User allowance state for USDC.
  const [allowance, setAllowance] = useAllowance(
    getContractAddress(collateralAssetSymbol),
    address
  );

  const [isWithdrawCollateral, setIsWithdrawCollateral] = useState(false);
  const [newCollateralAmount, setNewCollateralAmount] = useState("");
  const [transactionPending, setTransactionPending] = useState(false);
  const [newLiquidationPrice, setNewLiquidationPrice] = useState(0);

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (collateralAssetSymbol && address) {
        const amount = isWETHVault
          ? toWei(newCollateralAmount)
          : toUSDC(newCollateralAmount);

        const hash = await approveAllowance(
          {
            token: getContractAddress(collateralAssetSymbol),
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
      if (collateralAssetSymbol && address && vaultId) {
        const amount = isWETHVault
          ? toWei(newCollateralAmount)
          : toUSDC(newCollateralAmount);

        const hash = await updateCollateral(
          {
            token: getContractAddress(collateralAssetSymbol),
            user: address,
            exchange: getContractAddress("optionExchange"),
          } as AddressesRequired,
          amount,
          vaultId,
          isWithdrawCollateral,
          refresh
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

  const handleChange = useDebouncedCallback(async (value: string) => {
    const amount = value;
    const decimals = amount.split(".");
    const rounded =
      decimals.length > 1 ? `${decimals[0]}.${decimals[1].slice(0, 2)}` : value;

    setNewCollateralAmount(rounded);

    const liquidationPrice = await getLiquidationPrice(
      Number(fromOpyn(oTokenAmount)),
      isPut ? "put" : "call",
      calculateNewCollateralAmount(
        collateralAssetSymbol,
        collateralAmount,
        rounded,
        isWithdrawCollateral
      ),

      getContractAddress(collateralAssetSymbol) as HexString,
      ethPrice || 0,
      Number(expiryTimestamp),
      spotShock,
      Number(fromOpyn(strikePrice)),
      timesToExpiry
    );

    setNewLiquidationPrice(liquidationPrice);
  }, 1000);

  const handleAddOrRemove = (event: ChangeEvent<HTMLSelectElement>) => {
    setIsWithdrawCollateral(event.currentTarget.value === "REMOVE");
  };

  return (
    <Modal>
      <Header>{`Adjust Collateral`}</Header>
      <div className="flex flex-col">
        <div className="w-3/5 mx-auto py-4">
          <p>Collateral:</p>
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
              renderText={(value) => (
                <p className={`${newCollateralAmount ? "line-through" : ""}`}>
                  {value}
                </p>
              )}
            />
          )}
          {newCollateralAmount && (
            <NumberFormat
              value={
                Number(
                  ethers.utils.formatUnits(
                    collateralAmount,
                    isWETHVault ? DECIMALS.RYSK : DECIMALS.USDC
                  )
                ) +
                Number(
                  isWithdrawCollateral
                    ? "-" + newCollateralAmount
                    : newCollateralAmount
                )
              }
              displayType={"text"}
              prefix={isWETHVault ? "Ξ " : "$ "}
              decimalScale={2}
              thousandSeparator={true}
              renderText={(value) => <p>{value}</p>}
            />
          )}
        </div>
        <div className="w-3/5 mx-auto pb-4">
          <p>Liquidation price:</p>
          {liquidationPrice && (
            <NumberFormat
              value={liquidationPrice}
              displayType={"text"}
              prefix={isWETHVault ? "Ξ " : "$ "}
              decimalScale={2}
              thousandSeparator={true}
              renderText={(value) => (
                <p className={`${newCollateralAmount ? "line-through" : ""}`}>
                  {value}
                </p>
              )}
            />
          )}
          {newCollateralAmount && (
            <NumberFormat
              value={newLiquidationPrice}
              displayType={"text"}
              prefix={isWETHVault ? "Ξ " : "$ "}
              decimalScale={2}
              thousandSeparator={true}
              renderText={(value) => <p>{value}</p>}
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
          title="Enter how much you'd like to add or remove."
        >
          <input
            className="text-center w-full h-12 number-input-hide-arrows border-r-2 border-black"
            inputMode="numeric"
            name="collateral-amount"
            onChange={(e) => handleChange(e.target.value)}
            placeholder="How much would you like to add or remove?"
            step={0.01}
            type="number"
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
