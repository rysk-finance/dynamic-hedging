# Address P/L based on Epochs 

This component queries all data necessary from The Graph to compute Profit and Loss for an address:

```gql
        query {
                pricePerShares (orderBy: timestamp) {
                    id
                    growthSinceFirstEpoch
                    value
                    timestamp
                }
                initiateWithdrawActions (where: { address: "${address}" }){
                    id
                    amount
                    epoch
                }
                depositActions (where: { address: "${address}" }) {
                    id
                    amount
                    epoch
                    timestamp
                }
            }
```

It iterates through PricePerShares to compose an Array of users Deposits, Withdrawals and P/L over epochs:

```ts
export interface PNL {
  epoch: string;
  pnl: string;
  change: string;
  shares: string;
  timestamp: string;
  dateLocale: string;
}
```
