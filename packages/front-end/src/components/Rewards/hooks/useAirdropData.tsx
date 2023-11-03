import type { RewardsQuery, UseAirdropDataValues } from "../types";

import { gql, useQuery } from "@apollo/client";

import { QueriesEnum } from "src/clients/Apollo/Queries";
import { Convert } from "src/utils/Convert";
import { logError } from "src/utils/logError";

/**
 * Hook to fetch graph data for airdrops.
 * Returns the list of airdrop recipients, the total tokens distributed and their total USD value.
 *
 * @returns [totalTokens, totalValue] - [total tokens distributed, total USD value of those tokens]
 */
export const useAirdropData = (): UseAirdropDataValues => {
  const { data } = useQuery<RewardsQuery>(
    gql(`
      query ${QueriesEnum.REWARDS} {
        airdropRecipients (first: 100, orderBy: totalValue, orderDirection: desc) {
          id
          totalTokens
          totalValue
        }
      }
    `),
    {
      onError: logError,
    }
  );

  if (!data) return [[], 0, 0];

  const [totalTokens, totalValue] = data.airdropRecipients.reduce(
    ([totalTokens, totalValue], recipient) => {
      const tokens = Convert.fromWei(recipient.totalTokens).toInt();
      const value = Convert.fromStr(recipient.totalValue).toInt();

      return [totalTokens + tokens, totalValue + value];
    },
    [0, 0]
  );

  return [data.airdropRecipients, totalTokens, totalValue];
};
