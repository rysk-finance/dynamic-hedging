import type { Transactions } from "./types";

import { gql } from "@apollo/client";
import { getAccount, waitForTransaction } from "@wagmi/core";
import dayjs from "dayjs";

import { RyskApolloClient } from "src/clients/Apollo/Apollo";
import { transactionsQuery } from "./graphQuery";

const TIMEOUT = 12;

const recursiveCheck = async (
  after: number,
  attempt: number,
  hash: HexString,
  address?: string
): Promise<boolean> => {
  // Bail out after 1 minute.
  if (attempt === TIMEOUT) return true;

  const query = gql(transactionsQuery);
  const variables = {
    after,
    hash,
    address,
  };
  const { data } = await RyskApolloClient.query<Transactions>({
    query,
    variables,
    fetchPolicy: "no-cache",
  });

  const empty = Object.values(data).every((arr) => !arr.length);

  if (empty) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return recursiveCheck(after, attempt + 1, hash, address);
  }

  return true;
};

/**
 * Recursive graph query for an indexed transaction hash.
 *
 * @param hash  - Hash of the TX to check.
 *
 * @returns Promise<boolean>
 */
export const waitForTransactionOrTimer = async (
  hash: HexString,
  bypass: boolean = false
): Promise<boolean> => {
  if (bypass) {
    waitForTransaction({ hash, confirmations: 12 });

    return true;
  }

  const { address } = getAccount();

  const after = dayjs().subtract(1, "minute").unix();

  return recursiveCheck(after, 0, hash, address?.toLowerCase());
};
