# Alpha Option Handler

## General Overview

The Alpha Option Handler is a contract authorised by the liquidityPool to access options buying and selling activities on the liquidityPool, it is dedicated to creating OTC orders. This includes writing options and buying back options. This contract calls the LiquidityPool directly and provides parameters for options it wishes to interact with. 

## Oracle use

The contract uses Chainlink Price feed oracles.

## Function by Function

### ```executeOrder(orderId) external ``` ***Direct NonTrustedAccessible***

This function gets a custom order using a orderId, this will revert if the sender is not the authorised buyer of the order. First the order expiry will be checked against a spot price deviation from when the order was created as well as a time deviation which is the alloted time that the buyer has to execute the order from creation (this cannot be more than 30 minutes). If all conditions are met then the option will be minted to the buyer. At the end of the transaction the order is invalidated. 
Fees are also charged at this point and a fixed fee is charged per contract. If the premium / 8 is less than the fee then the fee is waived.

### ```executeStrangle(orderId1, orderId2) external ``` ***Direct NonTrustedAccessible***

This function executes two order executions and is intended for use with a strangle.

### ``` createOrder() external onlyRole```

This function creates a custom option order receipt which contains the option series, the amount, the price at which the order is settled at, the time after which the custom order expires and the authorised buyer of the custom order as well as a spot price deviation threshold which represents the acceptable difference between the current spot price and spot price at the time of order execution. This is managed by a manager and governance and is used for large market orders with participants such as market makers. This returns an orderId which is used by the market participant to access their custom order in executeOrder.

### ``` createStrangle() external onlyRole```

This function creates two custom orders, one put order and one call order. This is so delta neutral positions can be sold to certain market participants.




