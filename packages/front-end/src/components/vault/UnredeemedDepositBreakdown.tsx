import { useEffect, useState } from "react";

import { useContract } from "../../hooks/useContract";
import LPABI from "../../abis/LiquidityPool.json";
import { BigNumber } from "ethers";
import { gql, useQuery } from "@apollo/client";
import { useWalletContext } from "../../App";
import { useVaultContext } from "../../state/VaultContext";
import { BIG_NUMBER_DECIMALS, DHV_NAME } from "../../config/constants";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { Currency } from "../../types";

type DepositAction = {
  epoch: number;
  amount: number;
  pricePerShare: BigNumber;
};

export const UnredeemedDepositBreakdown = () => {
  const [lpContract] = useContract({
    contract: "liquidityPool",
    ABI: LPABI,
    readOnly: true,
  });

  const {
    state: { depositEpoch: currentDepositEpoch },
  } = useVaultContext();
  const { account } = useWalletContext();

  const [latestRedeemEpoch, setLatestRedeemEpoch] = useState<number | null>(
    null
  );
  const [unredeemedDepositActions, setUnredeemedDepositActions] = useState<
    (Omit<DepositAction, "pricePerShare"> | DepositAction)[] | null
  >(null);

  // Get the latest epoch the user redeemed at. Then we can filter down
  // deposit actions to only those that have not been redeemed.
  useQuery(
    gql`
    query {
      redeemSharesActions(
        where: { address: "${account}" }
        orderBy: epoch
        orderDirection: desc
        first: 1
      ) {
        epoch
      }
    }
  `,
    {
      skip: !account,
      onCompleted: (data) => {
        if (data.redeemSharesActions[0]) {
          setLatestRedeemEpoch(data["redeemSharesActions"][0].epoch);
        }
      },
    }
  );

  // Fetch actions that ocurred after the most recent redeem (unredeemed actions)
  // that have also had their epoch price calculated (aren't on hold).
  useQuery(
    gql`
      query {
        depositActions(
          where: {
            address: "${account}",
            epoch_gt: ${latestRedeemEpoch},
            epoch_lt: ${currentDepositEpoch}
          }, 
          orderBy: epoch, 
          orderDirection:asc
        ) {
          amount
          epoch
        }
      }
    `,
    {
      onCompleted: (data) => {
        if (data.depositActions) {
          setUnredeemedDepositActions(data.depositActions);
        }
      },
      onError: (err) => {
        console.log(err);
      },
      skip: !account || !latestRedeemEpoch,
    }
  );

  useEffect(() => {
    // If we haven't fetched the prices from chain yet.
    if (
      unredeemedDepositActions &&
      unredeemedDepositActions[0] &&
      !("pricePerShare" in unredeemedDepositActions[0])
    ) {
      const getPrices = async (
        actions: Omit<DepositAction, "pricePerShare">[]
      ) => {
        const depositsWithPrices = await Promise.all(
          actions.map(async (action) => ({
            ...action,
            pricePerShare: BigNumber.from(
              (await lpContract?.depositEpochPricePerShare(action.epoch)) ?? 0
            ),
          }))
        );
        setUnredeemedDepositActions(depositsWithPrices);
      };

      getPrices(unredeemedDepositActions);
    }
  }, [unredeemedDepositActions, lpContract]);

  return (
    <div className="text-xs text-right">
      {unredeemedDepositActions?.map((action) => (
        <p key={action.epoch}>
          <BigNumberDisplay currency={Currency.USDC}>
            {BigNumber.from(action.amount)}
          </BigNumberDisplay>{" "}
          {DHV_NAME} @{" "}
          <BigNumberDisplay currency={Currency.RYSK}>
            {"pricePerShare" in action ? action.pricePerShare : null}
          </BigNumberDisplay>{" "}
          USDC per {DHV_NAME}
        </p>
      ))}
    </div>
  );
};
