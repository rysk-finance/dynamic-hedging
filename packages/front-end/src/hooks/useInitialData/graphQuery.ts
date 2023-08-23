import { QueriesEnum } from "src/clients/Apollo/Queries";

export const initialDataQuery = `
query ${QueriesEnum.INITIAL_DATA} (
  $address: String, $underlying: String
) {
  longPositions(
    first: 1000,
    where: { account: $address }
  ) {
    active
    buyAmount
    netAmount
    redeemActions {
      block
    }
    realizedPnl
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
      timestamp
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
    sellAmount
    netAmount
    realizedPnl
    oToken {
      collateralAsset {
        symbol
      }
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
      timestamp
    }
    liquidateActions {
      collateralPayout
    }
    settleActions {
      block
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
    prices(
      first:1000,
    ) {
      expiry
      price
    }
  }
}
`;
