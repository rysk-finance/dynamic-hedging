import type { ChangeEvent } from "react";

import type {
  AddressesRequired,
  AddressesRequiredVaultSell,
} from "../Shared/types";

import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { Button } from "src/components/shared/Button";
import { useGlobalContext } from "src/state/GlobalContext";
import {
  toRysk,
  tFormatUSDC,
  tFormatEth,
  toUSDC,
  toOpyn,
} from "src/utils/conversion-helper";

import { Disclaimer } from "../Shared/components/Disclaimer";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { useNotifications } from "../Shared/hooks/useNotifications";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { approveAllowance, vaultSell } from "../Shared/utils/transactions";
import { Pricing } from "./components/Pricing";
import { useShortPositionData } from "./hooks/useShortPositionData";
import { BigNumber } from "ethers";
import { getContractAddress } from "src/utils/helpers";
import { useDebounce } from "use-debounce";
import { gql, useQuery } from "@apollo/client";
import { QueriesEnum } from "../../../../clients/Apollo/Queries";
import { logError } from "../../../../utils/logError";
import { useAccount } from "wagmi";

dayjs.extend(LocalizedFormat);

export const CloseShortOptionModal = () => {
  const {
    state: {
      options: { refresh },
    },
  } = useGlobalContext();

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const [amountToSell, setAmountToSell] = useState("");
  const [debouncedAmountToSell] = useDebounce(amountToSell, 300);
  const [collateralToRemove, setCollateralToRemove] = useState<BigNumber>(
    BigNumber.from(0)
  );
  const { address } = useAccount();
  const [transactionPending, setTransactionPending] = useState(false);

  const [
    addresses,
    allowance,
    setAllowance,
    positionData,
    collateralAmount,
    collateralPerOption,
    ,
    vaultId,
  ] = useShortPositionData(debouncedAmountToSell);

  // NOTE: Only getting positions opened after redeploy of contracts
  const { data } = useQuery<{
    vaults: {
      vaultId: string;
      collateralAmount: string;
      shortAmount: string;
      shortOToken: {
        id: string;
        symbol: string;
      };
      collateralAsset: {
        name: string;
      };
    }[];
  }>(
    gql`
        query ${QueriesEnum.DASHBOARD_USER_POSITIONS} ($account: String, $amount: String, $token: String) {
          vaults(first: 1, where: { owner: $account, shortAmount_gte: $amount, shortOToken_: {id: $token} }) {
            vaultId
            collateralAmount
            shortAmount
            collateralAsset {
              name
            }
            shortOToken {
              id
              symbol
            }
          }
        }
      `,
    {
      onError: logError,
      variables: {
        account: address?.toLowerCase(),
        amount: toOpyn(debouncedAmountToSell || "0").toString(),
        token: addresses?.token?.toLowerCase(),
      },
      skip: !address || !debouncedAmountToSell || !addresses?.token,
    }
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");

    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;

    const newCollateralToRemove = collateralPerOption
      .mul(10 ** decimals.length * Number(rounded))
      .div(10 ** decimals.length);

    const approved = Boolean(
      amount && newCollateralToRemove.lte(allowance.amount)
    );

    setAmountToSell(rounded);

    setCollateralToRemove(newCollateralToRemove);
    setAllowance((currentState) => ({ ...currentState, approved }));
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.collateral && addresses.user) {
        const amount = toUSDC(positionData.requiredApproval);

        const hash = await approveAllowance(
          {
            ...addresses,
            token: getContractAddress("USDC"),
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

  const handleShortClose = async () => {
    setTransactionPending(true);

    try {
      const vaultId = data?.vaults[0]?.vaultId;
      if (addresses.token && addresses.user && vaultId) {
        const amount = toRysk(amountToSell);

        const hash = await vaultSell(
          positionData.acceptablePremium,
          addresses as AddressesRequiredVaultSell,
          amount,
          refresh,
          collateralToRemove,
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

  const isWeth =
    addresses?.collateral === getContractAddress("WETH").toLowerCase();

  return (
    <Modal>
      <Header>{`Close Position`}</Header>
      <Pricing positionData={positionData} />
      {!collateralToRemove.isZero() &&
        collateralToRemove.lte(collateralAmount) && (
          <div className="flex justify-center mb-5">
            Collateral after: {isWeth ? "Ξ" : "$"}
            {isWeth
              ? tFormatEth(collateralAmount.sub(collateralToRemove))
              : tFormatUSDC(collateralAmount.sub(collateralToRemove))}{" "}
            {isWeth ? "Ξ" : "$"}
            <del>
              {isWeth
                ? tFormatEth(collateralAmount)
                : tFormatUSDC(collateralAmount)}
            </del>
          </div>
        )}
      <div className="flex border-black border-y-2">
        <label
          className="grow"
          title="Enter how much of your position you would like to close."
        >
          <input
            className="text-center w-full h-12 number-input-hide-arrows border-r-2 border-black"
            inputMode="numeric"
            name="sell-amount"
            onChange={handleChange}
            placeholder="How many would you like to close?"
            step={0.01}
            type="number"
            value={amountToSell}
          />
        </label>

        <AnimatePresence mode="wait">
          <Button
            className="w-1/3 !border-0"
            disabled={
              Number(amountToSell) > Math.abs(positionData.totalSize) ||
              !Number(amountToSell) ||
              !addresses.user ||
              !addresses.token ||
              transactionPending
            }
            requiresConnection
            {...FadeInOutQuick}
            {...getButtonProps(
              "close",
              transactionPending,
              allowance.approved,
              handleApprove,
              handleShortClose
            )}
          />
        </AnimatePresence>
      </div>

      <Disclaimer>
        {`You are about to close some or all of your position. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
