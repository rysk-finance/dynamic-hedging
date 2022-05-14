# Protocol Access Control Responsibilities

All contracts below inherit AccessControl with 3 roles, Governor, Manager and Guardian

- GUARDIAN: Single addresses: [Jib], [Dan], [Gerry], [Josh]
- GOVERNOR: 3/5 Multisig of addresses: [Jib, Gerry, Dan, Josh, X]
- MANAGER: 2/3 Multisig of addresses: [Jib, Gerry, X]
- KEEPER: Set of automated single addresses:

## LiquidityPool 
### (OWNER, MANAGER, GUARDIAN, KEEPER)

- LiquidityPool pause/unpause/pauseAndUnpauseTrading: GUARDIAN, GOVERNOR
- LiquidityPool setters: GOVERNOR
    - bufferPercentage [the collateral amount percentage that must be left in the pool]: GOVERNOR
    - hedgingReactors [hedging reactors used for hedging delta with new derivatives]: GOVERNOR
    - collateralCap [max amount of collateral allowed]: GOVERNOR
    - maxDiscount [max discount allowed for options prices because of delta skew]: GOVERNOR
    - bidAskIVSpread [the implied volatility difference for when selling options back to the pool]: GOVERNOR
    - optionParams [options value range for options that the pool can write]: GOVERNOR
    - riskFreeRate [rate used for options calculation]: GOVERNOR
    - handler [authorised contracts that can interact with liquidityPool options writing capabilities]: GOVERNOR
- LiquidityPool rebalancePortfolioDelta: GOVERNOR, MANAGER
- LiquidityPool settleVault: GOVERNOR, MANAGER, KEEPER 
- LiquidityPool pauseTradingAndRequest: GOVERNOR, MANAGER, KEEPER
- LiquidityPool executeEpochCalculation: GOVERNOR, MANAGER, KEEPER


## OptionHandler
### (GOVERNOR, MANAGER, GUARDIAN)

- OptionHandler pause/unpause: GUARDIAN, GOVERNOR
- OptionHandler setters: GOVERNOR
    - customOrderBounds [the options details range and price range that can be used for writing custom orders]: GOVERNOR
    - buybackWhitelist [mapping of addresses that are allowed to always sell options back to the pool]: GOVERNOR
- OptionHandler createOrder: GOVERNOR, MANAGER
- OptionHandler createStrangle: GOVERNOR, MANAGER

## OptionRegistry
### (GOVERNOR, GUARDIAN, KEEPER)

- OptionRegistry setters: GOVERNOR
    - liquidityPool [liquidityPool contract authorised to interact with options capabilitites]: GOVERNOR
    - healthThresholds [expected health factor ranges of the options vault]: GOVERNOR
- OptionRegistry adjustCollateral: GOVERNOR, KEEPER
- OptionRegistry adjustCollateralCaller: GOVERNOR, GUARDIAN
- OptionRegistry wCollatLiquidatedVault: GOVERNOR, KEEPER
- OptionRegistry registerLiquidatedVault: GOVERNOR, KEEPER

## PortfolioValuesFeed
### (GOVERNOR)

- PortfolioValuesFeed setters: GOVERNOR
    - liquidityPool [liquidityPool contract authorised to interact with options capabilitites]: GOVERNOR
    - stringedAddresses [address to string asset mappings]: GOVERNOR
    - maxTimeDeviationThreshold [time window after which a portfolio feed update gets stale]: GOVERNOR
    - maxPriceDeviationThreshold [price window after which a portfolio feed update gets stale]: GOVERNOR
- PortfolioValuesFeed withdrawLink: GOVERNOR

## PriceFeed
### (GOVERNOR)

- PriceFeed setters: GOVERNOR
    - priceFeeds [chainlink price feeds that the pricefeed can offer]: GOVERNOR


## VolatilityFeed
### (GOVERNOR)

- VolatilityFeed setters: GOVERNOR
    - volatilitySkew [the volatility skew used for puts and calls]: GOVERNOR

## Protocol
### (GOVERNOR)

- Protocol setters: GOVERNOR
    - volatilityFeed [the volatility feed used for the liquidityPool]: GOVERNOR
    - portfolioValuesFeed [the portfolio values feed used for the liquidityPool]: GOVERNOR

## PerpHedgingReactor
### (GOVERNOR, GUARDIAN, KEEPER)

- PerpHedgingReactor setters: GOVERNOR
    - keeper [keeper of the hedge (should be changed to global KEEPER)]: GOVERNOR
    - healthFactor [the health factor used for managing collateral]: GOVERNOR
    - syncOnChange [whether to sync the reactor on any position change]: GOVERNOR
- PerpHedgingReactor initialiseReactor: GOVERNOR
- syncAndUpdate: GOVERNOR, KEEPER, GUARDIAN
- sync: GOVERNOR, KEEPER, GUARDIAN
- update: GOVERNOR, KEEPER, GUARDIAN

## UniswapV3HedgingReactor
### (GOVERNOR)

- UniswapV3HedgingReactor setters: GOVERNOR
    - minAmount [dust consideration]: GOVERNOR
    - poolFee [pool fee of the uniswap pool]: GOVERNOR