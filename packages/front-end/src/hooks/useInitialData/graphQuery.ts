import { QueriesEnum } from "src/clients/Apollo/Queries";

export const initialDataQuery = `
query ${QueriesEnum.INITIAL_DATA} (
  $address: String, $after: BigInt, $underlying: String,
) {
  longPositions(
    first: 1000,
    where: { account: $address, optionsBoughtTransactions_: { timestamp_gte: $after }, vaultId: null }
  ) {
    active
    buyAmount
    netAmount
    realizedPnl

    oToken {
      id
      expiryTimestamp
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

    redeemActions {
      block
    }
  }
  
  shortPositions(
    first: 1000,
    where: { account: $address, optionsSoldTransactions_: { timestamp_gte: $after } }
  ) {
    active
    sellAmount
    netAmount
    realizedPnl

    oToken {
      id
      collateralAsset {
        symbol
      }
      expiryTimestamp
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

  longCollateral: longPositions(
    first: 1000,
    where: { account: $address, optionsBoughtTransactions_: { timestamp_gte: $after }, vaultId_not: null }
  ) {
    realizedPnl
    vaultId

    oToken {
      id
      expiryTimestamp
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
}
`;
