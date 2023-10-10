import { QueriesEnum } from "src/clients/Apollo/Queries";

export const transactionsQuery = `
query ${QueriesEnum.TRANSACTIONS} (
  $address: String, $after: BigInt, $hash: String,
) {
  longBuys: longPositions(
    where: {account: $address, optionsBoughtTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  longSells: longPositions(
    where: {account: $address, optionsSoldTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  longRedeems: longPositions(
    where: {account: $address, redeemActions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  shortBuys: shortPositions(
    where: {account: $address, optionsBoughtTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  shortSells: shortPositions(
    where: {account: $address, optionsSoldTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }

  shortSettles: shortPositions(
    where: {account: $address, settleActions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    id
  }
}
`;
