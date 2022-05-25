# Protocol

## General Overview

The Protocol is a registry for contracts and feeds relavant to the liquidity pool


The contract is passed into LiquidityPool when it is deployed and contains the address for the volatility feed, portfolio values feed, price feed and option registry. The liquidityPool calls these feeds and registry by first getting the address from Protocol.

Doing it this way allows feeds/contracts that might be modified in the future such as the volatility feed and portfolio values feed to be changed in the future and so long as their interface is the same the LiquidityPool will be able to interact with them in the same way.



