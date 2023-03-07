# Protocol Access Control Responsibilities

All contracts below inherit AccessControl with 3 roles, Governor, Manager and Guardian

1. GOVERNOR: 3/5 Multisig of addresses: [Jib, Gerry, Dan, Josh, Degeneral]
2. MANAGER: 2/4 Multisig of addresses: [Jib, Gerry, Degeneral, Josh]
3. GUARDIAN: Single addresses: [Jib], [Dan], [Gerry], [Josh]
4. KEEPER: Set of automated single addresses (bots)

## LiquidityPool 
### (OWNER, MANAGER, GUARDIAN, KEEPER)

- LiquidityPool pause/unpause/pauseAndUnpauseTrading: GUARDIAN, GOVERNOR
- LiquidityPool setters: GOVERNOR
    - bufferPercentage [the collateral amount percentage that must be left in the pool]: GOVERNOR
    - hedgingReactors [hedging reactors used for hedging delta with new derivatives]: GOVERNOR
    - collateralCap [max amount of collateral allowed]: GOVERNOR
    - optionParams [options value range for options that the pool can write]: GOVERNOR, MANAGER
    - riskFreeRate [rate used for options calculation]: GOVERNOR
    - handler [authorised contracts that can interact with liquidityPool options writing capabilities]: GOVERNOR
    - maxTimeDeviationThreshold [time window after which a portfolio feed update gets stale]: GOVERNOR
    - maxPriceDeviationThreshold [price window after which a portfolio feed update gets stale]: GOVERNOR
    - keeper [authorised specified function caller]: GOVERNOR
- LiquidityPool rebalancePortfolioDelta: GOVERNOR, MANAGER
- LiquidityPool settleVault: GOVERNOR, MANAGER, KEEPER 
- LiquidityPool pauseTradingAndRequest: GOVERNOR, MANAGER, KEEPER
- LiquidityPool executeEpochCalculation: GOVERNOR, MANAGER, KEEPER

## OptionExchange
### (GOVERNOR, MANAGER, GUARDIAN)

- OptionExchange pause/unpause: GUARDIAN, GOVERNOR
- OptionExchange setters: GOVERNOR
    - pricer [the contract used for pricing options]: GOVERNOR
    - optionCatalogue [the contract for storing state about which options are available to trade]: GOVERNOR
    - feeRecipient [the recipient of protocol fees]: GOVERNOR
    - poolFee [pool fees associated with swapping redeemed assets]: GOVERNOR
    - tradeSizeLimits [min and max number of contracts allowed in a tx]: GOVERNOR
    - approvedCollateral [mapping for collaterals we are enabling]: GOVERNOR
- OptionExchange: withdraw: LIQUIDITY POOL
    - withdraw [give any loose USDC to the liquidityPool]
- OptionExchange accessed controlled functions: MANAGER, GOVERNOR
    - redeem [redeem options held by the exchange]: MANAGER, GOVERNOR
    - migrateOtokens [migrate held otokens to a new exchange]: GOVERNOR


## OptionCatalogue
### (GOVERNOR, MANAGER)

- OptionExchange accessed controlled functions: MANAGER, GOVERNOR
    - issueNewSeries [approve a new option type for trading]: MANAGER, GOVERNOR
    - changeOptionBuyOrSell [change whether an option type is available for buy or sell]: MANAGER, GOVERNOR

## AlphaOptionHandler
### (GOVERNOR, MANAGER, GUARDIAN)
- AlphaOptionHandler setters: GOVERNOR
    - feePerContract [the fee paid per option contract]: GOVERNOR
    - feeRecipient [the recipient of protocol fees]: GOVERNOR
- AlphaOptionHandler createOrder [create an otc option order]: GOVERNOR, MANAGER
- AlphaOptionHandler createStrangle [create an otc option order strangle]: GOVERNOR, MANAGER

## OptionRegistry
### (GOVERNOR, GUARDIAN, KEEPER)

- OptionRegistry setters: GOVERNOR
    - liquidityPool [liquidityPool contract authorised to interact with options capabilitites]: GOVERNOR
    - keeper [authorised specified function caller]: GOVERNOR
    - healthThresholds [expected health factor ranges of the options vault]: GOVERNOR
- OptionRegistry adjustCollateral: GOVERNOR, MANAGER, KEEPER
- OptionRegistry adjustCollateralCaller: GOVERNOR, GUARDIAN
- OptionRegistry wCollatLiquidatedVault: GOVERNOR, MANAGER, KEEPER
- OptionRegistry registerLiquidatedVault: GOVERNOR, MANAGER, KEEPER

## AlphaPortfolioValuesFeed
### (GOVERNOR, KEEPER)

- AlphaPortfolioValuesFeed setters: GOVERNOR
    - liquidityPool [liquidityPool contract authorised to interact with options capabilitites]: GOVERNOR
    - protocol [protocol contract]: GOVERNOR
    - rfr [riskFreeRate]: GOVERNOR
    - keeper [keepers can interact with maintenance tasks]: GOVERNOR
    - handler [handlers are contracts that can update the options storage]: GOVERNOR
    - maxNetDhvExposure [the maximum netDhvExposure that is allowed for a particular option series]: GOVERNOR
- AlphaPortfolioValuesFeed updateStores [update the options book of the contract]: HANDLER
- AlphaPortfolioValuesFeed syncLooper [cleans the array used for storing options of expired options]: GOVERNOR, MANAGER, KEEPER
- AlphaPortfolioValuesFeed cleanLooperManually [manually clean the for loop of a specific series]: GOVERNOR, MANAGER, KEEPER
- AlphaPortfolioValuesFeed accountLiquidatedSeries [account for a liquidated series in the portfolio]: GOVERNOR, MANAGER, KEEPER
- AlphaPortfolioValuesFeed migrate [migrate the options storage to a new PortfolioValuesFeed]: GOVERNOR

## BeyondPricer

### (GOVERNOR, MANAGER)
- BeyondPricer setters: 
    - riskFreeRate: GOVERNOR
    - bidAskIVSpread [the implied volatility difference for when selling options back to the pool]: GOVERNOR
    - feePerContract [fixed fee charged by the protocol per contract traded]: GOVERNOR
    - slippageGradient [the base value in the exponential slippage function]: MANAGER, GOVERNOR
    - collateralLendingRate [rate at which to charge our collateral usage for short positions in spread function]: MANAGER, GOVERNOR
    - shortDeltaBorrowRate [rate at which to charge for protocol's costs of borrowing short delta exposute in spread function]: MANAGER, GOVERNOR
    - longDeltaBorrowRate [rate at which to charge for protocol's costs of borrowing long delta exposute in spread function]: MANAGER, GOVERNOR
    - deltaBandWidth [width of the delta bands each element in the slippageGradientMultiplier arrays spans]: MANAGER, GOVERNOR
    - slippageGradientMultipliers [coefficients for the slippageGradient based on delta of the option being traded]: MANAGER, GOVERNOR

## PriceFeed
### (GOVERNOR)

- PriceFeed setters: GOVERNOR
    - priceFeeds [chainlink price feeds that the pricefeed can offer]: GOVERNOR
    - sequencerUptimeFeedAddress [address used for tracking the uptime of the arbitrum sequencer]: GOVERNOR


## VolatilityFeed
### (GOVERNOR)

- VolatilityFeed setters: GOVERNOR, MANAGER, KEEPER
    - sabrParameters [parameters used for the sabr volatility curve]: KEEPER, MANAGER, GOVERNOR
    - keeper [able to update sabr parameters]: GOVERNOR

## Protocol
### (GOVERNOR)

- Protocol setters: GOVERNOR
    - volatilityFeed [the volatility feed used for the liquidityPool]: GOVERNOR
    - portfolioValuesFeed [the portfolio values feed used for the liquidityPool]: GOVERNOR
    - accounting [the contract used for managing deposit/withdraw logic]: GOVERNOR
    - priceFeed [the price feed used for all contracts]: GOVERNOR

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