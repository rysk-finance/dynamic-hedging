# Uniswap V3 Hedging Reactor

## General Overview

This contracts responsibility is to hedge a delta specified by the liquidityPool using spot positions traded via uniswap v3.

All functions assume that the LiquidityPool has the collateral to service its needs. 

## Oracle use

The pool uses a Chainlink Price feed Oracle for internal price calculations.

## Function by Function

### ```hedgeDelta(int256 _delta)```

This function is responsible for hedging off a specified amount of delta by buying spot or selling held spot. The reactor must hedge off the delta that the pool passes in, so if the pool passes -1 then the reactor should hedge 1.

If the passed in delta is negative then buy some spot, set the ```amountInMaximum``` using chainlink price and an acceptable slippage percentage to protect from slippage and sandwiches. Transfer the amount to the reactor from the liquidityPool. Then swap for ETH using Uniswap V3, increment the deltaChange, once finished send any remaining collateral back to the liquidityPool.
If the passed in delta is positive then sell ETH, if none to dust is held return 0 and do nothing. If there are ETH holdings then swap them to USD, increment the delta and send USD back to the liquidityPool.

It can only be accessed by the liquidityPool by a function that is only accessible by governance or a manager.

### ```withdraw(uint256 _amount) external ``` ***NonTrustedAccessible***

Withdraws all loose change from the reactor, returning the minimum of the ```balance``` and ```_amount```, the return will return what was sent. The function assumes collateral decimals are passed in and returned. This function can only be called by the liquidity pool during withdraw operations. 

### ```update()```

Doesnt do anything, needed because of interface.

### ```getDelta()``` ***View***

This function gets the internalDelta of the pool. Which is assumed to always hold the live delta value of the pool.

### ```getPoolDenominatedValue()``` ***View***

This function should return the value of the pool denominated in e18 decimals. It gets the value of loose change and the value of spot positions multiplied by the current chainlink price

### ```changePoolFee(uint24 _poolFee) external onlyOwner```

Set the uni v3 pool fee

### ```setMinAmount(uint _minAmount) external onlyOwner```

Set the minimum amount allowed to hedge.

