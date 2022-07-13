# Option Registry

## General Overview

This contract is responsible for handling all functionality pertaining to interaction with the opyn option protocol, storing the information about options series and conducting collateral management logic of partially collateralised vaults.
The pool uses partial collateralisation which means that options contracts can be undercollateralised this means much better capital efficiency but also introduces margin risk, this is managed by holding a margin buffer in the LiquidityPool that can be used for managing collateral. For documentation on opyns partial liquidation system see: https://medium.com/opyn/partially-collateralized-options-now-in-defi-b9d223eb3f4d
[opyn-rysk gamma protocol](https://github.com/rysk-finance/GammaProtocol) 
This contract essentially gets infinite approval rights from the LiquidityPool.

## Oracle use

The library does not directly use oracles, the opyn-rysk gamma protocol uses chainlink oracles for options pricing.

## Function by Function

### ``` issue(Types.OptionSeries memory optionSeries) external onlyLiquidityPool returns address ``` ***Indirect NonTrustedAccessible***

This function creates an oToken series via OpynInteractions and stores the identity of this oToken in the option registry without minting a short position. The strike is passed in as e18 decimals and converted with ``` formatStrikePrice()``` in order to make it compatible with opyn's e18 decimals. It is stored with opyn's decimals.
This function is called via the LiquidityPool only.

### ``` open(address _series, uint256 amount, uint256 collateralAmount) external onlyLiquidityPool returns bool, uint256 ``` ***Indirect NonTrustedAccessible***

This function mints a short position for an oToken that has been "issued" by the option registry. If it has not been issued then it will not be minted. This contract will retrieve the seriesInfo from the registry, then will retrieve the opyn-rysk vault id for this series if it exists. If it does not exist then a new vault id will be created. A short is created via OpynInteractions to the options registry which is then transferred to the LiquidityPool.
This function is called via the LiquidityPool only.

### ```close(address _series, uint amount) external onlyLiquidityPool returns bool, uint256``` ***Indirect NonTrustedAccessible***

This function closes a short position that was "issued" by the option registry and a vault already exists (it does not have to be opened by the option registry, but an option of this series has to have been minted at some point). It closes the oToken via OpynInteractions after transferring the oToken from the liquidity pool to the registry. After the close it will return any redeemed collateral to the liquidity pool. It makes sure the oToken can be closed (i.e. if it hasnt already expired).

### ```redeem(address _series) external returns uint256 ``` ***Direct NonTrustedAccessible***

This function interacts with Gamma protocol to "redeem" any oToken. This means that it burns the oToken and returns the option value to the sender after it has expired. 

### ``` settle(address _series) external onlyLiquidityPool returns bool, uint256, uint256, uint256```

This function settles a vault that the registry owns. It can only occur after expiry. All funds are sent back to the liquidityPool. This function can only be called via the liquidity pool which can only be called by a trusted party. 

### ``` adjustCollateral(uint256 vaultId) external onlyRole(ADMIN_ROLE) ```

This function checks the vault health by calling checkVaultHealth. If the vault is undercollateralised then the function calls adjustCollateral in the liquidity pool to request collateral extraction approval, This collateral is then transferred into the OptionRegistry from the LiquidityPool and deposited into the vault via OpynInteractions depositCollat.
If the vault is above its upper collateral factor then it is over collateralised so funds are withdrawn from the vault and transferred to the liquidityPool, this is reflected in the liquidityPool again.

### ``` adjustCollateralCaller(uint256 vaultId) external onlyRole(ADMIN_ROLE)```

This function allows a trusted caller to collateralise a vault if it is undercollateralised using their own funds. This is done in emergency scenarios where the liquidity pool has insufficient funds to cover collateralisation.

### ```wCollatLiquidatedVault(uint256 vaultId) external onlyRole(ADMIN_ROLE)```

If a vault gets liquidated all collateral will have been lost. This function exists just in case there is some dust collateral left in a vault after a liquidation occurs. It adjusts the collateralAllocated in the liquidityPool.

### ```registerLiquidatedVault(uint256 vaultId) external onlyRole(ADMIN_ROLE) ``` 

This function is used to tell that LiquidityPool that a liquidation of a vault controlled by the optionRegistry has happened. It checks the vaultLiquidationDetails, if there is a liquidation it will reflect this in the liquidityPool via collateralAllocated. It will then clear these liquidation details so that liquidations dont get double counted accidentally.

### ```setLiquidityPool() external onlyOwner ```

This function sets the liquidity pool that is used for collateral transfer, oToken transfers and liquidity pool accessable functionality.

### ```setHealthThresholds() external onlyOwner ```

This function sets the upper and lower health factors for partially collateralised put and call vaults. If below the thresholds then the vault will need more collateral, if above you can remove collateral if between then leave the collateral as is.


### ```getCollateral(Types.OptionSeries memory series, uint256 amount) external view returns uint256 ``` ***View***

This functon gets the required collateral for the option series passed in and an amount. It then multiplies this by the upper health factor to get the safe amount of collateral to maintain the margin balance.

### ```getOtoken( address underlying, address strikeAsset, uint256 expiration,bool isPut, uint256 strike, address collateral) external view returns address ``` ***View***

This function returns an oToken from the opyn-rysk gamma otoken factory. If the otoken does not exist then it returns the zero address. The strike is passed in in oToken (e8) decimals.

### ```checkVaultHealth(uint256 vaultId) public view returns (bool isBelowMin, bool isAboveMax, uint256 healthFactor, uint256 upperHealthFactor, uint256 collatRequired, address collatAsset) ``` ***View***

This function checks the margin health of a specific vault and returns whether the vault is under or over collateralised and if so how much it is over/under by. Since all vaults use Opyn's partial collateralisation mechanism it means that they require collateral/margin management. The function starts by retrieving the vault from the opyn controller. Then searching for that series in the registry. Then the required collateral for that vault is retrieved from opyn's margin calculator and the collateral in the vault is retrieved. The health factor is calculated as ``` (collatAmount * MAX_BPS) / marginReq```. This health factor is then compared to the desired health factor. If it is above the healthFactor is above upperHealthFactor then the registry tells the caller that the vault is overcollateralised and the amount that should be withdrawn, If the opposite is true then the registry tells the caller that the vault is undercollateralised and the amount that should be deposited to return to the upperHealthFactor.

### ```getSeriesAddress(bytes32 issuanceHash) external view returns (address) ``` ***View***

This function gets a series address that has been issued by the registry using an issuance hash

### ```getSeries(Types.OptionSeries memory _series) external view returns (address) ``` ***View***

This function takes in an address then searches the seriesInfo[] mapping in the contract to retrieve the OptionSeries struct for that series address.

### ```getSeriesInfo(address series) external view returns (Types.OptionSeries memory) ``` ***View***

This function takes in an address then searches the seriesInfo[] mapping in the contract to retrieve the OptionSeries struct for that series address, these will match opyn's records.

### ```getIssuanceHash(Types.OptionSeries memory _series) public pure returns (bytes32) ``` ***View***

This function gets the issuance hash of the input value which should be an OptionSeries struct. This hash is used for series storage.

### ``` getIssuanceHash(address underlying, address strikeAsset, address collateral, uint expiration, bool isPut, uint strike) internal pure returns(bytes32) ``` ***View***

This function gets the issuance hash of the input values. This hash is used for series storage

### ``` formatStrikePrice(uint256 strikePrice, address collateral) public view returns (uint) ``` ***View***

This function converts an e18 strike price to e8 strike price, making sure to round down to deal with any rounding issue on the gamma protocol side of things.