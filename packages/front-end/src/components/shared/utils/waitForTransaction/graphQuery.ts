import { QueriesEnum } from "src/clients/Apollo/Queries";

export const transactionsQuery = `
query ${QueriesEnum.TRANSACTIONS} (
  $after: BigInt, $hash: String,
) {
  longBuys: longPositions(
    where: {optionsBoughtTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  longSells: longPositions(
    where: {optionsSoldTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  longRedeems: longPositions(
    where: {redeemActions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  shortBuys: shortPositions(
    where: {optionsBoughtTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  shortSells: shortPositions(
    where: {optionsSoldTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  shortSettles: shortPositions(
    where: {settleActions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  vaultActions(
    where: {transactionHash: $hash, timestamp_gte: $after}
  ) {
    id
  }
}
`;
