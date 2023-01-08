# Option Exchange

## General Overview

The Option Exchange is a user facing contract responsible for allowing users to buy and sell options to the vault along with manipulating opyn-rysk gamma protocol vaults, the options that can be bought and sold are selected by the manager. The contractis a handler which means that it is authorised to call options manipulation based functionality on the liquidity pool and simultaneously a reactor which is a "hack" to allow it to take funds from the liquidity pool, this is important so that it can pay users for options that are sold to the pool. A user is also able to interact directly with opyn via this contract so long as they enable the exchange as an "operator" on the opyn-rysk gamma protocol which is a permission that allows another address to act on a user's behalf on the opyn-rysk gamma protocol.

## Oracle use

The contract uses Chainlink Price feed oracles. 

## Operate flow

Users can interact with options functionality via the operate function. The operate flow is designed for simpler UX for the end user as it allows multiple different options transactions to be stringed together into a single transaction, reducing the number of transactions for the end user whilst removing the number of Approve transactions required. The operate flow used allows for the combination of *opyn actions* which are actions that interact with the rysk-opyn gamma protocol allowing the users to create and sell options to the dhv and *rysk actions* which are actions that interact with the dhv directly.

### ```operate(CombinedActions.OperationProcedures[] memory _operationProcedures) ``` 

The operate function takes a list of OperationProcedures this is a struct that contains the operation type which is either Opyn or Rysk and a list of CombinedActions.ActionArgs which is the struct ActionArgs shown below. The function _runActions will loop through the list of operation procedures, it will pre-process any opyn actions by first converting the actions from the generic CombinedActions.ActionArgs to the opyn specific OpynActions.ActionArgs, which are then dispatched to the rysk-opyn gamma protocol controller and will process rysk actions after first converting them from the generic CombinedActions.ActionArgs to the rysk specific RyskActions.ActionArgs seperately. Conversion of the generic ActionArgs struct to the specific ActionArgs structs occurs in CombinedActions.sol.
This allows a user to string together opyn actions such as creating an otoken vault and minting an otoken with selling an option to the rysk protocol as well as a diverse range of structured products in a single transaction.

operate runs 2 functions:
_runActions and _verifyFinalState
the former goes through the actions and processes them
the latter ensures that any transient state is properly resolved, this includes checking that all temporary otoken holdings (otokens held in the contract on the user's behalf) are 0 and that if there is collateral asset held temporarily in the exchange on behalf of the user then this is sent to the sender.

```	
enum OperationType {
		OPYN,
		RYSK
}

struct OperationProcedures {
		OperationType operation;
		CombinedActions.ActionArgs[] operationQueue;
}

struct ActionArgs {
        // type of action that is being performed on the system
        uint256 actionType;
        // address of the account owner
        address owner;
        // address which we move assets from or to (depending on the action type)
        address secondAddress;
        // asset that is to be transfered
        address asset;
        // index of the vault that is to be modified (if any)
        uint256 vaultId;
        // amount of asset that is to be transfered
        uint256 amount;
        // option series (if any)
        Types.OptionSeries optionSeries;
        // each vault can hold multiple short / long / collateral assets but we are restricting the scope to only 1 of each in this version
        // in future versions this would be the index of the short / long / collateral asset that needs to be modified
        uint256 index;
        // any other data that needs to be passed in for arbitrary function calls
        bytes data;
}
```

### Opyn Actions
- Opyn actions are sent to the controller for processing but are preprocessed in the OptionExchange in _runOpynActions to prevent any malicious behaviour or to improve user UX the preprocessing is summarised below:

1/ OPERATOR - It is checked that the exchange has been approved as an operator on the gamma controller for the user (this is necessary for allowing the exchange to manipulate opyn vaults on the user's behalf)

CHECK ON ALL ACTIONS: OWNER - It is checked that the owner param is the msg.sender, this should always be the case to ensure users arent manipulating other user's opyn vaults.

- *OpenVault*: No further preprocessing
- *MintShortOption*: Check the secondAddress which represents the recipient of the minted short options, FOR UX PURPOSES the user can specify the exchange as the recipient. This will store the otokens in the exchange on behalf of the user for the duration of the transaction, this balance must be used by the end of the tx or the tx will revert.
- *BurnShortOption*: Check the second address is the sender, this ensures the sender is burning otokens from their own wallet and nowhere else
- *DepositLongOption*: Check the second address is the sender, this ensures the sender is depositing otokens from their own wallet and nowhere else
- *WithdrawLongOption*: Check the secondAddress which represents the recipient of the withdrawn long short options, FOR UX PURPOSES the user can specify the exchange as the recipient. This will store the otokens in the exchange on behalf of the user for the duration of the transaction, this balance must be used by the end of the tx or the tx will revert.
*DepositCollateral*: Check the secondAddress which represents the depositor of collateral. FOR UX PURPOSES the user can specify the exchange as the depositor (or themselves). If they select the exchange then the collateral is transferred from the user to the exchange before being sent to the gamma protocol (this prevents a seperate collateral Approve tx to the MarginPool contract as the user just needs to approve the exchange contract).
*WithdrawCollateral*: No further preprocessing
*SettleVault*: No further preprocessing
*Redeem*: completely forbidden to reduce scope
*Call*: completely forbidden to reduce scope
*Liquidate*: completely forbidden to reduce scope

### Rysk Actions

Issue -> _issue:
- check the hash is approved and that it is a buyable option. 
- If it is then issue it on the liquidity pool.

BuyOption -> _buyOption [for a buyer buying options to the dhv, paying the dhv a premium]: 
- get the option details based on the seriesAddress and/or optionSeries passed in the action (always prioritise the details of seriesAddress if it is present). 
- Check the hash of the option to make sure its approved for buying. 
- Get a quote (which includes premium and fee).
- Transfer the necessary premium to the liquidity pool and fees to the fee recipient. Check whether the user has any collateral that has been temporarily stored in the exchange in this transaction, use that and transfer collateral from the sender as needed.
- Check the long exposure of portfolio for the series address being bought, if we have any exposure then first sell this to the buyer (this will be stored as otokens in the OptionExchange). It is always beneficial to reduce longExposure first as increasing shortExposure will lock dhv collateral which is undesirable.
- If there is an amount remaining after using up the exposure then write the option via the liquidity pool (we need to make sure the collateral being used for this series address is usdc).
- During the transaction the portfolio stores should be updated to reflect the change in exposures.

SellOption -> _sellOption(!isClose) [for a seller selling options to the dhv, receiving a premium from the dhv]:
- get the option details based on the seriesAddress and/or optionSeries passed in the action (always prioritise the details of seriesAddress if it is present). 
- Check the hash of the option to make sure its approved for buying. 
- Get a quote (which includes premium and fee).
- Get the number of otokens of seriesAddress that the exchange is temporarily holding for the user.
- check the shortExposure (which is the amount of shorts that the dhv has of that seriesAddress). If it is greater than 0, we will first sell the options back to the dhv to release collateral via a liquidityPool buyback.
- if there is excess amount the user wants to sell then transfer the otokens to the exchange.
- subtract the fee from the premium to be paid to the user and send the fee to the fee recipient (if the premium/8 is less than the fee then revert the tx as the premium is too small). 
- transfer the premium to the seller unless they set the recipient as the exchange in which case update the temporary holdings on the contract.
- During the transaction the portfolio stores should be updated to reflect the change in exposures.


CloseOption -> _sellOption(isClose) [for a seller to ONLY close options to the dhv, receiving a premium from the dhv]:
- get the option details based on the seriesAddress and/or optionSeries passed in the action (always prioritise the details of seriesAddress if it is present). 
- Check the hash of the option to make sure its approved for buying. 
- Get a quote (which includes premium and fee).
- check the shortExposure (which is the amount of shorts that the dhv has of that seriesAddress). The short exposure must be greater than 0 and less than the amount of options being closed, otherwise revert the tx.
- sell the otokens back to the dhv via a liquidity pool buyback
- subtract the fee from the premium to be paid to the user and send the fee to the fee recipient (if the premium/8 is less than the fee then the fee is waived as the user is doing the dhv a service by helping release collateral). 
- During the transaction the portfolio stores should be updated to reflect the change in exposures.

## Function by Function

### ```issueNewSeries(Types.Option[] memory options) ``` ***Access Controlled***
This function allows the manager to enable options that can be bought or sold. It first converts the strike to a valid strike that has been correctly formatted. Then an optionHash is made ```keccak256(abi.encodePacked(o.expiration, strike, o.isPut))```. This option hash is approved on the approvedOptions mapping then whether the option hash isBuyable and isSellable (this is taken from the perspective of the user). For frontend use we store the expiration in an array (we do not repeat expirations in the array) then we also store strike in an array which is stored in optionDetails[expiration][isPut] depending on the option (strikes and expirations should never be repeated in the same array)

### ```changeOptionBuyOrSell(Types.Option[] memory options) ``` ***Access Controlled***
This function allows the manager to alter the buy and sell status for an option already approved. It first converts the strike to a valid strike that has been correctly formatted. Then an optionHash is made ```keccak256(abi.encodePacked(o.expiration, strike, o.isPut))```.

### ```createOtoken(Types.OptionSeries memory optionSeries) ``` ***NonTrustedAccessible***
This function creates an otoken with the specified optionSeries, note: it takes in an e18 value and converts this to an e8 strike that is correctly rounded as opyn would round it.

### ```formatStrikePrice``` 
This is a utility function that converts an e18 strike to an e8 strike and floors the least significant digits in order to ensure that the records held in the rysk contracts is the same as those stored in the opyn-rysk gamma protocol.

### ```redeem(address[] memory _series) ``` ***Access Controlled***
As there can be otokens held by the exchange contract when a user sells options to the exchange, the otokens must be redeemed if they expire ITM. This function takes in a list of series addresses it should loop through these addresses and redeem the "winnings" to the exchange contract. When an otoken is redeemed the settlement asset is whatever that otoken was collateralised in, this can vary. If the collateral asset of the otoken redeemed was the same as the collateral asset of the liquidity pool i.e. usdc then send the proceeds to the liquidity pool. If the collateral asset is anything else, e.g. ETH then we swap it to the collateral asset (USDC) and send the proceeds to the liquidity pool.

### ```withdraw, update, hedgeDelta ``` ***Access Controlled to the LiquidityPool***
These are functions required by the IHedgingReactor interface which is necessary because the exchange is a reactor. update returns 0 and hedgeDelta reverts such that if it is accidentally called it doesnt trigger a RebalancePortfolioDelta event on the LiquidityPool. Whereas withdraw simply returns any loose USDC held in the exchange to the liquidity pool if called.





