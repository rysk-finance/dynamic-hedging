import { QueriesEnum } from "src/clients/Apollo/Queries";

export const transactionsQuery = `
query ${QueriesEnum.TRANSACTIONS} (
  $after: BigInt, $hash: String,
) {
  longBuys: longPositions(
    where: {optionsBoughtTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    active
  }

  longSells: longPositions(
    where: {optionsSoldTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    active
  }

  longRedeems: longPositions(
    where: {redeemActions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    active
  }

  shortBuys: shortPositions(
    where: {optionsBoughtTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    active
  }

  shortSells: shortPositions(
    where: {optionsSoldTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    active
  }

  shortSettles: shortPositions(
    where: {settleActions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    active
  }

  vaultActions(
    where: {transactionHash: $hash, timestamp_gte: $after}
  ) {
    block
  }
}
`;
