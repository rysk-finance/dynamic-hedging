# Option Catalogue

## General Overview

The Option Catalogue is a contract responsible for storing state on what options that the OptionExchange is allowed to sell, it is updated by the Manager Role, series can be revoked from sale or purchase.

## Function by Function

### ```issueNewSeries(Types.Option[] memory options) ``` ***Access Controlled***
This function allows the manager to enable options that can be bought or sold. It first converts the strike to a valid strike that has been correctly formatted. Then an optionHash is made ```keccak256(abi.encodePacked(o.expiration, strike, o.isPut))```. This option hash is approved on the approvedOptions mapping then whether the option hash isBuyable and isSellable (this is taken from the perspective of the user). For frontend use we store the expiration in an array (we do not repeat expirations in the array) then we also store strike in an array which is stored in optionDetails[expiration][isPut] depending on the option (strikes and expirations should never be repeated in the same array). The function will make sure any options issued expire at 8am.

### ```changeOptionBuyOrSell(Types.Option[] memory options) ``` ***Access Controlled***
This function allows the manager to alter the buy and sell status for an option already approved. It first converts the strike to a valid strike that has been correctly formatted. Then an optionHash is made ```keccak256(abi.encodePacked(o.expiration, strike, o.isPut))```.

