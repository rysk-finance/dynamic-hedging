import { QueriesEnum } from "src/clients/Apollo/Queries";

export const initialDataQuery = `
query ${QueriesEnum.INITIAL_DATA} (
  $address: String, $now: String, $underlying: String
) {
  longPositions(
    first: 1000,
    where: { account: $address }
  ) {
    active
    netAmount
    oToken {
      createdAt
      expiryTimestamp
      id
      isPut
      strikePrice
      symbol
    }
    optionsBoughtTransactions {
      fee
      premium
    }
    optionsSoldTransactions {
      fee
      premium
    }
  }
  
  shortPositions(
    first: 1000,
    where: { account: $address }
  ) {
    active
    netAmount
    oToken {
      createdAt
      expiryTimestamp
      id
      isPut
      strikePrice
      symbol
    }
    optionsBoughtTransactions {
      fee
      premium
    }
    optionsSoldTransactions {
      fee
      premium
    }
    vault {
      id
      vaultId
      collateralAmount
      shortAmount
      collateralAsset {
        id
      } 
    }
  }

  oracleAsset(
    id: $underlying
  ) {
    prices {
      expiry
      price
    }
  }
}
`;
