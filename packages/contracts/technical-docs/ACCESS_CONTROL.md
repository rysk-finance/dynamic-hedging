# Protocol Access Control Responsibilities

All contracts below inherit Ownable so all contracts have an OWNER

- GUARDIAN: Single addresses: [Jib], [Dan], [Gerry], [Josh]
- OWNER AKA GOVERNOR: 3/5 Multisig of addresses: [Jib, Gerry, Dan, Josh, X]
- MANAGER: 2/3 Multisig of addresses: [Jib, Gerry, X]
- KEEPER: Set of automated single addresses:

## LiquidityPool 
### (OWNER, MANAGER, GUARDIAN, KEEPER)

- LiquidityPool pause/unpause/pauseAndUnpauseTrading: GUARDIAN, OWNER
- LiquidityPool setters: OWNER
    - bufferPercentage [the collateral amount percentage that must be left in the pool]: OWNER
    - hedgingReactors [hedging reactors used for hedging delta with new derivatives]: OWNER
    - collateralCap [max amount of collateral allowed]: OWNER
    - maxDiscount [max discount allowed for options prices because of delta skew]: OWNER
    - bidAskIVSpread [the implied volatility difference for when selling options back to the pool]: OWNER
    - optionParams [options value range for options that the pool can write]: OWNER
    - riskFreeRate [rate used for options calculation]: OWNER
    - handler [authorised contracts that can interact with liquidityPool options writing capabilities]: OWNER
- LiquidityPool rebalancePortfolioDelta: OWNER, MANAGER
- LiquidityPool settleVault: OWNER, MANAGER, KEEPER 
- LiquidityPool pauseTradingAndRequest: OWNER, MANAGER, KEEPER
- LiquidityPool executeEpochCalculation: OWNER, MANAGER, KEEPER


## OptionHandler
### (OWNER, MANAGER, GUARDIAN)

- OptionHandler pause/unpause: GUARDIAN, OWNER
- OptionHandler setters: OWNER
    - customOrderBounds [the options details range and price range that can be used for writing custom orders]: OWNER
    - buybackWhitelist [mapping of addresses that are allowed to always sell options back to the pool]: OWNER
- OptionHandler createOrder: OWNER, MANAGER
- OptionHandler createStrangle: OWNER, MANAGER

## OptionRegistry
### (OWNER, GUARDIAN, KEEPER)

- OptionRegistry setters: OWNER
    - liquidityPool [liquidityPool contract authorised to interact with options capabilitites]: OWNER
    - healthThresholds [expected health factor ranges of the options vault]: OWNER
- OptionRegistry adjustCollateral: OWNER, KEEPER
- OptionRegistry adjustCollateralCaller: OWNER, GUARDIAN
- OptionRegistry wCollatLiquidatedVault: OWNER, KEEPER
- OptionRegistry registerLiquidatedVault: OWNER, KEEPER

## PortfolioValuesFeed
### (OWNER)

- PortfolioValuesFeed setters: OWNER
    - liquidityPool [liquidityPool contract authorised to interact with options capabilitites]: OWNER
    - stringedAddresses [address to string asset mappings]: OWNER
    - maxTimeDeviationThreshold [time window after which a portfolio feed update gets stale]: OWNER
    - maxPriceDeviationThreshold [price window after which a portfolio feed update gets stale]: OWNER
- PortfolioValuesFeed withdrawLink: OWNER

## PriceFeed
### (OWNER)

- PriceFeed setters: OWNER
    - priceFeeds [chainlink price feeds that the pricefeed can offer]: OWNER


## VolatilityFeed
### (OWNER)

- VolatilityFeed setters: OWNER
    - volatilitySkew [the volatility skew used for puts and calls]: OWNER

## Protocol
### (OWNER)

- Protocol setters: OWNER
    - volatilityFeed [the volatility feed used for the liquidityPool]: OWNER
    - portfolioValuesFeed [the portfolio values feed used for the liquidityPool]: OWNER

## PerpHedgingReactor
### (OWNER, GUARDIAN, KEEPER)

- PerpHedgingReactor setters: OWNER
    - keeper [keeper of the hedge (should be changed to global KEEPER)]: OWNER
    - healthFactor [the health factor used for managing collateral]: OWNER
    - syncOnChange [whether to sync the reactor on any position change]: OWNER
- PerpHedgingReactor initialiseReactor: OWNER
- syncAndUpdate: OWNER, KEEPER, GUARDIAN
- sync: OWNER, KEEPER, GUARDIAN
- update: OWNER, KEEPER, GUARDIAN

## UniswapV3HedgingReactor
### (OWNER)

- UniswapV3HedgingReactor setters: OWNER
    - minAmount [dust consideration]: OWNER
    - poolFee [pool fee of the uniswap pool]: OWNER