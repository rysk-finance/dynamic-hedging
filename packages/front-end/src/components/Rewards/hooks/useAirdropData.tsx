import type { RewardsQuery, UseAirdropDataValues } from "../types";

import { gql, useQuery } from "@apollo/client";
import { useAccount } from "wagmi";

import { QueriesEnum } from "src/clients/Apollo/Queries";
import { ZERO_ADDRESS } from "src/config/constants";
import { Convert } from "src/utils/Convert";
import { logError } from "src/utils/logError";
import { TOTAl_RECIPIENTS } from "../constants";

/**
 * Hook to fetch graph data for airdrops.
 *
 * Returns the list of airdrop recipients, the total number of recipients, the total tokens distributed and their total USD value.
 *
 * @returns [recipients, totalRecipients, totalArb, totalValue]
 */
export const useAirdropData = (): UseAirdropDataValues => {
  const { address } = useAccount();

  const { data } = useQuery<RewardsQuery>(
    gql(`
      query ${QueriesEnum.REWARDS} (
        $address: String,
      ) {
        airdropRecipients (first: ${TOTAl_RECIPIENTS}, orderBy: totalValue, orderDirection: desc) {
          id
          totalTokens
          totalValue
        }
        airdropStat(id: "0") {
          totalArb
          totalRecipients
          totalValue
        }
        user: airdropRecipient(id: $address) {
          id
          totalTokens
          totalValue
        }
      }
    `),
    {
      onError: logError,
      variables: {
        address: address?.toLowerCase() || ZERO_ADDRESS,
      },
    }
  );

  if (!data) return [[], 0, 0, 0];

  const userInTop = Boolean(
    data.airdropRecipients.find(({ id }) => id === data.user?.id)
  );

  return [
    !data.user || userInTop
      ? data.airdropRecipients
      : [...data.airdropRecipients, data.user],
    Number(data.airdropStat?.totalRecipients),
    Convert.fromWei(data.airdropStat?.totalArb).toInt(),
    Number(data.airdropStat?.totalValue),
  ];
};
