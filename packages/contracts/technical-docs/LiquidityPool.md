# Liquidity Pool

## General Overview

The Liquidity Pool holds most core functionality for the Rysk Dynamic Hedging Vault, it is responsible for managing all funds. It uses several libraries and contracts which have been explained in other docs.

Throughout the contract there are conversions between decimals, there are three decimals to be aware of e6 (USDC decimals) or collateral decimals, e8 otoken decimals and e18 share value, eth, and options calculation decimals. Where each decimal type is used is commented in each function.
## Oracle use

The contract uses Chainlink Price feed oracles.

## Descriptions

Most variables and functions if not mentioned here can be fully explained by their natspec in the contracts so have been left out

### hedgingReactors

This variable is an array that stores hedging reactor addresses. Each hedging reactor can be referenced by its index in ```rebalancePortfolioDelta``` or each hedging reactor is referenced by iterating over the array, for example in ```completeWithdraw() or getPortfolioDelta()```. When a hedging reactor is added it is added to the last place of the array, when removed the array should be shifted so as not to leave any array elements as zero addresses.

### pauses

There is pause and unpause functionality which pauses all state changing functionality. There is also pause and unpause trading which pauses any options buying or selling activity from the pool. This pause functionality can be executed by Guardians or above.

### optionParams

This is a struct that contains variables that pertain to the min and max call strike which are the minimum and maximum strikes that can be written for calls by the pool and the min and max put strikes. The min and max expiry are also stored which are the minimum and maximum length options that the pool can write. These variables can be updated by management or above and helps with managing pool exposure depending on the market outlook.

### max price and time deviation thresholds

These values are used to set the time and price thresholds for when an oracle update becomes stale. For example, if an oracle update was done at 600 and the threshold is 10 if the time is now 611 the oracle update is stale and the pool will not do anything until the oracle is updated again. This is to deal with the value of the pool changing due to price and time movement and thus the liability value and delta value being off.

### handler

These are contracts that have the authority to issue, write, and buyback options from the liquidityPool. They must be authorised. This architecture allows for multiple handlers and upgradeability on the handlers.

### Mutual fund system (deposit(), redeem(), initiateWithdraw(), completeWithdraw(), pauseTradingAndRequest(), executeEpochCalculations(), getNAV(), sharesForAmount(), amountForShares())

An explainer of the mutual fund system or how deposits/withdraws/redeems/pauseTradingAndRequest and executeEpochCalculation work can be seen here: https://bejewled-egret-22c.notion.site/Mutual-Fund-Explainer-768912673cf946f4a99c3b833d830389 

Accounting.sol is responsible for the logic that guides how deposits and withdraws should be calculated and processed, it can be plugged in and out such that this logic can be modified in the future.

Accounting.sol descriptor: https://rysk.notion.site/Accounting-sol-58deffac2d1a45e1986fd29d1aa752fb

### Issuing and Buying options back (handlerIssue, handlerWriteOption, handlerIssueAndWriteOption, handlerBuyBackOption, _issue, _writeOption, _buybackOption)

Issuing an option is creating or retrieving an oToken series from opyn for that option and storing it in the options registry. It does NOT create any obligation or options contracts and is just a way of telling the registry and pool that this is an option that someone might want to mint.

Writing or Opening an option is the act of minting an oToken of a specified series, this will create an obligation, the pool takes on the short position and transfers the oToken which represents the long side to the option buyer. A user will pay a premium in order to do this.

For writing options it can only be done if the options sale would not reduce the loose collateral held by the liquidity pool below the maxLiquidityBuffer.

Buying back or closing an option is the act of returning an oToken to the pool so that it can be burnt. In this scenario the pool will pay the options seller a premium for closing out the position with the pool and collateral will be freed from the option vault.

In all of these scenarios, the expiry of the option MUST be in the future, the collateral asset, underlying asset and strike asset must be correct. The expiries and strike prices must be within the specified thresholds.

### rebalancePortfolioDelta()

This function uses hedging reactors to hedge off a specified delta. The manager (or above) will specify the delta to hedge and the index of the reactor in the hedgingReactors array. The hedging reactor can be anything that implements the IHedgingReactor interface, it is used for accessing alternate derivatives that can be used for delta hedging. Currently only spot and perps are implemented but any derivative or asset can be implemented in the future.

### adjustCollateral()

This function is used by the option registry to update the collateralAllocated in the LiquidityPool when funds are moved around. If the option registry is moving funds back into the LiquidityPool then it will decrease collateralAllocated. If the option registry is moving funds from the LiquidityPool then it will get a safe approval and will increase the collateralAllocated. Collateral allocated should never drop below negative because the balance of option registry should not go up beyond what it is allocated (because it generates no profits from providing collateral)(it can only go down, say if an option gets exercised).

### settleVault()

This function is used to settle a vault and move collateral between the registry and the vault when an option expires.

### getPortfolioDelta()

This function is used to get the portfolio delta. This first retrieves the delta from the portfolio value feed oracle (making sure it isnt stale), it then gets the delta from all hedging reactors finally it gets the ephemeralDelta that has been recorded between a request and response.

### Normal Distribution approximation library

Reference for implementation:

https://www.johndcook.com/blog/2021/11/05/normal-tail-estimate/

https://www.johndcook.com/blog/2009/01/19/stand-alone-error-function-erf/ 

### Black scholes library

Reference for implementation: 

http://www.quantacademy.com/2014/09/options-greeks-calculation-with-python/ 