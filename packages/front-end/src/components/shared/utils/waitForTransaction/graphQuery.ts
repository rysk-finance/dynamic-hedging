import { QueriesEnum } from "src/clients/Apollo/Queries";

export const transactionsQuery = `
query ${QueriesEnum.TRANSACTIONS} (
  $address: String, $after: BigInt, $hash: String,
) {
  longBuys: longPositions(
    where: {account: $address, optionsBoughtTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    optionsBoughtTransactions {
      transactionHash
      timestamp
    }
  }

  longSells: longPositions(
    where: {account: $address, optionsSoldTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    optionsSoldTransactions {
      transactionHash
      timestamp
    }
  }

  shortBuys: shortPositions(
    where: {account: $address, optionsBoughtTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    optionsBoughtTransactions {
      transactionHash
      timestamp
    }
  }

  shortSells: shortPositions(
    where: {account: $address, optionsSoldTransactions_: {transactionHash: $hash, timestamp_gte: $after}}
  ) {
    optionsSoldTransactions {
      transactionHash
      timestamp
    }
  }
}
`;
