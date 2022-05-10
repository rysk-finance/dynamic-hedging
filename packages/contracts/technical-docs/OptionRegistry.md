# Option Registry

## General Overview

This contract is responsible for handling all functionality pertaining to interaction with the opyn option protocol, storing the information about options series and conducting collateral management logic of partially collateralised vaults.

## Oracle use

The library does not directly use oracles, the opyn-rysk gamma protocol uses chainlink oracles for options pricing.

## Function by Function

### ``` issue(Types.OptionSeries memory optionSeries) external onlyLiquidityPool returns address ``` ***NonTrustedAccessible***


### ``` open(address _series, uint256 amount, uint256 collateralAmount) external onlyLiquidityPool returns bool, uint256 ``` ***NonTrustedAccessible***



### ```close(address _series, uint amount) external onlyLiquidityPool returns bool, uint256``` ***NonTrustedAccessible***

### ```redeem(address _series) external returns uint256 ``` ***NonTrustedAccessible***

### ``` settle(address _series) external onlyLiquidityPool returns bool, uint256, uint256, uint256```



### ``` adjustCollateral(uint256 vaultId) external onlyRole(ADMIN_ROLE) ```



### ``` adjustCollateralCaller(uint256 vaultId) external onlyRole(ADMIN_ROLE)```



### ```wCollatLiquidatedVault(uint256 vaultId) external onlyRole(ADMIN_ROLE)```



### ```registerLiquidatedVault(uint256 vaultId) external onlyRole(ADMIN_ROLE) ``` 


### ```setLiquidityPool() external onlyOwner ```

This function sets the liquidity pool that is used for collateral transfer, oToken transfers and liquidity pool accessable functionality.

### ```setHealthThresholds() external onlyOwner ```

This function sets the upper and lower health factors for partially collateralised put and call vaults. If below the thresholds then the vault will need more collateral, if above you can remove collateral if between then leave the collateral as is.


### ```getCollateral(Types.OptionSeries memory series, uint256 amount) external view returns uint256 ``` ***View***



### ```getCollateral(Types.OptionSeries memory series, uint256 amount) external view returns uint256 ``` ***View***


### ```getOtoken( address underlying, address strikeAsset, uint256 expiration,bool isPut, uint256 strike, address collateral) external view returns address ``` ***View***

This function returns an oToken from the opyn-rysk gamma otoken factory. If the otoken does not exist then it returns the zero address. The strike is passed in in oToken (e8) decimals.

### ```checkVaultHealth(uint256 vaultId) public view returns (bool isBelowMin, bool isAboveMax, uint256 healthFactor, uint256 collatRequired, address collatAsset) ``` ***View***


### ```getSeriesAddress(bytes32 issuanceHash) external view returns (address) ``` ***View***


### ```getSeries(Types.OptionSeries memory _series) external view returns (address) ``` ***View***


### ```getSeriesInfo(address series) external view returns (Types.OptionSeries memory) ``` ***View***


### ```getIssuanceHash(Types.OptionSeries memory _series) public pure returns (bytes32) ``` ***View***


### ``` getIssuanceHash(address underlying, address strikeAsset, address collateral, uint expiration, bool isPut, uint strike) internal pure returns(bytes32) ``` ***View***


### ``` formatStrikePrice(uint256 strikePrice, address collateral) public view returns (uint) ``` ***View***

This function converts an e18 strike price to e8 strike price, making sure to round down to deal with any rounding issue on the gamma protocol side of things.