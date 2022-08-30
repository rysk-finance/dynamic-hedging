import React, { useEffect, useState } from "react";
import { useContract } from "../../hooks/useContract";
import LPABI from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import { BigNumber, utils } from "ethers";
import { gql, useQuery } from "@apollo/client";
import { useWalletContext } from "../../App";
import { useVaultContext } from "../../state/VaultContext";
import { BIG_NUMBER_DECIMALS, DHV_NAME } from "../../config/constants";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { Currency } from "../../types";

type WithdrawAction = {
  amount: number;
  pricePerShare: BigNumber;
};

export const PendingWithdrawBreakdown: React.FC = () => {
  const [lpContract] = useContract({
    contract: "liquidityPool",
    ABI: LPABI.abi,
    readOnly: true,
  });

  const {
    state: { withdrawalEpoch: currentWithdrawalEpoch },
  } = useVaultContext();
  const { account } = useWalletContext();

  const [withdrawAction, setWithdrawAction] = useState<
    (Omit<WithdrawAction, "pricePerShare"> | WithdrawAction) | null
  >(null);

  // Fetch actions that ocurred after the most recent redeem (unredeemed actions)
  // that have also had their epoch price calculated (aren't on hold).
  useQuery(
    gql`
      query {
        initiateWithdrawActions(
          where: { address: "${account}" }
          orderBy: timestamp
          orderDirection: desc
          first: 1
        ) {
          amount
        }
      }
    `,
    {
      onCompleted: (data) => {
        if (data.initiateWithdrawActions && data.initiateWithdrawActions[0]) {
          setWithdrawAction(data.initiateWithdrawActions[0]);
        }
      },
      onError: (err) => {
        console.error(err);
      },
      skip: !account,
    }
  );

  useEffect(() => {
    // If we haven't fetched the prices from chain yet.
    if (
      withdrawAction &&
      !("pricePerShare" in withdrawAction) &&
      currentWithdrawalEpoch
    ) {
      const getPrice = async (
        action: Omit<WithdrawAction, "pricePerShare">
      ) => {
        const pricePerShare = await lpContract?.withdrawalEpochPricePerShare(
          currentWithdrawalEpoch?.sub(1)
        );
        setWithdrawAction({
          ...action,
          pricePerShare,
        });
      };

      getPrice(withdrawAction);
    }
  }, [withdrawAction, lpContract, currentWithdrawalEpoch]);

  return (
    <div className="text-xs text-right">
      {withdrawAction && (
        <p key={withdrawAction.amount}>
          {utils.formatUnits(BigNumber.from(withdrawAction.amount))} {DHV_NAME}{" "}
          @{" "}
          <BigNumberDisplay currency={Currency.RYSK}>
            {"pricePerShare" in withdrawAction
              ? withdrawAction.pricePerShare
              : BigNumber.from(0)}
          </BigNumberDisplay>{" "}
          USDC per {DHV_NAME}
        </p>
      )}
    </div>
  );
};
