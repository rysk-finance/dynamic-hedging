import { gql, useQuery } from "@apollo/client";
import { BigNumber } from "ethers";
import React, { useEffect, useMemo, useState } from "react";
import { useWalletContext } from "../../App";
import LPABI from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import { DHV_NAME } from "../../config/constants";
import { useContract } from "../../hooks/useContract";
import { useVaultContext } from "../../state/VaultContext";
import { Currency } from "../../types";
import { BigNumberDisplay } from "../BigNumberDisplay";

type WithdrawAction = {
  amount: number;
  epoch: number;
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

  const [latestCompleteWithdrawTimestamp, setLatestCompleteWithdrawTimestamp] =
    useState<string | null>(null);

  const [initiateWithdrawActions, setInitiateWithdrawActions] = useState<
    (Omit<WithdrawAction, "pricePerShare">[] | WithdrawAction[]) | null
  >(null);

  useQuery(
    gql`
    query {
      withdrawActions(
        where: { address: "${account}" }
        orderBy: timestamp
        orderDirection: desc
        first: 1
      ) {
        timestamp
      }
    }
  `,
    {
      onCompleted: (data) => {
        if (data.withdrawActions && data.withdrawActions[0]) {
          setLatestCompleteWithdrawTimestamp(data.withdrawActions[0].timestamp);
        } else {
          setLatestCompleteWithdrawTimestamp("0");
        }
      },
    }
  );

  useQuery(
    gql`
      query {
        initiateWithdrawActions(
          where: { address: "${account}", timestamp_gt: "${latestCompleteWithdrawTimestamp}" }
          orderBy: timestamp
          orderDirection: desc
        ) {
          amount
          epoch
        }
      }
    `,
    {
      onCompleted: (data) => {
        if (data.initiateWithdrawActions) {
          setInitiateWithdrawActions(data.initiateWithdrawActions);
        }
      },
      onError: (err) => {
        console.error(err);
      },
      skip: !account || !latestCompleteWithdrawTimestamp,
    }
  );

  useEffect(() => {
    // If we haven't fetched the prices from chain yet.
    if (
      initiateWithdrawActions &&
      initiateWithdrawActions.length > 0 &&
      !("pricePerShare" in initiateWithdrawActions) &&
      currentWithdrawalEpoch
    ) {
      const getPrice = async (
        initiateWithdrawActions: Omit<WithdrawAction, "pricePerShare">[]
      ) => {
        // All initiateWithdrawActions returned should occur within same epoch in
        // this case as they occured since the latest completeWithdraw.
        const pricePerShare = await lpContract?.withdrawalEpochPricePerShare(
          initiateWithdrawActions[0].epoch
        );
        setInitiateWithdrawActions(
          initiateWithdrawActions.map<WithdrawAction>((action) => ({
            ...action,
            pricePerShare,
          }))
        );
      };

      getPrice(initiateWithdrawActions);
    }
  }, [initiateWithdrawActions, lpContract, currentWithdrawalEpoch]);

  const accumulatedWithdrawalsAmount = useMemo(() => {
    if (
      initiateWithdrawActions &&
      "pricePerShare" in initiateWithdrawActions[0]
    ) {
      let total = BigNumber.from(0);
      initiateWithdrawActions.forEach((action) => {
        total = total.add(action.amount);
      });
      return total;
    }
    return null;
  }, [initiateWithdrawActions]);

  return (
    <div className="text-xs text-right">
      {initiateWithdrawActions && accumulatedWithdrawalsAmount && (
        <p>
          <BigNumberDisplay currency={Currency.RYSK}>
            {accumulatedWithdrawalsAmount}
          </BigNumberDisplay>{" "}
          {DHV_NAME} @{" "}
          <BigNumberDisplay currency={Currency.RYSK}>
            {"pricePerShare" in initiateWithdrawActions[0]
              ? initiateWithdrawActions[0].pricePerShare
              : BigNumber.from(0)}
          </BigNumberDisplay>{" "}
          USDC per {DHV_NAME}
        </p>
      )}
    </div>
  );
};
