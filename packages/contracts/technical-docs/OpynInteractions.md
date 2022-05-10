# Opyn Interactions

## General Overview

This library is responsible for processing any logic that interacts directly with the opyn-rysk gamma protocol. Allowing the creation of oTokens, creation of short position, closing of short positions, settling and redeeming. The contract makes use of opyn-rysk partial collateralisation. This library is inherited by ```OptionRegistry.sol```.

## Oracle use

The library does not directly use oracles, the opyn-rysk gamma protocol uses chainlink oracles for options pricing.

## Function by Function

### ``` getOrDeployOtoken(address oTokenFactory, address collateral, address underlying, address strikeAsset, uint256 strike, uint256 expiration,bool isPut) external returns address ``` ***NonTrustedAccessible***

This function returns an oToken from the opyn-rysk gamma otoken factory. If that oToken does not exist then it creates the otoken through the otoken factory. The strike is passed in in oToken (e8) decimals.

### ``` createShort(address gammaController, address marginPool, address oTokenAddress, uint256 depositAmount, uint256 vaultId, uint256 amount, uint256 vaultType) external returns uint256``` ***NonTrustedAccessible***

This function is responsible for writing short option positions. It expects the amount in e18 decimals, which it converts to e8 decimals. The function gets the next expected vault id if this is the same as the passed in vault id then a new vault is opened with the vault type 1 (partial collateralisation), collateral is deposited and the short option is minted and sent to the caller. If the next expected vault id is different to the one passed in it means that a vault for this option series already exists so it deposits the collateral to that vault and mints the options. The final amount should be returned in e8 decimals. This function can be accessed from an untrusted party.

### ```burnShort(address gammaController, address oTokenAddress, uint256 burnAmount, uint256 vaultId) external returns uint256``` ***NonTrustedAccessible***

This function closes a short option position. It burns a specified short option position and then takes the collateral from the vault that is freed by burning this collateral is sent to the options registry then to the liquidity pool and should be accounted for in collateralAllocated. The collateral redeemed is: ```collatAmounts * burnAmount / shortAmounts ``` the ratio of the burn amount to the short amount multiplied by the total collateral, so that the health factor stays the same. burnAmount comes in in oToken decimals and the collateral is returned in collateral decimals. This function can be accessed from an untrusted party.

### ``` function redeem(address gammaController, address marginPool, address series, uint256 amount) external returns uint256``` ***NonTrustedAccessible***

After an option expires this function allows a user to redeem their payout if the option expired in the money. If the option expired OTM then it returns nothing. This function should not settle vaults.

### ``` function depositCollat(address gammaController, address marginPool, address collateralAsset, uint256 depositAmount, uint256 vaultId) external```

This function deposits collateral to a specified vault. The collateral is sourced from the liquidity pool and should be accounted for in collateralAllocated, this contract is used within vault collateral management functionality and is thus only accessible by trusted parties. It takes in collateral decimals.

### ``` function withdrawCollat(address gammaController, address collateralAsset, uint256 withdrawAmount, uint256 vaultId) external```

This function withdraws collateral from a specified vault. The collateral is returned to the option registry then to the liquidity pool and should be accounted for in collateralAllocated, this contract is used within vault collateral management functionality and is thus only accessible by trusted parties. It takes in collateral decimals.

### ```settle(address gammaController, uint256 vaultId) external returns uint256 collateralRedeemed, uint256 collateralLost, uint256 shortAmount```

This function settles a vault that holds an option series. It will determine and withdraw the correct amount of collateral for fair option settlement. This collateral should then be sent back to the option registry then to the liquidity pool and should be reflected in collateralAllocated. This function is only accessible by trusted parties. It returns collateral in collateral decimals and oToken amounts in oToken decimals.

### ```getOtoken(address oTokenFactory, address collateral, address underlying, address strikeAsset, uint256 strike, uint256 expiration,bool isPut) external view returns address ``` ***View***

This function returns an oToken from the opyn-rysk gamma otoken factory. If the otoken does not exist then it returns the zero address. The strike is passed in in oToken (e8) decimals.