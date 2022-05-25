# Perpetual Hedging Reactor

## General Overview

This contracts responsibility is to hedge a delta specified by the liquidityPool using perpetual short or long positions. The perpetual provider is rage.trade (github: https://github.com/RageTrade/core.git). The contract's is responsible for maintaining the margin collateral at a specified health factor so as to ensure that the vault does not make a loss as a result of a margin account liquidation, other kinds of losses are possible.

All functions assume that the LiquidityPool has the collateral to service its needs. 

## Oracle use

The pool uses a Chainlink Price feed Oracle for internal price calculations. Rage trade uses a combination of chainlink price feeds and uniswap v3 twaps as an internal oracle.

## Function by Function

### ```initialiseReactor() external ***Direct NonTrustedAccessible***```

initialise the reactor by adding 1 wei of collateral to the clearing house margin account. This ensures that the margin account exists (if it drops to 0 then the margin account will not exist which will cause other functionality to fail). Thus initialise reactor can be called so long as a margin account doesnt exist.

### ```hedgeDelta(int256 _delta)```

This function is responsible for hedging off a specified amount of delta using perpetual positions. The reactor must hedge off the delta that the pool passes in, so if the pool passes -1 then the reactor should hedge 1.

It gets the new position of the margin account when accounting for the new delta. It then calculates the collateral needed for that position.
If the collateral needed is more than held then increase ```collatToDeposit``` by the difference. If the collateral needed is less than held then increase ```collatToWithdraw`` (making sure at least 1 wei is left in the margin account). (There is an extremely low chance that the collateral requirement is the same but the position is exactly the opposite, in this case just swap the position without changing collateral). 

If a deposit is needed then get funds from the liquidityPool, deposit the collateral in the margin account and open the specified position.
If a withdraw is needed first update the position to the desired state. Then attempt to update the margin. If the withdrawal fails for because of ```InvalidTransactionNotEnoughMargin()``` which means that the withdrawal results in an unsafe state. In this scenario settle any losses by sending funds from the margin account to the clearing house, reducing margin account collateral, then continue with the withdrawal.
Transfer any collateral returned back to the liquidityPool.

The sign in of the final variable of ```updateMargin``` determines whether to deposit or withdraw (+ = depost, - = withdraw)


It can only be accessed by the liquidityPool by a function that is only accessible by governance or a manager.

### ```withdraw(uint256 _amount) external ``` ***NonTrustedAccessible***

Withdraws all loose change from the reactor, returning the minimum of the ```balance``` and ```_amount```, the return will return what was sent. The function assumes collateral decimals are passed in and returned. This function can only be called by the liquidity pool during withdraw operations. 

### ```syncAndUpdate()```

This function can only be called by a keeper. It calls sync to settle any profits or losses then it calls update to fix the collateral of the position, this is the preferred way of rebalancing the pool.

### ```sync()```

This function can only be called by a keeper or internally when delegated by the liquidityPool. It settles any profits or losses by rebalancing funds in the margin account.

### ```update()```

The functions goal is to rebalance the pool to make sure its healthFactor is at the desired healthFactor. If the collateral is 1 and net position is 0 then do nothing as this is the desired rest state of the reactor. It determines the desired collateral for the position. If the collateral is too much then remove some collateral and send it back to the liquidityPool. If the collateral is too little then get some funds from the liquidtyPool and update the margin. This function can only be called by a keeper. 

### ```getDelta()``` ***View***

This function gets the internalDelta of the pool. Which is assumed to always hold the live delta value of the pool.

### ```getPoolDenominatedValue()``` ***View***

This function should return the value of the pool denominated in e18 decimals. It gets the collateral holdings of the margin account, any loose collateral in the reactor, the netProfit or netLoss of the pool these are summed and all assumed as in collateral decimals.

if for any reason the final value is less than the net losses of the margin account then revert (this should likely never happen, but is there as a precaution).

### ```setHealthFactor(uint256 _healthFactor) external onlyOwner```

The health factor is the parameter used to govern what the minimum collateral is required in the perpetual margin account relative to the open perpetual position. healthFactor is denominated in ```MAX_BIPS``` decimals (10000). When determining the collateral amount required for a particular position the calculation is:

```((position * currentPrice)/1e18) * healthFactor/MAX_BIPS```

This makes sure there is a reasonable buffer to make sure the perpetual position doesnt get liquidated.

healthFactor should never be lower than ```MAX_BIPS```.

### ```setKeeper(address _keeper) external onlyOwner```

Keepers are authorised to call sync or update functionality to help manage the collateral position of the pool. They are assumed to be trusted parties.

### ```setSyncOnChange(bool _syncOnChange) external onlyOwner```

During the ```_changePosition()``` internal function this flag provides the option to set the function to settle any profits or losses in the margin account prior to opening or closing positions and adjusting collateral.

