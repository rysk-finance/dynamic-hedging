# Feeds

## General Overview

The Feeds include Volatility Feed, Price Feed and Portfolio Values Feed. These are each responsible for managing off chain information that is passed into the system.

## Price Feed

This feed is responsible for passing price information into the protocol. It uses chainlink price feeds to get the price of the liquidity pool's underlying asset. By calling ```getNormalizedRate(underlying, strike)``` a user can get the price of the underlying in terms of the strike in e18 decimals. Price feeds can be added by governance. This contract is unlikely to need any upgrades.

## Volatility Feed

This feed is responsible for passing in the implied volatility for a given option through ```getImpliedVolatility(isPut, underlyingPrice,strikePrice, expiration)``` The implied volatility skew can be set by governors and managers and is currently likely to be changed less frequently. For information on the implementation of the implied volatility oracle see: 
The volatility feed may change as this functionality moves to a more oracle based solution or the implied volatility methodology changes. Thus, the volatility feed should be implemented and used with modularity in mind, this allows the model to be more adaptive to different markets which may have different volatility characteristics.

## Portfolio Values Feed

This feed is responsible for passing in the pool's greek exposure (most importantly delta) and the portfolio's liabilities (or value of options contracts held) to the liquidity pool. It does this through an offchain request-response based chainlink oracle. The oracle currently gets the pool's options exposure via event emissions for writes, buybacks, settles and liquidations. The feed has a request function that can be called by anyone, including the liquidity pool, this will tell the oracle to update the pool's positions, it is assumed that the request will track events from the block of the request or later. The response or fulfill is also in this contract, this is called by the chainlink system and updates the pools ```portfolioValues```. To retrieve these values you can just call ```getPortfolioValues(underlying, strike)``` which returns a PortfolioValues struct. In addition to setting the portfolio values a fulfill also resets the ephemeralValues in the liquidity pool to 0. This is because the pool's positions should now be up to date at that point and the ephemeral values dont need to be counted at that point. For a more in depth description of what this feed is doing refer to: