# Price Feed and Volatility Feed

## General Overview

The Feeds include Volatility Feed, Price Feed and Portfolio Values Feed. These are each responsible for managing off chain information that is passed into the system.

## Price Feed

This feed is responsible for passing price information into the protocol. It uses chainlink price feeds to get the price of the liquidity pool's underlying asset. By calling ```getNormalizedRate(underlying, strike)``` a user can get the price of the underlying in terms of the strike in e18 decimals. Price feeds can be added by governance. The price feed checks whether the arbitrum sequencer is up as recommended by the chainlink team as a precaution for optimistic rollups: https://docs.chain.link/data-feeds/l2-sequencer-feeds 

## Volatility Feed

This feed is responsible for passing in the implied volatility for a given option through ```getImpliedVolatility(isPut, underlyingPrice,strikePrice, expiration)``` The implied volatility is computed using SABR which is implemented as a library called SABR.sol, this is a fuzz tested library and outputs have been compared against a reference python implementation this can be found in test/foundry. Sabr Parameters are updated regularly by the quantitative team this will influence the volatility surface that is exposed to option buyers and sellers.