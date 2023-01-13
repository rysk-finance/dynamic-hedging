# Option Catalogue

## General Overview

The Option Catalogue is a contract responsible for storing state on what options that the OptionExchange is allowed to sell, it is updated by the Manager Role, series can be revoked from sale or purchase. In addition to keeping record of series that can be used it also stores the netdhvexposure of each approved series, this acts as a running count of exposure of the dhv of a particular series and is different from the PortfolioValuesFeed as that is used to store the exact series address, whereas netDhvExposure can be for the same option but with different collateral assets.

## Function by Function

### ```issueNewSeries(Types.Option[] memory options) ``` ***Access Controlled***
This function allows the manager to enable options that can be bought or sold. It first converts the strike to a valid strike that has been correctly formatted. Then an optionHash is made ```keccak256(abi.encodePacked(o.expiration, strike, o.isPut))```. This option hash is approved on the approvedOptions mapping then whether the option hash isBuyable and isSellable (this is taken from the perspective of the user). For frontend use we store the expiration in an array (we do not repeat expirations in the array) then we also store strike in an array which is stored in optionDetails[expiration][isPut] depending on the option (strikes and expirations should never be repeated in the same array)

### ```changeOptionBuyOrSell(Types.Option[] memory options) ``` ***Access Controlled***
This function allows the manager to alter the buy and sell status for an option already approved. It first converts the strike to a valid strike that has been correctly formatted. Then an optionHash is made ```keccak256(abi.encodePacked(o.expiration, strike, o.isPut))```.

### ```formatStrikePrice``` 
This is a utility function that converts an e18 strike to an e8 strike and floors the least significant digits in order to ensure that the records held in the rysk contracts is the same as those stored in the opyn-rysk gamma protocol.


### ```updateNetDhvExposure(bytes32 oHash, int256 netDhvExposureChange)``` ***Access Controlled***
This function allows an approved updater (likely the AlphaOptionHandler and OptionExchange) to update the net dhv exposure of a specific series by passing in the ohash that represents the series to be updated. This is important so that the dhv and pricer can keep track of exposure on a series (as the portfoliovaluesfeed tracks by option series (taking into account collateral)). The netdhvexposure including the change cannot exceed the maxNetDhvExposure which is a governance settable limit.

### ```updateNetDhvExposureWithOptionSeries(Types.OptionSeries memory optionSeries, int256 netDhvExposureChange)``` ***Access Controlled***
This function allows an approved updater (likely the AlphaOptionHandler and OptionExchange) to update the net dhv exposure of a specific series by passing in the option series struct. This is important so that the dhv and pricer can keep track of exposure on a series (as the portfoliovaluesfeed tracks by option series (taking into account collateral)). The netdhvexposure including the change cannot exceed the maxNetDhvExposure which is a governance settable limit.