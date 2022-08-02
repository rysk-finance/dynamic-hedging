# Feeds

## General Overview

The Feeds include Volatility Feed, Price Feed and Portfolio Values Feed. These are each responsible for managing off chain information that is passed into the system.

## Price Feed

This feed is responsible for passing price information into the protocol. It uses chainlink price feeds to get the price of the liquidity pool's underlying asset. By calling ```getNormalizedRate(underlying, strike)``` a user can get the price of the underlying in terms of the strike in e18 decimals. Price feeds can be added by governance. This contract is unlikely to need any upgrades.

## Volatility Feed

This feed is responsible for passing in the implied volatility for a given option through ```getImpliedVolatility(isPut, underlyingPrice,strikePrice, expiration)``` The implied volatility skew can be set by governors and managers and is currently likely to be changed less frequently. For information on the implementation of the implied volatility oracle see: https://hackmd.io/pTUlux8ZRrqMudMnBDBdXw?both
The volatility feed may change as this functionality moves to a more oracle based solution or the implied volatility methodology changes. Thus, the volatility feed should be implemented and used with modularity in mind, this allows the model to be more adaptive to different markets which may have different volatility characteristics that could change at varying frequencies.

## Portfolio Values Feed

This feed is responsible for passing in the pool's greek exposure (most importantly delta) and the portfolio's liabilities (or value of options contracts held) to the liquidity pool. It does this through an offchain request-response based chainlink oracle. The oracle currently gets the pool's options exposure via event emissions for writes, buybacks, settles and liquidations. The feed has a request function that can be called by anyone, including the liquidity pool, this will tell the oracle to update the pool's positions, it is assumed that the request will track events from the block of the request or earlier. The response or fulfill is also in this contract, this is called by the chainlink system and updates the pools ```portfolioValues```. To retrieve these values you can just call ```getPortfolioValues(underlying, strike)``` which returns a PortfolioValues struct. In addition to setting the portfolio values a fulfill also resets the ephemeralValues in the liquidity pool to 0. This is because the pool's positions should now be up to date at that point and the ephemeral values dont need to be counted at that point.

## Portfolio values oracle - request response chainlink external adaptor

The final portfolio values oracle is not completely implemented as there has been some delay on the node operator side and external adaptor implementation but the liquidity pool assumes the following in terms of its behaviour :

- It tracks all written options by WriteOption events from the liquidity pool.
- It tracks all buybacks of options by BuybackOption events from the liquidity pool.
- It tracks all liquidations of vaults by VaultLiquidated events from the opyn-rysk gamma protocol controller.
- It tracks all settlements of options by SettleVault in the Liquidity Pool.
- It tracks all vault liquidation registrations by the VaultLiquidationRegistered event in the Options Registry.
- Write options and buyback options will be deducted from eachother if they are of the same series.
- Liquidated vaults will be written off according to the amount provided in the VaultLiquidated event after they have been acknowledged by registerLiquidatedVault() in OptionsRegistry, before that their value is tracked by the oracle so as to not prematurely reduce liability value, when the vault liquidation is registered then the oracle knows the loss in assets is accounted for, so the liability can be dropped.
- Options that have expired will be priced according to their realised value, so if an option expired OTM it is written off, if it expires ITM then its value is determined as the difference between the price at the time of expiry and the strike price of the option series. The price at time of expory is retrieved by calling getExpiryPrice() from Opyn's oracle. However, once a SettleVault event is received for a specific options contract, the oracle no longer accounts for its value as the pool has now realised the value.
- Option value off-chain is determined in the same way that the pool will determine options value on-chain.
- The oracle determines the portfolio values on or after the block where a request was submitted.
- There will be a few block delay between requests and responses.
- The chainlink price of an asset is accurate.

A WIP implementation (implemented, but being tested currently) can be seen here: https://github.com/rysk-finance/dynamic-hedging/blob/feat/chainlink-ea-logic/packages/contracts/test/OracleCoreLogic.ts with the chainlink external adapter still in production.