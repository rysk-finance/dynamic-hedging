# Alpha to Beyond Deployment Instructions

**PriceFeed**

1. Deploy new price feed
2. Change price feed on Protocol.sol
3. Clear current uniswap hedging reactor & Redeploy Uniswap hedging reactor with new price feed (check manager contract)[should be index 0]
4. Clear current perp hedging reactor & Redeploy Perp hedging reactor with new price feed (check manager contract) [should be index 1]
5. Check cor for references to the price feed contract and switch out the address 
6. Change notion and gitbook docs to reflect new contract

**VolatilityFeed**

1. Deploy new VolatilityFeed with an interestRate
2. Change volatility feed on Protocol.sol
3. Check cor for references to the price feed contract and switch out the address
4. Change notion and gitbook docs to reflect new contract

**AlphaOptionHandler**

1. Deploy new AlphaOptionHandler with fee recipient and fee per contract
2. Remove current AlphaOptionHandler from liquiditypool
3. Remove current AlphaOptionHandler from portfolioValuesFeed
4. Add new AlphaOptionHandler to the liquidityPool
5. Add new AlphaOptionHandler as keeper and handler on portfolioValuesFeed
6. Check cor for references to the price feed contract and switch out the address
7. Change notion and gitbook docs to reflect new contract

**Accounting**

1. Deploy new Accounting contract
2. Change accounting contract on Protocol.sol
3. Check cor for references to the price feed contract and switch out the address
4. Change notion and gitbook docs to reflect new contract

**OptionCatalogue**

1. Deploy OptionCatalogue contract
2. Add as parameter on OptionExchange
3. Set AlphaOptionHandler as an updater
4. Set OptionExchange as an updater
5. Change notion and gitbook docs to reflect new contract

**BeyondPricer**

1. Deploy beyond pricer and connect to option exchange
2. Check cor for references to the price feed contract and switch out the address
3. Change notion and gitbook docs to reflect new contract

**OptionExchange**

1. Deploy exchange contract
2. Set as handler and reactor on the liquidity pool
4. Set as a keeper and handler on the portfolioValuesFeed
5. Check cor for references to the price feed contract and switch out the address
6. Change notion and gitbook docs to reflect new contract
