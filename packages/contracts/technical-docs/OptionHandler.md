# Option Handler

## General Overview

The Option Handler is a contract authorised by the liquidityPool to access options buying and selling activities on the liquidityPool. This includes writing options and buying back options. This contract calls the LiquidityPool directly and provides parameters for options it wishes to interact with. This contract is the user facing options contract that is authorised by the liquidityPool to issue, write and buyback options.

## Oracle use

The contract uses Chainlink Price feed oracles. The contract also makes use of the Portfolio values feed request response oracle and may in the future make use of a volatility feed oracle. These are documented in the oracle documentation.

## Function by Function

### ``` issue(Types.OptionSeries memory optionSeries) external returns address ``` ***Direct NonTrustedAccessible*** 

This function enables a user to "issue" an option. This means creating an oToken series and not minting it. The strike is passed in as e18 here but is processed to e8 decimals. The oToken address is passed back whether it was created by this contract or it already existed.

### ``` issueAndWriteOption(Types.OptionSeries memory optionSeries, uint amount) external returns uint256, address ``` ***Direct NonTrustedAccessible*** ***Pausable***

This function enables a user to "issue" an option and write that same option. This means creating an oToken series and minting it. The strike is passed in as e18 here but is processed to e8 decimals. The oToken address is passed back whether it was created by this contract or it already existed and the amount of options minted is also passed in. Note: amount is passed in as e18 but the oTokenAmount is e8. The function itself first determines the premium and delta for the option by calling ```quotePriceWithUtilisationGreeks``` from the liquidityPool, this is then used for the handlerIssueAndWriteOption function. At the end of this function call a request is made to the portfolio feed oracle, this is to make sure the portfolioDelta gets updated with the change in position.

### ``` writeOption(Types.OptionSeries memory optionSeries, uint amount) external returns uint256 ``` *** Direct NonTrustedAccessible*** ***Pausable***

This function enables a user to write an option that the registry has "issued". This means minting an oToken series. The seriesAddress is passed in. Note: amount is passed in as e18 but the oTokenAmount is e8. The function itself first retrieves the series from the registry then it determines the premium and delta for the option by calling ```quotePriceWithUtilisationGreeks``` from the liquidityPool, the strike of the option is converted here to 18 decimals because ```quotePriceWithUtilisationGreeks``` expects it that way but option registry stores strike price in e8 decimals, this is then used for the writeOption function. At the end of this function call a request is made to the portfolio feed oracle, this is to make sure the portfolioDelta gets updated with the change in position.

### ```buybackOption(address _series, uint amount) external returns uint256``` ***Direct NonTrustedAccessible*** ***Pausable***

This function enables a user to sell an option back to the liquidity pool. This option must have been "issued" by the pool and the liquidityPool must have an existing short position on this particular series. The function retrieves the series and gets the quote price and delta. This function then checks the caller against the buyBackWhitelist, if they are on the whitelist then the contract must honour the buyback even if it shifts the pool delta away from 0, this feature is mainly targeted at structured product integrators. If they are not on the whitelist tehn the pool checks whether buying back the option would help the delta of the pool. If it does then the buyback is processed.

### ```executeOrder(orderId) external ``` ***Direct NonTrustedAccessible***

This function gets a custom order using a orderId, this will revert if the sender is not the authorised buyer of the order. First the order expiry will be checked then a quote and delta from the liquidityPool will be attained via quotePriceWithUtilizationGreeks. This quote and delta is then checked against the customOrderBounds. If the order falls outside any of the allowed bounds then the transaction will revert. If all conditions are met then the option will be minted to the buyer. At the end of the transaction the order is invalidated.

### ```executeStrangle(orderId1, orderId2) external ``` ***Direct NonTrustedAccessible***

This function executes two order executions and is intended for use with a strangle.

### ``` createOrder() external onlyRole```

This function creates a custom option order receipt which contains the option series, the amount, the price at which the order is settled at, the time after which the custom order expires and the authorised buyer of the custom order. This is managed by a manager and governance and is used for large market orders with participants such as market makers. This returns an orderId which is used by the market participant to access their custom order in executeOrder.

### ``` createStrangle() external onlyRole```

This function creates two custom orders, one put order and one call order. This is so delta neutral positions can be sold to certain market participants.

### ``` adjustCollateral(uint256 vaultId) external onlyRole(ADMIN_ROLE) ```

This function checks the vault health by calling checkVaultHealth. If the vault is undercollateralised then the function calls adjustCollateral in the liquidity pool to request collateral extraction approval, This collateral is then transferred into the OptionRegistry from the LiquidityPool and deposited into the vault via OpynInteractions depositCollat.
If the vault is above its upper collateral factor then it is over collateralised so funds are withdrawn from the vault and transferred to the liquidityPool, this is reflected in the liquidityPool again.

### ``` adjustCollateralCaller(uint256 vaultId) external onlyRole(ADMIN_ROLE)```

This function allows a trusted caller to collateralise a vault if it is undercollateralised using their own funds. This is done in emergency scenarios where the liquidity pool has insufficient funds to cover collateralisation.

### ```wCollatLiquidatedVault(uint256 vaultId) external onlyRole(ADMIN_ROLE)```

If a vault gets liquidated all collateral will have been lost. This function exists just in case there is some dust collateral left in a vault after a liquidation occurs. It adjusts the collateralAllocated in the liquidityPool.

### ```registerLiquidatedVault(uint256 vaultId) external onlyRole(ADMIN_ROLE) ``` 

This function is used to tell that LiquidityPool that a liquidation of a vault controlled by the optionRegistry has happened. It checks the vaultLiquidationDetails, if there is a liquidation it will reflect this in the liquidityPool via collateralAllocated. It will then clear these liquidation details so that liquidations dont get double counted accidentally.

### ```pause / unpause onlyOwner ```

This function only callable by governance or guardians pauses all untrusted user functionality.

### ```setCustomOrderBounds() external onlyOwner ```

This function sets the maximum and minimum put and call deltas that can be issued in custom orders as well as the allowed price spread on the quotePriceWithUtilisationGreeks options price quote.

### ```addOrRemoveBuybackAddress() external onlyOwner ```

This function sets an address as whitelisted, this means that the buyback function must honour a buyback of options and cannot refuse it, even if it doesnt help the delta of the pool. This is to enable better buyside structured product integrations. The whitelist is managed by governance.



