# Solidity API

## AddressBook

### OTOKEN_IMPL

```solidity
bytes32 OTOKEN_IMPL
```

_Otoken implementation key_

### OTOKEN_FACTORY

```solidity
bytes32 OTOKEN_FACTORY
```

_OtokenFactory key_

### WHITELIST

```solidity
bytes32 WHITELIST
```

_Whitelist key_

### CONTROLLER

```solidity
bytes32 CONTROLLER
```

_Controller key_

### MARGIN_POOL

```solidity
bytes32 MARGIN_POOL
```

_MarginPool key_

### MARGIN_CALCULATOR

```solidity
bytes32 MARGIN_CALCULATOR
```

_MarginCalculator key_

### LIQUIDATION_MANAGER

```solidity
bytes32 LIQUIDATION_MANAGER
```

_LiquidationManager key_

### ORACLE

```solidity
bytes32 ORACLE
```

_Oracle key_

### addresses

```solidity
mapping(bytes32 => address) addresses
```

_mapping between key and address_

### ProxyCreated

```solidity
event ProxyCreated(bytes32 id, address proxy)
```

emits an event when a new proxy is created

### AddressAdded

```solidity
event AddressAdded(bytes32 id, address add)
```

emits an event when a new address is added

### getOtokenImpl

```solidity
function getOtokenImpl() external view returns (address)
```

return Otoken implementation address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Otoken implementation address |

### getOtokenFactory

```solidity
function getOtokenFactory() external view returns (address)
```

return oTokenFactory address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | OtokenFactory address |

### getWhitelist

```solidity
function getWhitelist() external view returns (address)
```

return Whitelist address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Whitelist address |

### getController

```solidity
function getController() external view returns (address)
```

return Controller address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Controller address |

### getMarginPool

```solidity
function getMarginPool() external view returns (address)
```

return MarginPool address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | MarginPool address |

### getMarginCalculator

```solidity
function getMarginCalculator() external view returns (address)
```

return MarginCalculator address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | MarginCalculator address |

### getLiquidationManager

```solidity
function getLiquidationManager() external view returns (address)
```

return LiquidationManager address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | LiquidationManager address |

### getOracle

```solidity
function getOracle() external view returns (address)
```

return Oracle address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Oracle address |

### setOtokenImpl

```solidity
function setOtokenImpl(address _otokenImpl) external
```

set Otoken implementation address

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otokenImpl | address | Otoken implementation address |

### setOtokenFactory

```solidity
function setOtokenFactory(address _otokenFactory) external
```

set OtokenFactory address

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otokenFactory | address | OtokenFactory address |

### setWhitelist

```solidity
function setWhitelist(address _whitelist) external
```

set Whitelist address

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _whitelist | address | Whitelist address |

### setController

```solidity
function setController(address _controller) external
```

set Controller address

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _controller | address | Controller address |

### setMarginPool

```solidity
function setMarginPool(address _marginPool) external
```

set MarginPool address

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _marginPool | address | MarginPool address |

### setMarginCalculator

```solidity
function setMarginCalculator(address _marginCalculator) external
```

set MarginCalculator address

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _marginCalculator | address | MarginCalculator address |

### setLiquidationManager

```solidity
function setLiquidationManager(address _liquidationManager) external
```

set LiquidationManager address

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _liquidationManager | address | LiquidationManager address |

### setOracle

```solidity
function setOracle(address _oracle) external
```

set Oracle address

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oracle | address | Oracle address |

### getAddress

```solidity
function getAddress(bytes32 _key) public view returns (address)
```

return an address for specific key

| Name | Type | Description |
| ---- | ---- | ----------- |
| _key | bytes32 | key address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | address |

### setAddress

```solidity
function setAddress(bytes32 _key, address _address) public
```

set a specific address for a specific key

_can only be called by the addressbook owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _key | bytes32 | key |
| _address | address | address |

### updateImpl

```solidity
function updateImpl(bytes32 _id, address _newAddress) public
```

_function to update the implementation of a specific component of the protocol_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _id | bytes32 | id of the contract to be updated |
| _newAddress | address | address of the new implementation |

## Controller

Contract that controls the Gamma Protocol and the interaction of all sub contracts

### addressbook

```solidity
contract AddressBookInterface addressbook
```

### whitelist

```solidity
contract WhitelistInterface whitelist
```

### oracle

```solidity
contract OracleInterface oracle
```

### calculator

```solidity
contract MarginCalculatorInterface calculator
```

### pool

```solidity
contract MarginPoolInterface pool
```

### BASE

```solidity
uint256 BASE
```

_scale used in MarginCalculator_

### partialPauser

```solidity
address partialPauser
```

address that has permission to partially pause the system, where system functionality is paused
except redeem and settleVault

### fullPauser

```solidity
address fullPauser
```

address that has permission to fully pause the system, where all system functionality is paused

### systemPartiallyPaused

```solidity
bool systemPartiallyPaused
```

True if all system functionality is paused other than redeem and settle vault

### systemFullyPaused

```solidity
bool systemFullyPaused
```

True if all system functionality is paused

### callRestricted

```solidity
bool callRestricted
```

True if a call action can only be executed to a whitelisted callee

### accountVaultCounter

```solidity
mapping(address => uint256) accountVaultCounter
```

_mapping between an owner address and the number of owner address vaults_

### vaults

```solidity
mapping(address => mapping(uint256 => struct MarginVault.Vault)) vaults
```

_mapping between an owner address and a specific vault using a vault id_

### operators

```solidity
mapping(address => mapping(address => bool)) operators
```

_mapping between an account owner and their approved or unapproved account operators_

### vaultType

```solidity
mapping(address => mapping(uint256 => uint256)) vaultType
```

_mapping to map vault by each vault type, naked margin vault should be set to 1, spread/max loss vault should be set to 0_

### vaultLatestUpdate

```solidity
mapping(address => mapping(uint256 => uint256)) vaultLatestUpdate
```

_mapping to store the timestamp at which the vault was last updated, will be updated in every action that changes the vault state or when calling sync()_

### nakedCap

```solidity
mapping(address => uint256) nakedCap
```

_mapping to store cap amount for naked margin vault per options collateral asset (scaled by collateral asset decimals)_

### nakedPoolBalance

```solidity
mapping(address => uint256) nakedPoolBalance
```

_mapping to store amount of naked margin vaults in pool_

### AccountOperatorUpdated

```solidity
event AccountOperatorUpdated(address accountOwner, address operator, bool isSet)
```

emits an event when an account operator is updated for a specific account owner

### VaultOpened

```solidity
event VaultOpened(address accountOwner, uint256 vaultId, uint256 vaultType)
```

emits an event when a new vault is opened

### LongOtokenDeposited

```solidity
event LongOtokenDeposited(address otoken, address accountOwner, address from, uint256 vaultId, uint256 amount)
```

emits an event when a long oToken is deposited into a vault

### LongOtokenWithdrawed

```solidity
event LongOtokenWithdrawed(address otoken, address AccountOwner, address to, uint256 vaultId, uint256 amount)
```

emits an event when a long oToken is withdrawn from a vault

### CollateralAssetDeposited

```solidity
event CollateralAssetDeposited(address asset, address accountOwner, address from, uint256 vaultId, uint256 amount)
```

emits an event when a collateral asset is deposited into a vault

### CollateralAssetWithdrawed

```solidity
event CollateralAssetWithdrawed(address asset, address AccountOwner, address to, uint256 vaultId, uint256 amount)
```

emits an event when a collateral asset is withdrawn from a vault

### ShortOtokenMinted

```solidity
event ShortOtokenMinted(address otoken, address AccountOwner, address to, uint256 vaultId, uint256 amount)
```

emits an event when a short oToken is minted from a vault

### ShortOtokenBurned

```solidity
event ShortOtokenBurned(address otoken, address AccountOwner, address from, uint256 vaultId, uint256 amount)
```

emits an event when a short oToken is burned

### Redeem

```solidity
event Redeem(address otoken, address redeemer, address receiver, address collateralAsset, uint256 otokenBurned, uint256 payout)
```

emits an event when an oToken is redeemed

### VaultSettled

```solidity
event VaultSettled(address accountOwner, address oTokenAddress, address to, uint256 payout, uint256 vaultId, uint256 vaultType)
```

emits an event when a vault is settled

### VaultLiquidated

```solidity
event VaultLiquidated(address liquidator, address receiver, address vaultOwner, uint256 auctionPrice, uint256 auctionStartingRound, uint256 collateralPayout, uint256 debtAmount, uint256 vaultId)
```

emits an event when a vault is liquidated

### CallExecuted

```solidity
event CallExecuted(address from, address to, bytes data)
```

emits an event when a call action is executed

### FullPauserUpdated

```solidity
event FullPauserUpdated(address oldFullPauser, address newFullPauser)
```

emits an event when the fullPauser address changes

### PartialPauserUpdated

```solidity
event PartialPauserUpdated(address oldPartialPauser, address newPartialPauser)
```

emits an event when the partialPauser address changes

### SystemPartiallyPaused

```solidity
event SystemPartiallyPaused(bool isPaused)
```

emits an event when the system partial paused status changes

### SystemFullyPaused

```solidity
event SystemFullyPaused(bool isPaused)
```

emits an event when the system fully paused status changes

### CallRestricted

```solidity
event CallRestricted(bool isRestricted)
```

emits an event when the call action restriction changes

### Donated

```solidity
event Donated(address donator, address asset, uint256 amount)
```

emits an event when a donation transfer executed

### NakedCapUpdated

```solidity
event NakedCapUpdated(address collateral, uint256 cap)
```

emits an event when naked cap is updated

### notPartiallyPaused

```solidity
modifier notPartiallyPaused()
```

modifier to check if the system is not partially paused, where only redeem and settleVault is allowed

### notFullyPaused

```solidity
modifier notFullyPaused()
```

modifier to check if the system is not fully paused, where no functionality is allowed

### onlyFullPauser

```solidity
modifier onlyFullPauser()
```

modifier to check if sender is the fullPauser address

### onlyPartialPauser

```solidity
modifier onlyPartialPauser()
```

modifier to check if the sender is the partialPauser address

### onlyAuthorized

```solidity
modifier onlyAuthorized(address _sender, address _accountOwner)
```

modifier to check if the sender is the account owner or an approved account operator

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sender | address | sender address |
| _accountOwner | address | account owner address |

### onlyWhitelistedCallee

```solidity
modifier onlyWhitelistedCallee(address _callee)
```

modifier to check if the called address is a whitelisted callee address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | called address |

### _isNotPartiallyPaused

```solidity
function _isNotPartiallyPaused() internal view
```

_check if the system is not in a partiallyPaused state_

### _isNotFullyPaused

```solidity
function _isNotFullyPaused() internal view
```

_check if the system is not in an fullyPaused state_

### _isAuthorized

```solidity
function _isAuthorized(address _sender, address _accountOwner) internal view
```

_check if the sender is an authorized operator_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sender | address | msg.sender |
| _accountOwner | address | owner of a vault |

### initialize

```solidity
function initialize(address _addressBook, address _owner) external
```

initalize the deployed contract

| Name | Type | Description |
| ---- | ---- | ----------- |
| _addressBook | address | addressbook module |
| _owner | address | account owner address |

### donate

```solidity
function donate(address _asset, uint256 _amount) external
```

send asset amount to margin pool

_use donate() instead of direct transfer() to store the balance in assetBalance_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _amount | uint256 | amount to donate to pool |

### setSystemPartiallyPaused

```solidity
function setSystemPartiallyPaused(bool _partiallyPaused) external
```

allows the partialPauser to toggle the systemPartiallyPaused variable and partially pause or partially unpause the system

_can only be called by the partialPauser_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _partiallyPaused | bool | new boolean value to set systemPartiallyPaused to |

### setSystemFullyPaused

```solidity
function setSystemFullyPaused(bool _fullyPaused) external
```

allows the fullPauser to toggle the systemFullyPaused variable and fully pause or fully unpause the system

_can only be called by the fullyPauser_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fullyPaused | bool | new boolean value to set systemFullyPaused to |

### setFullPauser

```solidity
function setFullPauser(address _fullPauser) external
```

allows the owner to set the fullPauser address

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fullPauser | address | new fullPauser address |

### setPartialPauser

```solidity
function setPartialPauser(address _partialPauser) external
```

allows the owner to set the partialPauser address

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _partialPauser | address | new partialPauser address |

### setCallRestriction

```solidity
function setCallRestriction(bool _isRestricted) external
```

allows the owner to toggle the restriction on whitelisted call actions and only allow whitelisted
call addresses or allow any arbitrary call addresses

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _isRestricted | bool | new call restriction state |

### setOperator

```solidity
function setOperator(address _operator, bool _isOperator) external
```

allows a user to give or revoke privileges to an operator which can act on their behalf on their vaults

_can only be updated by the vault owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _operator | address | operator that the sender wants to give privileges to or revoke them from |
| _isOperator | bool | new boolean value that expresses if the sender is giving or revoking privileges for _operator |

### refreshConfiguration

```solidity
function refreshConfiguration() external
```

_updates the configuration of the controller. can only be called by the owner_

### setNakedCap

```solidity
function setNakedCap(address _collateral, uint256 _cap) external
```

set cap amount for collateral asset used in naked margin

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |
| _cap | uint256 | cap amount, should be scaled by collateral asset decimals |

### operate

```solidity
function operate(struct Actions.ActionArgs[] _actions) external
```

execute a number of actions on specific vaults

_can only be called when the system is not fully paused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _actions | struct Actions.ActionArgs[] | array of actions arguments |

### sync

```solidity
function sync(address _owner, uint256 _vaultId) external
```

sync vault latest update timestamp

_anyone can update the latest time the vault was touched by calling this function
vaultLatestUpdate will sync if the vault is well collateralized_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | vault owner address |
| _vaultId | uint256 | vault id |

### isOperator

```solidity
function isOperator(address _owner, address _operator) external view returns (bool)
```

check if a specific address is an operator for an owner account

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner address |
| _operator | address | account operator address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the _operator is an approved operator for the _owner account |

### getConfiguration

```solidity
function getConfiguration() external view returns (address, address, address, address)
```

returns the current controller configuration

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | whitelist, the address of the whitelist module |
| [1] | address | oracle, the address of the oracle module |
| [2] | address | calculator, the address of the calculator module |
| [3] | address | pool, the address of the pool module |

### getProceed

```solidity
function getProceed(address _owner, uint256 _vaultId) external view returns (uint256)
```

return a vault's proceeds pre or post expiry, the amount of collateral that can be removed from a vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner of the vault |
| _vaultId | uint256 | vaultId to return balances for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of collateral that can be taken out |

### isLiquidatable

```solidity
function isLiquidatable(address _owner, uint256 _vaultId, uint256 _roundId) external view returns (bool, uint256, uint256)
```

check if a vault is liquidatable in a specific round id

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | vault owner address |
| _vaultId | uint256 | vault id to check |
| _roundId | uint256 | chainlink round id to check vault status at |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | isUnderCollat, true if vault is undercollateralized, the price of 1 repaid otoken and the otoken collateral dust amount |
| [1] | uint256 |  |
| [2] | uint256 |  |

### getPayout

```solidity
function getPayout(address _otoken, uint256 _amount) public view returns (uint256)
```

get an oToken's payout/cash value after expiry, in the collateral asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken address |
| _amount | uint256 | amount of the oToken to calculate the payout for, always represented in 1e8 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of collateral to pay out |

### isSettlementAllowed

```solidity
function isSettlementAllowed(address _otoken) external view returns (bool)
```

_return if an expired oToken is ready to be settled, only true when price for underlying,
strike and collateral assets at this specific expiry is available in our Oracle module_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken |

### canSettleAssets

```solidity
function canSettleAssets(address _underlying, address _strike, address _collateral, uint256 _expiry) external view returns (bool)
```

_return if underlying, strike, collateral are all allowed to be settled_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | oToken underlying asset |
| _strike | address | oToken strike asset |
| _collateral | address | oToken collateral asset |
| _expiry | uint256 | otoken expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the oToken has expired AND all oracle prices at the expiry timestamp have been finalized, False if not |

### getAccountVaultCounter

```solidity
function getAccountVaultCounter(address _accountOwner) external view returns (uint256)
```

get the number of vaults for a specified account owner

| Name | Type | Description |
| ---- | ---- | ----------- |
| _accountOwner | address | account owner address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | number of vaults |

### hasExpired

```solidity
function hasExpired(address _otoken) external view returns (bool)
```

check if an oToken has expired

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the otoken has expired, False if not |

### getVault

```solidity
function getVault(address _owner, uint256 _vaultId) external view returns (struct MarginVault.Vault)
```

return a specific vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner |
| _vaultId | uint256 | vault id of vault to return |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct MarginVault.Vault | Vault struct that corresponds to the _vaultId of _owner |

### getVaultWithDetails

```solidity
function getVaultWithDetails(address _owner, uint256 _vaultId) public view returns (struct MarginVault.Vault, uint256, uint256)
```

return a specific vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner |
| _vaultId | uint256 | vault id of vault to return |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct MarginVault.Vault | Vault struct that corresponds to the _vaultId of _owner, vault type and the latest timestamp when the vault was updated |
| [1] | uint256 |  |
| [2] | uint256 |  |

### getNakedCap

```solidity
function getNakedCap(address _asset) external view returns (uint256)
```

get cap amount for collateral asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | collateral asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | cap amount |

### getNakedPoolBalance

```solidity
function getNakedPoolBalance(address _asset) external view returns (uint256)
```

get amount of collateral deposited in all naked margin vaults

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | collateral asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | naked pool balance |

### _runActions

```solidity
function _runActions(struct Actions.ActionArgs[] _actions) internal returns (bool, address, uint256)
```

execute a variety of actions

_for each action in the action array, execute the corresponding action, only one vault can be modified
for all actions except SettleVault, Redeem, and Call_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _actions | struct Actions.ActionArgs[] | array of type Actions.ActionArgs[], which expresses which actions the user wants to execute |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | vaultUpdated, indicates if a vault has changed |
| [1] | address | owner, the vault owner if a vault has changed |
| [2] | uint256 | vaultId, the vault Id if a vault has changed |

### _verifyFinalState

```solidity
function _verifyFinalState(address _owner, uint256 _vaultId) internal view
```

verify the vault final state after executing all actions

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner address |
| _vaultId | uint256 | vault id of the final vault |

### _openVault

```solidity
function _openVault(struct Actions.OpenVaultArgs _args) internal
```

open a new vault inside an account

_only the account owner or operator can open a vault, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.OpenVaultArgs | OpenVaultArgs structure |

### _depositLong

```solidity
function _depositLong(struct Actions.DepositArgs _args) internal
```

deposit a long oToken into a vault

_only the account owner or operator can deposit a long oToken, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.DepositArgs | DepositArgs structure |

### _withdrawLong

```solidity
function _withdrawLong(struct Actions.WithdrawArgs _args) internal
```

withdraw a long oToken from a vault

_only the account owner or operator can withdraw a long oToken, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.WithdrawArgs | WithdrawArgs structure |

### _depositCollateral

```solidity
function _depositCollateral(struct Actions.DepositArgs _args) internal
```

deposit a collateral asset into a vault

_only the account owner or operator can deposit collateral, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.DepositArgs | DepositArgs structure |

### _withdrawCollateral

```solidity
function _withdrawCollateral(struct Actions.WithdrawArgs _args) internal
```

withdraw a collateral asset from a vault

_only the account owner or operator can withdraw collateral, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.WithdrawArgs | WithdrawArgs structure |

### _mintOtoken

```solidity
function _mintOtoken(struct Actions.MintArgs _args) internal
```

mint short oTokens from a vault which creates an obligation that is recorded in the vault

_only the account owner or operator can mint an oToken, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.MintArgs | MintArgs structure |

### _burnOtoken

```solidity
function _burnOtoken(struct Actions.BurnArgs _args) internal
```

burn oTokens to reduce or remove the minted oToken obligation recorded in a vault

_only the account owner or operator can burn an oToken, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.BurnArgs | MintArgs structure |

### _redeem

```solidity
function _redeem(struct Actions.RedeemArgs _args) internal
```

redeem an oToken after expiry, receiving the payout of the oToken in the collateral asset

_cannot be called when system is fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.RedeemArgs | RedeemArgs structure |

### _settleVault

```solidity
function _settleVault(struct Actions.SettleVaultArgs _args) internal
```

settle a vault after expiry, removing the net proceeds/collateral after both long and short oToken payouts have settled

_deletes a vault of vaultId after net proceeds/collateral is removed, cannot be called when system is fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.SettleVaultArgs | SettleVaultArgs structure |

### _liquidate

```solidity
function _liquidate(struct Actions.LiquidateArgs _args) internal
```

liquidate naked margin vault

_can liquidate different vaults id in the same operate() call_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.LiquidateArgs | liquidation action arguments struct |

### _call

```solidity
function _call(struct Actions.CallArgs _args) internal
```

execute arbitrary calls

_cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.CallArgs | Call action |

### _checkVaultId

```solidity
function _checkVaultId(address _accountOwner, uint256 _vaultId) internal view returns (bool)
```

check if a vault id is valid for a given account owner address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _accountOwner | address | account owner address |
| _vaultId | uint256 | vault id to check |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the _vaultId is valid, False if not |

### _isNotEmpty

```solidity
function _isNotEmpty(address[] _array) internal pure returns (bool)
```

### _isCalleeWhitelisted

```solidity
function _isCalleeWhitelisted(address _callee) internal view returns (bool)
```

return if a callee address is whitelisted or not

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | callee address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if callee address is whitelisted, False if not |

### _isLiquidatable

```solidity
function _isLiquidatable(address _owner, uint256 _vaultId, uint256 _roundId) internal view returns (struct MarginVault.Vault, bool, uint256, uint256)
```

check if a vault is liquidatable in a specific round id

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | vault owner address |
| _vaultId | uint256 | vault id to check |
| _roundId | uint256 | chainlink round id to check vault status at |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct MarginVault.Vault | vault struct, isLiquidatable, true if vault is undercollateralized, the price of 1 repaid otoken and the otoken collateral dust amount |
| [1] | bool |  |
| [2] | uint256 |  |
| [3] | uint256 |  |

### _getOtokenDetails

```solidity
function _getOtokenDetails(address _otoken) internal view returns (address, address, address, uint256)
```

_get otoken detail, from both otoken versions_

### _canSettleAssets

```solidity
function _canSettleAssets(address _underlying, address _strike, address _collateral, uint256 _expiry) internal view returns (bool)
```

_return if an expired oToken is ready to be settled, only true when price for underlying,
strike and collateral assets at this specific expiry is available in our Oracle module_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the oToken has expired AND all oracle prices at the expiry timestamp have been finalized, False if not |

### _refreshConfigInternal

```solidity
function _refreshConfigInternal() internal
```

_updates the internal configuration of the controller_

## MarginCalculator

Calculator module that checks if a given vault is valid, calculates margin requirements, and settlement proceeds

### SCALING_FACTOR

```solidity
uint256 SCALING_FACTOR
```

_decimals option upper bound value, spot shock and oracle deviation_

### BASE

```solidity
uint256 BASE
```

_decimals used by strike price and oracle price_

### AUCTION_TIME

```solidity
uint256 AUCTION_TIME
```

auction length

### VaultDetails

```solidity
struct VaultDetails {
  address shortUnderlyingAsset;
  address shortStrikeAsset;
  address shortCollateralAsset;
  address longUnderlyingAsset;
  address longStrikeAsset;
  address longCollateralAsset;
  uint256 shortStrikePrice;
  uint256 shortExpiryTimestamp;
  uint256 shortCollateralDecimals;
  uint256 longStrikePrice;
  uint256 longExpiryTimestamp;
  uint256 longCollateralDecimals;
  uint256 collateralDecimals;
  uint256 vaultType;
  bool isShortPut;
  bool isLongPut;
  bool hasLong;
  bool hasShort;
  bool hasCollateral;
}
```

### oracleDeviation

```solidity
uint256 oracleDeviation
```

_oracle deviation value (1e27)_

### ZERO

```solidity
struct FixedPointInt256.FixedPointInt ZERO
```

_FixedPoint 0_

### dust

```solidity
mapping(address => uint256) dust
```

_mapping to store dust amount per option collateral asset (scaled by collateral asset decimals)_

### timesToExpiryForProduct

```solidity
mapping(bytes32 => uint256[]) timesToExpiryForProduct
```

_mapping to store array of time to expiry for a given product_

### maxPriceAtTimeToExpiry

```solidity
mapping(bytes32 => mapping(uint256 => uint256)) maxPriceAtTimeToExpiry
```

_mapping to store option upper bound value at specific time to expiry for a given product (1e27)_

### spotShock

```solidity
mapping(bytes32 => uint256) spotShock
```

_mapping to store shock value for spot price of a given product (1e27)_

### oracle

```solidity
contract OracleInterface oracle
```

_oracle module_

### CollateralDustUpdated

```solidity
event CollateralDustUpdated(address collateral, uint256 dust)
```

emits an event when collateral dust is updated

### TimeToExpiryAdded

```solidity
event TimeToExpiryAdded(bytes32 productHash, uint256 timeToExpiry)
```

emits an event when new time to expiry is added for a specific product

### MaxPriceAdded

```solidity
event MaxPriceAdded(bytes32 productHash, uint256 timeToExpiry, uint256 value)
```

emits an event when new upper bound value is added for a specific time to expiry timestamp

### MaxPriceUpdated

```solidity
event MaxPriceUpdated(bytes32 productHash, uint256 timeToExpiry, uint256 oldValue, uint256 newValue)
```

emits an event when updating upper bound value at specific expiry timestamp

### SpotShockUpdated

```solidity
event SpotShockUpdated(bytes32 product, uint256 spotShock)
```

emits an event when spot shock value is updated for a specific product

### OracleDeviationUpdated

```solidity
event OracleDeviationUpdated(uint256 oracleDeviation)
```

emits an event when oracle deviation value is updated

### constructor

```solidity
constructor(address _oracle) public
```

constructor

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oracle | address | oracle module address |

### setCollateralDust

```solidity
function setCollateralDust(address _collateral, uint256 _dust) external
```

set dust amount for collateral asset

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |
| _dust | uint256 | dust amount, should be scaled by collateral asset decimals |

### setUpperBoundValues

```solidity
function setUpperBoundValues(address _underlying, address _strike, address _collateral, bool _isPut, uint256[] _timesToExpiry, uint256[] _values) external
```

set product upper bound values

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |
| _timesToExpiry | uint256[] | array of times to expiry timestamp |
| _values | uint256[] | upper bound values array |

### updateUpperBoundValue

```solidity
function updateUpperBoundValue(address _underlying, address _strike, address _collateral, bool _isPut, uint256 _timeToExpiry, uint256 _value) external
```

set option upper bound value for specific time to expiry (1e27)

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |
| _timeToExpiry | uint256 | option time to expiry timestamp |
| _value | uint256 | upper bound value |

### setSpotShock

```solidity
function setSpotShock(address _underlying, address _strike, address _collateral, bool _isPut, uint256 _shockValue) external
```

set spot shock value, scaled to 1e27

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |
| _shockValue | uint256 | spot shock value |

### setOracleDeviation

```solidity
function setOracleDeviation(uint256 _deviation) external
```

set oracle deviation (1e27)

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviation | uint256 | deviation value |

### getCollateralDust

```solidity
function getCollateralDust(address _collateral) external view returns (uint256)
```

get dust amount for collateral asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | dust amount |

### getTimesToExpiry

```solidity
function getTimesToExpiry(address _underlying, address _strike, address _collateral, bool _isPut) external view returns (uint256[])
```

get times to expiry for a specific product

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256[] | array of times to expiry |

### getMaxPrice

```solidity
function getMaxPrice(address _underlying, address _strike, address _collateral, bool _isPut, uint256 _timeToExpiry) external view returns (uint256)
```

get option upper bound value for specific time to expiry

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |
| _timeToExpiry | uint256 | option time to expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | option upper bound value (1e27) |

### getSpotShock

```solidity
function getSpotShock(address _underlying, address _strike, address _collateral, bool _isPut) external view returns (uint256)
```

get spot shock value

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | _shockValue spot shock value (1e27) |

### getOracleDeviation

```solidity
function getOracleDeviation() external view returns (uint256)
```

get oracle deviation

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | oracle deviation value (1e27) |

### getNakedMarginRequired

```solidity
function getNakedMarginRequired(address _underlying, address _strike, address _collateral, uint256 _shortAmount, uint256 _strikePrice, uint256 _underlyingPrice, uint256 _shortExpiryTimestamp, uint256 _collateralDecimals, bool _isPut) external view returns (uint256)
```

return the collateral required for naked margin vault, in collateral asset decimals

__shortAmount, _strikePrice and _underlyingPrice should be scaled by 1e8_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | underlying asset address |
| _strike | address | strike asset address |
| _collateral | address | collateral asset address |
| _shortAmount | uint256 | amount of short otoken |
| _strikePrice | uint256 | otoken strike price |
| _underlyingPrice | uint256 | otoken underlying price |
| _shortExpiryTimestamp | uint256 | otoken expiry timestamp |
| _collateralDecimals | uint256 | otoken collateral asset decimals |
| _isPut | bool | otoken type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | collateral required for a naked margin vault, in collateral asset decimals |

### getExpiredPayoutRate

```solidity
function getExpiredPayoutRate(address _otoken) external view returns (uint256)
```

return the cash value of an expired oToken, denominated in collateral

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | how much collateral can be taken out by 1 otoken unit, scaled by 1e8, or how much collateral can be taken out for 1 (1e8) oToken |

### ShortScaledDetails

```solidity
struct ShortScaledDetails {
  struct FixedPointInt256.FixedPointInt shortAmount;
  struct FixedPointInt256.FixedPointInt shortStrike;
  struct FixedPointInt256.FixedPointInt shortUnderlyingPrice;
}
```

### isLiquidatable

```solidity
function isLiquidatable(struct MarginVault.Vault _vault, uint256 _vaultType, uint256 _vaultLatestUpdate, uint256 _roundId) external view returns (bool, uint256, uint256)
```

check if a specific vault is undercollateralized at a specific chainlink round

_if the vault is of type 0, the function will revert_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault struct |
| _vaultType | uint256 | vault type (0 for max loss/spread and 1 for naked margin vault) |
| _vaultLatestUpdate | uint256 | vault latest update (timestamp when latest vault state change happened) |
| _roundId | uint256 | chainlink round id |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | isLiquidatable, true if vault is undercollateralized, liquidation price and collateral dust amount |
| [1] | uint256 |  |
| [2] | uint256 |  |

### getMarginRequired

```solidity
function getMarginRequired(struct MarginVault.Vault _vault, uint256 _vaultType) external view returns (struct FixedPointInt256.FixedPointInt, struct FixedPointInt256.FixedPointInt)
```

calculate required collateral margin for a vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | theoretical vault that needs to be checked |
| _vaultType | uint256 | vault type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | the vault collateral amount, and marginRequired the minimal amount of collateral needed in a vault, scaled to 1e27 |
| [1] | struct FixedPointInt256.FixedPointInt |  |

### getExcessCollateral

```solidity
function getExcessCollateral(struct MarginVault.Vault _vault, uint256 _vaultType) public view returns (uint256, bool)
```

returns the amount of collateral that can be removed from an actual or a theoretical vault

_return amount is denominated in the collateral asset for the oToken in the vault, or the collateral asset in the vault_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | theoretical vault that needs to be checked |
| _vaultType | uint256 | vault type (0 for spread/max loss, 1 for naked margin) |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | excessCollateral the amount by which the margin is above or below the required amount |
| [1] | bool | isExcess True if there is excess margin in the vault, False if there is a deficit of margin in the vault if True, collateral can be taken out from the vault, if False, additional collateral needs to be added to vault |

### _getExpiredCashValue

```solidity
function _getExpiredCashValue(address _underlying, address _strike, uint256 _expiryTimestamp, uint256 _strikePrice, bool _isPut) internal view returns (struct FixedPointInt256.FixedPointInt)
```

return the cash value of an expired oToken, denominated in strike asset

_for a call, return Max (0, underlyingPriceInStrike - otoken.strikePrice)
for a put, return Max(0, otoken.strikePrice - underlyingPriceInStrike)_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _expiryTimestamp | uint256 | otoken expiry timestamp |
| _strikePrice | uint256 | otoken strike price |
| _isPut | bool |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | cash value of an expired otoken, denominated in the strike asset |

### OtokenDetails

```solidity
struct OtokenDetails {
  address otokenUnderlyingAsset;
  address otokenCollateralAsset;
  address otokenStrikeAsset;
  uint256 otokenExpiry;
  bool isPut;
}
```

### _getMarginRequired

```solidity
function _getMarginRequired(struct MarginVault.Vault _vault, struct MarginCalculator.VaultDetails _vaultDetails) internal view returns (struct FixedPointInt256.FixedPointInt, struct FixedPointInt256.FixedPointInt)
```

calculate the amount of collateral needed for a vault

_vault passed in has already passed the checkIsValidVault function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | theoretical vault that needs to be checked |
| _vaultDetails | struct MarginCalculator.VaultDetails |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | the vault collateral amount, and marginRequired the minimal amount of collateral needed in a vault, scaled to 1e27 |
| [1] | struct FixedPointInt256.FixedPointInt |  |

### _getNakedMarginRequired

```solidity
function _getNakedMarginRequired(bytes32 _productHash, struct FixedPointInt256.FixedPointInt _shortAmount, struct FixedPointInt256.FixedPointInt _underlyingPrice, struct FixedPointInt256.FixedPointInt _strikePrice, uint256 _shortExpiryTimestamp, bool _isPut) internal view returns (struct FixedPointInt256.FixedPointInt)
```

get required collateral for naked margin position
if put:
a = min(strike price, spot shock * underlying price)
b = max(strike price - spot shock * underlying price, 0)
marginRequired = ( option upper bound value * a + b) * short amount
if call:
a = min(1, strike price / (underlying price / spot shock value))
b = max(1- (strike price / (underlying price / spot shock value)), 0)
marginRequired = (option upper bound value * a + b) * short amount

| Name | Type | Description |
| ---- | ---- | ----------- |
| _productHash | bytes32 | product hash |
| _shortAmount | struct FixedPointInt256.FixedPointInt | short amount in vault, in FixedPointInt type |
| _underlyingPrice | struct FixedPointInt256.FixedPointInt | underlying price of short otoken underlying asset, in FixedPointInt type |
| _strikePrice | struct FixedPointInt256.FixedPointInt | strike price of short otoken, in FixedPointInt type |
| _shortExpiryTimestamp | uint256 | short otoken expiry timestamp |
| _isPut | bool | otoken type, true if put option, false for call option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | required margin for this naked vault, in FixedPointInt type (scaled by 1e27) |

### _findUpperBoundValue

```solidity
function _findUpperBoundValue(bytes32 _productHash, uint256 _expiryTimestamp) internal view returns (struct FixedPointInt256.FixedPointInt)
```

find upper bound value for product by specific expiry timestamp

_should return the upper bound value that correspond to option time to expiry, of if not found should return the next greater one, revert if no value found_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _productHash | bytes32 | product hash |
| _expiryTimestamp | uint256 | expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | option upper bound value |

### _getPutSpreadMarginRequired

```solidity
function _getPutSpreadMarginRequired(struct FixedPointInt256.FixedPointInt _shortAmount, struct FixedPointInt256.FixedPointInt _longAmount, struct FixedPointInt256.FixedPointInt _shortStrike, struct FixedPointInt256.FixedPointInt _longStrike) internal view returns (struct FixedPointInt256.FixedPointInt)
```

_returns the strike asset amount of margin required for a put or put spread with the given short oTokens, long oTokens and amounts

marginRequired = max( (short amount * short strike) - (long strike * min (short amount, long amount)) , 0 )_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | margin requirement denominated in the strike asset |

### _getCallSpreadMarginRequired

```solidity
function _getCallSpreadMarginRequired(struct FixedPointInt256.FixedPointInt _shortAmount, struct FixedPointInt256.FixedPointInt _longAmount, struct FixedPointInt256.FixedPointInt _shortStrike, struct FixedPointInt256.FixedPointInt _longStrike) internal view returns (struct FixedPointInt256.FixedPointInt)
```

_returns the underlying asset amount required for a call or call spread with the given short oTokens, long oTokens, and amounts

                          (long strike - short strike) * short amount
marginRequired =  max( ------------------------------------------------- , max (short amount - long amount, 0) )
                                          long strike

if long strike = 0, return max( short amount - long amount, 0)_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | margin requirement denominated in the underlying asset |

### _convertAmountOnLivePrice

```solidity
function _convertAmountOnLivePrice(struct FixedPointInt256.FixedPointInt _amount, address _assetA, address _assetB) internal view returns (struct FixedPointInt256.FixedPointInt)
```

convert an amount in asset A to equivalent amount of asset B, based on a live price

_function includes the amount and applies .mul() first to increase the accuracy_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | struct FixedPointInt256.FixedPointInt | amount in asset A |
| _assetA | address | asset A |
| _assetB | address | asset B |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | _amount in asset B |

### _convertAmountOnExpiryPrice

```solidity
function _convertAmountOnExpiryPrice(struct FixedPointInt256.FixedPointInt _amount, address _assetA, address _assetB, uint256 _expiry) internal view returns (struct FixedPointInt256.FixedPointInt)
```

convert an amount in asset A to equivalent amount of asset B, based on an expiry price

_function includes the amount and apply .mul() first to increase the accuracy_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | struct FixedPointInt256.FixedPointInt | amount in asset A |
| _assetA | address | asset A |
| _assetB | address | asset B |
| _expiry | uint256 |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | _amount in asset B |

### _getDebtPrice

```solidity
function _getDebtPrice(struct FixedPointInt256.FixedPointInt _vaultCollateral, struct FixedPointInt256.FixedPointInt _vaultDebt, struct FixedPointInt256.FixedPointInt _cashValue, struct FixedPointInt256.FixedPointInt _spotPrice, uint256 _auctionStartingTime, uint256 _collateralDecimals, bool _isPut) internal view returns (uint256)
```

return debt price, how much collateral asset per 1 otoken repaid in collateral decimal
ending price = vault collateral / vault debt
if auction ended, return ending price
else calculate starting price
for put option:
starting price = max(cash value - underlying price * oracle deviation, 0)
for call option:
                     max(cash value - underlying price * oracle deviation, 0)
starting price =  ---------------------------------------------------------------
                                         underlying price

                 starting price + (ending price - starting price) * auction elapsed time
then price = --------------------------------------------------------------------------
                                     auction time

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultCollateral | struct FixedPointInt256.FixedPointInt | vault collateral amount |
| _vaultDebt | struct FixedPointInt256.FixedPointInt | vault short amount |
| _cashValue | struct FixedPointInt256.FixedPointInt | option cash value |
| _spotPrice | struct FixedPointInt256.FixedPointInt | option underlying asset price (in USDC) |
| _auctionStartingTime | uint256 | auction starting timestamp (_spotPrice timestamp from chainlink) |
| _collateralDecimals | uint256 | collateral asset decimals |
| _isPut | bool | otoken type, true for put, false for call option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of 1 debt otoken in collateral asset scaled by collateral decimals |

### _getVaultDetails

```solidity
function _getVaultDetails(struct MarginVault.Vault _vault, uint256 _vaultType) internal view returns (struct MarginCalculator.VaultDetails)
```

get vault details to save us from making multiple external calls

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault struct |
| _vaultType | uint256 | vault type, 0 for max loss/spreads and 1 for naked margin vault |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct MarginCalculator.VaultDetails | vault details in VaultDetails struct |

### _getExpiredSpreadCashValue

```solidity
function _getExpiredSpreadCashValue(struct FixedPointInt256.FixedPointInt _shortAmount, struct FixedPointInt256.FixedPointInt _longAmount, struct FixedPointInt256.FixedPointInt _shortCashValue, struct FixedPointInt256.FixedPointInt _longCashValue) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

_calculate the cash value obligation for an expired vault, where a positive number is an obligation

Formula: net = (short cash value * short amount) - ( long cash value * long Amount )_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | cash value obligation denominated in the strike asset |

### _isNotEmpty

```solidity
function _isNotEmpty(address[] _assets) internal pure returns (bool)
```

_check if asset array contain a token address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the array is not empty |

### _checkIsValidVault

```solidity
function _checkIsValidVault(struct MarginVault.Vault _vault, struct MarginCalculator.VaultDetails _vaultDetails) internal pure
```

_ensure that:
a) at most 1 asset type used as collateral
b) at most 1 series of option used as the long option
c) at most 1 series of option used as the short option
d) asset array lengths match for long, short and collateral
e) long option and collateral asset is acceptable for margin with short asset_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | the vault to check |
| _vaultDetails | struct MarginCalculator.VaultDetails | vault details struct |

### _isMarginableLong

```solidity
function _isMarginableLong(struct MarginVault.Vault _vault, struct MarginCalculator.VaultDetails _vaultDetails) internal pure returns (bool)
```

_if there is a short option and a long option in the vault, ensure that the long option is able to be used as collateral for the short option_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | the vault to check |
| _vaultDetails | struct MarginCalculator.VaultDetails | vault details struct |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if long is marginable or false if not |

### _isMarginableCollateral

```solidity
function _isMarginableCollateral(struct MarginVault.Vault _vault, struct MarginCalculator.VaultDetails _vaultDetails) internal pure returns (bool)
```

_if there is short option and collateral asset in the vault, ensure that the collateral asset is valid for the short option_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | the vault to check |
| _vaultDetails | struct MarginCalculator.VaultDetails | vault details struct |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if marginable or false |

### _getProductHash

```solidity
function _getProductHash(address _underlying, address _strike, address _collateral, bool _isPut) internal pure returns (bytes32)
```

get a product hash

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | option underlying asset |
| _strike | address | option strike asset |
| _collateral | address | option collateral asset |
| _isPut | bool | option type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | product hash |

### _getCashValue

```solidity
function _getCashValue(struct FixedPointInt256.FixedPointInt _strikePrice, struct FixedPointInt256.FixedPointInt _underlyingPrice, bool _isPut) internal view returns (struct FixedPointInt256.FixedPointInt)
```

get option cash value

_this assume that the underlying price is denominated in strike asset
cash value = max(underlying price - strike price, 0)_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _strikePrice | struct FixedPointInt256.FixedPointInt | option strike price |
| _underlyingPrice | struct FixedPointInt256.FixedPointInt | option underlying price |
| _isPut | bool | option type, true for put and false for call option |

### _getOtokenDetails

```solidity
function _getOtokenDetails(address _otoken) internal view returns (address, address, address, uint256, uint256, bool)
```

_get otoken detail, from both otoken versions_

## MarginPool

Contract that holds all protocol funds

### addressBook

```solidity
address addressBook
```

AddressBook module

### farmer

```solidity
address farmer
```

_the address that has the ability to withdraw excess assets in the pool_

### assetBalance

```solidity
mapping(address => uint256) assetBalance
```

_mapping between an asset and the amount of the asset in the pool_

### constructor

```solidity
constructor(address _addressBook) public
```

contructor

| Name | Type | Description |
| ---- | ---- | ----------- |
| _addressBook | address | AddressBook module |

### TransferToPool

```solidity
event TransferToPool(address asset, address user, uint256 amount)
```

emits an event when marginpool receive funds from controller

### TransferToUser

```solidity
event TransferToUser(address asset, address user, uint256 amount)
```

emits an event when marginpool transfer funds to controller

### FarmerUpdated

```solidity
event FarmerUpdated(address oldAddress, address newAddress)
```

emit event after updating the farmer address

### AssetFarmed

```solidity
event AssetFarmed(address asset, address receiver, uint256 amount)
```

emit event when an asset gets harvested from the pool

### onlyController

```solidity
modifier onlyController()
```

check if the sender is the Controller module

### onlyFarmer

```solidity
modifier onlyFarmer()
```

check if the sender is the farmer address

### transferToPool

```solidity
function transferToPool(address _asset, address _user, uint256 _amount) public
```

transfers an asset from a user to the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | address of the asset to transfer |
| _user | address | address of the user to transfer assets from |
| _amount | uint256 | amount of the token to transfer from _user |

### transferToUser

```solidity
function transferToUser(address _asset, address _user, uint256 _amount) public
```

transfers an asset from the pool to a user

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | address of the asset to transfer |
| _user | address | address of the user to transfer assets to |
| _amount | uint256 | amount of the token to transfer to _user |

### getStoredBalance

```solidity
function getStoredBalance(address _asset) external view returns (uint256)
```

get the stored balance of an asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | asset balance |

### batchTransferToPool

```solidity
function batchTransferToPool(address[] _asset, address[] _user, uint256[] _amount) external
```

transfers multiple assets from users to the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address[] | addresses of the assets to transfer |
| _user | address[] | addresses of the users to transfer assets to |
| _amount | uint256[] | amount of each token to transfer to pool |

### batchTransferToUser

```solidity
function batchTransferToUser(address[] _asset, address[] _user, uint256[] _amount) external
```

transfers multiple assets from the pool to users

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address[] | addresses of the assets to transfer |
| _user | address[] | addresses of the users to transfer assets to |
| _amount | uint256[] | amount of each token to transfer to _user |

### farm

```solidity
function farm(address _asset, address _receiver, uint256 _amount) external
```

function to collect the excess balance of a particular asset

_can only be called by the farmer address. Do not farm otokens._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _receiver | address | receiver address |
| _amount | uint256 | amount to remove from pool |

### setFarmer

```solidity
function setFarmer(address _farmer) external
```

function to set farmer address

_can only be called by MarginPool owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmer | address | farmer address |

## Oracle

The Oracle module sets, retrieves, and stores USD prices (USD per asset) for underlying, collateral, and strike assets
manages pricers that are used for different assets

### Price

```solidity
struct Price {
  uint256 price;
  uint256 timestamp;
}
```

### disputer

```solidity
address disputer
```

/ @dev disputer is a role defined by the owner that has the ability to dispute a price during the dispute period

### migrated

```solidity
bool migrated
```

### pricerLockingPeriod

```solidity
mapping(address => uint256) pricerLockingPeriod
```

_mapping of asset pricer to its locking period
locking period is the period of time after the expiry timestamp where a price can not be pushed_

### pricerDisputePeriod

```solidity
mapping(address => uint256) pricerDisputePeriod
```

_mapping of asset pricer to its dispute period
dispute period is the period of time after an expiry price has been pushed where a price can be disputed_

### assetPricer

```solidity
mapping(address => address) assetPricer
```

_mapping between an asset and its pricer_

### storedPrice

```solidity
mapping(address => mapping(uint256 => struct Oracle.Price)) storedPrice
```

_mapping between asset, expiry timestamp, and the Price structure at the expiry timestamp_

### stablePrice

```solidity
mapping(address => uint256) stablePrice
```

_mapping between stable asset and price_

### DisputerUpdated

```solidity
event DisputerUpdated(address newDisputer)
```

emits an event when the disputer is updated

### PricerUpdated

```solidity
event PricerUpdated(address asset, address pricer)
```

emits an event when the pricer is updated for an asset

### PricerLockingPeriodUpdated

```solidity
event PricerLockingPeriodUpdated(address pricer, uint256 lockingPeriod)
```

emits an event when the locking period is updated for a pricer

### PricerDisputePeriodUpdated

```solidity
event PricerDisputePeriodUpdated(address pricer, uint256 disputePeriod)
```

emits an event when the dispute period is updated for a pricer

### ExpiryPriceUpdated

```solidity
event ExpiryPriceUpdated(address asset, uint256 expiryTimestamp, uint256 price, uint256 onchainTimestamp)
```

emits an event when an expiry price is updated for a specific asset

### ExpiryPriceDisputed

```solidity
event ExpiryPriceDisputed(address asset, uint256 expiryTimestamp, uint256 disputedPrice, uint256 newPrice, uint256 disputeTimestamp)
```

emits an event when the disputer disputes a price during the dispute period

### StablePriceUpdated

```solidity
event StablePriceUpdated(address asset, uint256 price)
```

emits an event when a stable asset price changes

### migrateOracle

```solidity
function migrateOracle(address _asset, uint256[] _expiries, uint256[] _prices) external
```

function to mgirate asset prices from old oracle to new deployed oracle

_this can only be called by owner, should be used at the deployment time before setting Oracle module into AddressBook_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _expiries | uint256[] | array of expiries timestamps |
| _prices | uint256[] | array of prices |

### endMigration

```solidity
function endMigration() external
```

end migration process

_can only be called by owner, should be called before setting Oracle module into AddressBook_

### setAssetPricer

```solidity
function setAssetPricer(address _asset, address _pricer) external
```

sets the pricer for an asset

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _pricer | address | pricer address |

### setLockingPeriod

```solidity
function setLockingPeriod(address _pricer, uint256 _lockingPeriod) external
```

sets the locking period for a pricer

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _pricer | address | pricer address |
| _lockingPeriod | uint256 | locking period |

### setDisputePeriod

```solidity
function setDisputePeriod(address _pricer, uint256 _disputePeriod) external
```

sets the dispute period for a pricer

_can only be called by the owner
for a composite pricer (ie CompoundPricer) that depends on or calls other pricers, ensure
that the dispute period for the composite pricer is longer than the dispute period for the
asset pricer that it calls to ensure safe usage as a dispute in the other pricer will cause
the need for a dispute with the composite pricer's price_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _pricer | address | pricer address |
| _disputePeriod | uint256 | dispute period |

### setDisputer

```solidity
function setDisputer(address _disputer) external
```

set the disputer address

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _disputer | address | disputer address |

### setStablePrice

```solidity
function setStablePrice(address _asset, uint256 _price) external
```

set stable asset price

_price should be scaled by 1e8_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _price | uint256 | price |

### disputeExpiryPrice

```solidity
function disputeExpiryPrice(address _asset, uint256 _expiryTimestamp, uint256 _price) external
```

dispute an asset price during the dispute period

_only the disputer can dispute a price during the dispute period, by setting a new one_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _expiryTimestamp | uint256 | expiry timestamp |
| _price | uint256 | the correct price |

### setExpiryPrice

```solidity
function setExpiryPrice(address _asset, uint256 _expiryTimestamp, uint256 _price) external
```

submits the expiry price to the oracle, can only be set from the pricer

_asset price can only be set after the locking period is over and before the dispute period has started_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _expiryTimestamp | uint256 | expiry timestamp |
| _price | uint256 | asset price at expiry |

### getPrice

```solidity
function getPrice(address _asset) external view returns (uint256)
```

get a live asset price from the asset's pricer contract

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price scaled by 1e8, denominated in USD e.g. 17568900000 => 175.689 USD |

### getExpiryPrice

```solidity
function getExpiryPrice(address _asset, uint256 _expiryTimestamp) external view returns (uint256, bool)
```

get the asset price at specific expiry timestamp

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _expiryTimestamp | uint256 | expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price scaled by 1e8, denominated in USD |
| [1] | bool | isFinalized True, if the price is finalized, False if not |

### getPricer

```solidity
function getPricer(address _asset) external view returns (address)
```

get the pricer for an asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | pricer address |

### getDisputer

```solidity
function getDisputer() external view returns (address)
```

get the disputer address

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | disputer address |

### getPricerLockingPeriod

```solidity
function getPricerLockingPeriod(address _pricer) external view returns (uint256)
```

get a pricer's locking period
locking period is the period of time after the expiry timestamp where a price can not be pushed

_during the locking period an expiry price can not be submitted to this contract_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _pricer | address | pricer address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | locking period |

### getPricerDisputePeriod

```solidity
function getPricerDisputePeriod(address _pricer) external view returns (uint256)
```

get a pricer's dispute period
dispute period is the period of time after an expiry price has been pushed where a price can be disputed

_during the dispute period, the disputer can dispute the submitted price and modify it_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _pricer | address | pricer address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | dispute period |

### getChainlinkRoundData

```solidity
function getChainlinkRoundData(address _asset, uint80 _roundId) external view returns (uint256, uint256)
```

get historical asset price and timestamp

_if asset is a stable asset, will return stored price and timestamp equal to now_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address to get it's historical price |
| _roundId | uint80 | chainlink round id |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price and round timestamp |
| [1] | uint256 |  |

### isLockingPeriodOver

```solidity
function isLockingPeriodOver(address _asset, uint256 _expiryTimestamp) public view returns (bool)
```

check if the locking period is over for setting the asset price at a particular expiry timestamp

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _expiryTimestamp | uint256 | expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if locking period is over, False if not |

### isDisputePeriodOver

```solidity
function isDisputePeriodOver(address _asset, uint256 _expiryTimestamp) public view returns (bool)
```

check if the dispute period is over

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _expiryTimestamp | uint256 | expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if dispute period is over, False if not |

## Otoken

Otoken is the ERC20 token for an option

_The Otoken inherits ERC20Upgradeable because we need to use the init instead of constructor_

### controller

```solidity
address controller
```

address of the Controller module

### underlyingAsset

```solidity
address underlyingAsset
```

asset that the option references

### strikeAsset

```solidity
address strikeAsset
```

asset that the strike price is denominated in

### collateralAsset

```solidity
address collateralAsset
```

asset that is held as collateral against short/written options

### strikePrice

```solidity
uint256 strikePrice
```

strike price with decimals = 8

### expiryTimestamp

```solidity
uint256 expiryTimestamp
```

expiration timestamp of the option, represented as a unix timestamp

### isPut

```solidity
bool isPut
```

True if a put option, False if a call option

### STRIKE_PRICE_SCALE

```solidity
uint256 STRIKE_PRICE_SCALE
```

### STRIKE_PRICE_DIGITS

```solidity
uint256 STRIKE_PRICE_DIGITS
```

### init

```solidity
function init(address _addressBook, address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiryTimestamp, bool _isPut) external
```

initialize the oToken

| Name | Type | Description |
| ---- | ---- | ----------- |
| _addressBook | address | addressbook module |
| _underlyingAsset | address | asset that the option references |
| _strikeAsset | address | asset that the strike price is denominated in |
| _collateralAsset | address | asset that is held as collateral against short/written options |
| _strikePrice | uint256 | strike price with decimals = 8 |
| _expiryTimestamp | uint256 | expiration timestamp of the option, represented as a unix timestamp |
| _isPut | bool | True if a put option, False if a call option |

### getOtokenDetails

```solidity
function getOtokenDetails() external view returns (address, address, address, uint256, uint256, bool)
```

### mintOtoken

```solidity
function mintOtoken(address account, uint256 amount) external
```

mint oToken for an account

_Controller only method where access control is taken care of by _beforeTokenTransfer hook_

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | account to mint token to |
| amount | uint256 | amount to mint |

### burnOtoken

```solidity
function burnOtoken(address account, uint256 amount) external
```

burn oToken from an account.

_Controller only method where access control is taken care of by _beforeTokenTransfer hook_

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | account to burn token from |
| amount | uint256 | amount to burn |

### _getNameAndSymbol

```solidity
function _getNameAndSymbol() internal view returns (string tokenName, string tokenSymbol)
```

generates the name and symbol for an option

_this function uses a named return variable to avoid the stack-too-deep error_

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenName | string | (ex: ETHUSDC 05-September-2020 200 Put USDC Collateral) |
| tokenSymbol | string | (ex: oETHUSDC-05SEP20-200P) |

### _getDisplayedStrikePrice

```solidity
function _getDisplayedStrikePrice(uint256 _strikePrice) internal pure returns (string)
```

_convert strike price scaled by 1e8 to human readable number string_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _strikePrice | uint256 | strike price scaled by 1e8 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | strike price string |

### _uintTo2Chars

```solidity
function _uintTo2Chars(uint256 number) internal pure returns (string)
```

_return a representation of a number using 2 characters, adds a leading 0 if one digit, uses two trailing digits if a 3 digit number_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | 2 characters that corresponds to a number |

### _getOptionType

```solidity
function _getOptionType(bool _isPut) internal pure returns (string shortString, string longString)
```

_return string representation of option type_

| Name | Type | Description |
| ---- | ---- | ----------- |
| shortString | string | a 1 character representation of option type (P or C) |
| longString | string | a full length string of option type (Put or Call) |

### _slice

```solidity
function _slice(string _s, uint256 _start, uint256 _end) internal pure returns (string)
```

_cut string s into s[start:end]_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _s | string | the string to cut |
| _start | uint256 | the starting index |
| _end | uint256 | the ending index (excluded in the substring) |

### _getMonth

```solidity
function _getMonth(uint256 _month) internal pure returns (string shortString, string longString)
```

_return string representation of a month_

| Name | Type | Description |
| ---- | ---- | ----------- |
| shortString | string | a 3 character representation of a month (ex: SEP, DEC, etc) |
| longString | string | a full length string of a month (ex: September, December, etc) |

## OtokenFactory

SPDX-License-Identifier: UNLICENSED
Create new oTokens and keep track of all created tokens

_Calculate contract address before each creation with CREATE2
and deploy eip-1167 minimal proxies for oToken logic contract_

### addressBook

```solidity
address addressBook
```

Opyn AddressBook contract that records the address of the Whitelist module and the Otoken impl address. */

### otokens

```solidity
address[] otokens
```

array of all created otokens */

### idToAddress

```solidity
mapping(bytes32 => address) idToAddress
```

_mapping from parameters hash to its deployed address_

### MAX_EXPIRY

```solidity
uint256 MAX_EXPIRY
```

_max expiry that BokkyPooBahsDateTimeLibrary can handle. (2345/12/31)_

### constructor

```solidity
constructor(address _addressBook) public
```

### OtokenCreated

```solidity
event OtokenCreated(address tokenAddress, address creator, address underlying, address strike, address collateral, uint256 strikePrice, uint256 expiry, bool isPut)
```

emitted when the factory creates a new Option

### createOtoken

```solidity
function createOtoken(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external returns (address)
```

create new oTokens

_deploy an eip-1167 minimal proxy with CREATE2 and register it to the whitelist module_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlyingAsset | address | asset that the option references |
| _strikeAsset | address | asset that the strike price is denominated in |
| _collateralAsset | address | asset that is held as collateral against short/written options |
| _strikePrice | uint256 | strike price with decimals = 18 |
| _expiry | uint256 | expiration timestamp as a unix timestamp |
| _isPut | bool | True if a put option, False if a call option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | newOtoken address of the newly created option |

### getOtokensLength

```solidity
function getOtokensLength() external view returns (uint256)
```

get the total oTokens created by the factory

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | length of the oTokens array |

### getOtoken

```solidity
function getOtoken(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external view returns (address)
```

get the oToken address for an already created oToken, if no oToken has been created with these parameters, it will return address(0)

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlyingAsset | address | asset that the option references |
| _strikeAsset | address | asset that the strike price is denominated in |
| _collateralAsset | address | asset that is held as collateral against short/written options |
| _strikePrice | uint256 | strike price with decimals = 18 |
| _expiry | uint256 | expiration timestamp as a unix timestamp |
| _isPut | bool | True if a put option, False if a call option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of target otoken. |

### getTargetOtokenAddress

```solidity
function getTargetOtokenAddress(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external view returns (address)
```

get the address at which a new oToken with these parameters would be deployed

_return the exact address that will be deployed at with _computeAddress_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlyingAsset | address | asset that the option references |
| _strikeAsset | address | asset that the strike price is denominated in |
| _collateralAsset | address | asset that is held as collateral against short/written options |
| _strikePrice | uint256 | strike price with decimals = 18 |
| _expiry | uint256 | expiration timestamp as a unix timestamp |
| _isPut | bool | True if a put option, False if a call option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | targetAddress the address this oToken would be deployed at |

### _getOptionId

```solidity
function _getOptionId(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) internal pure returns (bytes32)
```

_hash oToken parameters and return a unique option id_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlyingAsset | address | asset that the option references |
| _strikeAsset | address | asset that the strike price is denominated in |
| _collateralAsset | address | asset that is held as collateral against short/written options |
| _strikePrice | uint256 | strike price with decimals = 18 |
| _expiry | uint256 | expiration timestamp as a unix timestamp |
| _isPut | bool | True if a put option, False if a call option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | id the unique id of an oToken |

## OtokenSpawner

This contract spawns and initializes eip-1167 minimal proxies that
point to existing logic contracts.
This contract was modified from Spawner.sol
https://github.com/0age/Spawner/blob/master/contracts/Spawner.sol to fit into OtokenFactory

### SALT

```solidity
bytes32 SALT
```

### _spawn

```solidity
function _spawn(address logicContract, bytes initializationCalldata) internal returns (address)
```

internal function for spawning an eip-1167 minimal proxy using `CREATE2`

| Name | Type | Description |
| ---- | ---- | ----------- |
| logicContract | address | address of the logic contract |
| initializationCalldata | bytes | calldata that will be supplied to the `DELEGATECALL` from the spawned contract to the logic contract during contract creation |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | spawnedContract the address of the newly-spawned contract |

### _computeAddress

```solidity
function _computeAddress(address logicContract, bytes initializationCalldata) internal view returns (address target)
```

internal view function for finding the address of the standard
eip-1167 minimal proxy created using `CREATE2` with a given logic contract
and initialization calldata payload

| Name | Type | Description |
| ---- | ---- | ----------- |
| logicContract | address | address of the logic contract |
| initializationCalldata | bytes | calldata that will be supplied to the `DELEGATECALL` from the spawned contract to the logic contract during contract creation |

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | address | address of the next spawned minimal proxy contract with the given parameters. |

## Whitelist

The whitelist module keeps track of all valid oToken addresses, product hashes, collateral addresses, and callee addresses.

### addressBook

```solidity
address addressBook
```

AddressBook module address

### whitelistedProduct

```solidity
mapping(bytes32 => bool) whitelistedProduct
```

_mapping to track whitelisted products_

### whitelistedCollateral

```solidity
mapping(address => bool) whitelistedCollateral
```

_mapping to track whitelisted collateral_

### whitelistedOtoken

```solidity
mapping(address => bool) whitelistedOtoken
```

_mapping to track whitelisted oTokens_

### whitelistedCallee

```solidity
mapping(address => bool) whitelistedCallee
```

_mapping to track whitelisted callee addresses for the call action_

### constructor

```solidity
constructor(address _addressBook) public
```

_constructor_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _addressBook | address | AddressBook module address |

### ProductWhitelisted

```solidity
event ProductWhitelisted(bytes32 productHash, address underlying, address strike, address collateral, bool isPut)
```

emits an event a product is whitelisted by the owner address

### ProductBlacklisted

```solidity
event ProductBlacklisted(bytes32 productHash, address underlying, address strike, address collateral, bool isPut)
```

emits an event a product is blacklisted by the owner address

### CollateralWhitelisted

```solidity
event CollateralWhitelisted(address collateral)
```

emits an event when a collateral address is whitelisted by the owner address

### CollateralBlacklisted

```solidity
event CollateralBlacklisted(address collateral)
```

emits an event when a collateral address is blacklist by the owner address

### OtokenWhitelisted

```solidity
event OtokenWhitelisted(address otoken)
```

emits an event when an oToken is whitelisted by the OtokenFactory module

### OtokenBlacklisted

```solidity
event OtokenBlacklisted(address otoken)
```

emits an event when an oToken is blacklisted by the OtokenFactory module

### CalleeWhitelisted

```solidity
event CalleeWhitelisted(address _callee)
```

emits an event when a callee address is whitelisted by the owner address

### CalleeBlacklisted

```solidity
event CalleeBlacklisted(address _callee)
```

emits an event when a callee address is blacklisted by the owner address

### onlyFactory

```solidity
modifier onlyFactory()
```

check if the sender is the oTokenFactory module

### isWhitelistedProduct

```solidity
function isWhitelistedProduct(address _underlying, address _strike, address _collateral, bool _isPut) external view returns (bool)
```

check if a product is whitelisted

_product is the hash of underlying asset, strike asset, collateral asset, and isPut_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | asset that the option references |
| _strike | address | asset that the strike price is denominated in |
| _collateral | address | asset that is held as collateral against short/written options |
| _isPut | bool | True if a put option, False if a call option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if product is whitelisted |

### isWhitelistedCollateral

```solidity
function isWhitelistedCollateral(address _collateral) external view returns (bool)
```

check if a collateral asset is whitelisted

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | asset that is held as collateral against short/written options |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if the collateral is whitelisted |

### isWhitelistedOtoken

```solidity
function isWhitelistedOtoken(address _otoken) external view returns (bool)
```

check if an oToken is whitelisted

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if the oToken is whitelisted |

### isWhitelistedCallee

```solidity
function isWhitelistedCallee(address _callee) external view returns (bool)
```

check if a callee address is whitelisted for the call action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | callee destination address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if the address is whitelisted |

### whitelistProduct

```solidity
function whitelistProduct(address _underlying, address _strike, address _collateral, bool _isPut) external
```

allows the owner to whitelist a product

_product is the hash of underlying asset, strike asset, collateral asset, and isPut
can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | asset that the option references |
| _strike | address | asset that the strike price is denominated in |
| _collateral | address | asset that is held as collateral against short/written options |
| _isPut | bool | True if a put option, False if a call option |

### blacklistProduct

```solidity
function blacklistProduct(address _underlying, address _strike, address _collateral, bool _isPut) external
```

allow the owner to blacklist a product

_product is the hash of underlying asset, strike asset, collateral asset, and isPut
can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | asset that the option references |
| _strike | address | asset that the strike price is denominated in |
| _collateral | address | asset that is held as collateral against short/written options |
| _isPut | bool | True if a put option, False if a call option |

### whitelistCollateral

```solidity
function whitelistCollateral(address _collateral) external
```

allows the owner to whitelist a collateral address

_can only be called from the owner address. This function is used to whitelist any asset other than Otoken as collateral. WhitelistOtoken() is used to whitelist Otoken contracts._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |

### blacklistCollateral

```solidity
function blacklistCollateral(address _collateral) external
```

allows the owner to blacklist a collateral address

_can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |

### whitelistOtoken

```solidity
function whitelistOtoken(address _otokenAddress) external
```

allows the OtokenFactory module to whitelist a new option

_can only be called from the OtokenFactory address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otokenAddress | address | oToken |

### blacklistOtoken

```solidity
function blacklistOtoken(address _otokenAddress) external
```

allows the owner to blacklist an option

_can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otokenAddress | address | oToken |

### whitelistCallee

```solidity
function whitelistCallee(address _callee) external
```

allows the owner to whitelist a destination address for the call action

_can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | callee address |

### blacklistCallee

```solidity
function blacklistCallee(address _callee) external
```

allows the owner to blacklist a destination address for the call action

_can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | callee address |

## PermitCallee

_Contract for executing permit signature_

### callFunction

```solidity
function callFunction(address payable _sender, bytes _data) external
```

Allows users to send this contract arbitrary data.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sender | address payable | The msg.sender to Controller |
| _data | bytes | Arbitrary data given by the sender |

## WETH9

_A wrapper to use ETH as collateral_

### name

```solidity
string name
```

### symbol

```solidity
string symbol
```

### decimals

```solidity
uint8 decimals
```

### Approval

```solidity
event Approval(address src, address guy, uint256 wad)
```

emits an event when a sender approves WETH

### Transfer

```solidity
event Transfer(address src, address dst, uint256 wad)
```

emits an event when a sender transfers WETH

### Deposit

```solidity
event Deposit(address dst, uint256 wad)
```

emits an event when a sender deposits ETH into this contract

### Withdrawal

```solidity
event Withdrawal(address src, uint256 wad)
```

emits an event when a sender withdraws ETH from this contract

### balanceOf

```solidity
mapping(address => uint256) balanceOf
```

mapping between address and WETH balance

### allowance

```solidity
mapping(address => mapping(address => uint256)) allowance
```

mapping between addresses and allowance amount

### receive

```solidity
receive() external payable
```

fallback function that receives ETH

_will get called in a tx with ETH_

### deposit

```solidity
function deposit() public payable
```

wrap deposited ETH into WETH

### withdraw

```solidity
function withdraw(uint256 _wad) public
```

withdraw ETH from contract

_Unwrap from WETH to ETH_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _wad | uint256 | amount WETH to unwrap and withdraw |

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

get ETH total supply

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | total supply |

### approve

```solidity
function approve(address _guy, uint256 _wad) public returns (bool)
```

approve transfer

| Name | Type | Description |
| ---- | ---- | ----------- |
| _guy | address | address to approve |
| _wad | uint256 | amount of WETH |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if tx succeeds, False if not |

### transfer

```solidity
function transfer(address _dst, uint256 _wad) public returns (bool)
```

transfer WETH

| Name | Type | Description |
| ---- | ---- | ----------- |
| _dst | address | destination address |
| _wad | uint256 | amount to transfer |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if tx succeeds, False if not |

### transferFrom

```solidity
function transferFrom(address _src, address _dst, uint256 _wad) public returns (bool)
```

transfer from address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _src | address | source address |
| _dst | address | destination address |
| _wad | uint256 | amount to transfer |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if tx succeeds, False if not |

## PayableProxyController

_Contract for wrapping/unwrapping ETH before/after interacting with the Gamma Protocol_

### weth

```solidity
contract WETH9 weth
```

### controller

```solidity
contract Controller controller
```

### constructor

```solidity
constructor(address _controller, address _marginPool, address payable _weth) public
```

### fallback

```solidity
fallback() external payable
```

fallback function which disallows ETH to be sent to this contract without data except when unwrapping WETH

### operate

```solidity
function operate(struct Actions.ActionArgs[] _actions, address payable _sendEthTo) external payable
```

execute a number of actions

_a wrapper for the Controller operate function, to wrap WETH and the beginning and unwrap WETH at the end of the execution_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _actions | struct Actions.ActionArgs[] | array of actions arguments |
| _sendEthTo | address payable | address to send the remaining eth to |

## AddressBookInterface

### getOtokenImpl

```solidity
function getOtokenImpl() external view returns (address)
```

### getOtokenFactory

```solidity
function getOtokenFactory() external view returns (address)
```

### getWhitelist

```solidity
function getWhitelist() external view returns (address)
```

### getController

```solidity
function getController() external view returns (address)
```

### getOracle

```solidity
function getOracle() external view returns (address)
```

### getMarginPool

```solidity
function getMarginPool() external view returns (address)
```

### getMarginCalculator

```solidity
function getMarginCalculator() external view returns (address)
```

### getLiquidationManager

```solidity
function getLiquidationManager() external view returns (address)
```

### getAddress

```solidity
function getAddress(bytes32 _id) external view returns (address)
```

### setOtokenImpl

```solidity
function setOtokenImpl(address _otokenImpl) external
```

### setOtokenFactory

```solidity
function setOtokenFactory(address _factory) external
```

### setOracleImpl

```solidity
function setOracleImpl(address _otokenImpl) external
```

### setWhitelist

```solidity
function setWhitelist(address _whitelist) external
```

### setController

```solidity
function setController(address _controller) external
```

### setMarginPool

```solidity
function setMarginPool(address _marginPool) external
```

### setMarginCalculator

```solidity
function setMarginCalculator(address _calculator) external
```

### setLiquidationManager

```solidity
function setLiquidationManager(address _liquidationManager) external
```

### setAddress

```solidity
function setAddress(bytes32 _id, address _newImpl) external
```

## AggregatorInterface

_Interface of the Chainlink aggregator_

### decimals

```solidity
function decimals() external view returns (uint8)
```

### description

```solidity
function description() external view returns (string)
```

### version

```solidity
function version() external view returns (uint256)
```

### getRoundData

```solidity
function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

### latestRoundData

```solidity
function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

## CTokenInterface

_Interface of Compound cToken_

### exchangeRateStored

```solidity
function exchangeRateStored() external view returns (uint256)
```

Calculates the exchange rate from the underlying to the CToken

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Calculated exchange rate scaled by 1e18 |

### decimals

```solidity
function decimals() external view returns (uint256)
```

## CalleeInterface

_Contract interface that can be called from Controller as a call action._

### callFunction

```solidity
function callFunction(address payable _sender, bytes _data) external
```

Allows users to send this contract arbitrary data.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sender | address payable | The msg.sender to Controller |
| _data | bytes | Arbitrary data given by the sender |

## ERC20Interface

_Interface of the ERC20 standard as defined in the EIP._

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

_Returns the amount of tokens in existence._

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

_Returns the amount of tokens owned by `account`._

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from the caller's account to `recipient`.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

_Returns the remaining number of tokens that `spender` will be
allowed to spend on behalf of `owner` through {transferFrom}. This is
zero by default.

This value changes when {approve} or {transferFrom} are called._

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

_Sets `amount` as the allowance of `spender` over the caller's tokens.

Returns a boolean value indicating whether the operation succeeded.

IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender's allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

Emits an {Approval} event._

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from `sender` to `recipient` using the
allowance mechanism. `amount` is then deducted from the caller's
allowance.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### decimals

```solidity
function decimals() external view returns (uint8)
```

### mint

```solidity
function mint(address, uint256) external
```

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

_Emitted when `value` tokens are moved from one account (`from`) to
another (`to`).

Note that `value` may be zero._

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

_Emitted when the allowance of a `spender` for an `owner` is set by
a call to {approve}. `value` is the new allowance._

## MarginCalculatorInterface

### addressBook

```solidity
function addressBook() external view returns (address)
```

### getExpiredPayoutRate

```solidity
function getExpiredPayoutRate(address _otoken) external view returns (uint256)
```

### getExcessCollateral

```solidity
function getExcessCollateral(struct MarginVault.Vault _vault, uint256 _vaultType) external view returns (uint256 netValue, bool isExcess)
```

### isLiquidatable

```solidity
function isLiquidatable(struct MarginVault.Vault _vault, uint256 _vaultType, uint256 _vaultLatestUpdate, uint256 _roundId) external view returns (bool, uint256, uint256)
```

## MarginPoolInterface

### addressBook

```solidity
function addressBook() external view returns (address)
```

### farmer

```solidity
function farmer() external view returns (address)
```

### getStoredBalance

```solidity
function getStoredBalance(address _asset) external view returns (uint256)
```

### setFarmer

```solidity
function setFarmer(address _farmer) external
```

### farm

```solidity
function farm(address _asset, address _receiver, uint256 _amount) external
```

### transferToPool

```solidity
function transferToPool(address _asset, address _user, uint256 _amount) external
```

### transferToUser

```solidity
function transferToUser(address _asset, address _user, uint256 _amount) external
```

### batchTransferToPool

```solidity
function batchTransferToPool(address[] _asset, address[] _user, uint256[] _amount) external
```

### batchTransferToUser

```solidity
function batchTransferToUser(address[] _asset, address[] _user, uint256[] _amount) external
```

## OpynPricerInterface

### getPrice

```solidity
function getPrice() external view returns (uint256)
```

### getHistoricalPrice

```solidity
function getHistoricalPrice(uint80 _roundId) external view returns (uint256, uint256)
```

## OracleInterface

### isLockingPeriodOver

```solidity
function isLockingPeriodOver(address _asset, uint256 _expiryTimestamp) external view returns (bool)
```

### isDisputePeriodOver

```solidity
function isDisputePeriodOver(address _asset, uint256 _expiryTimestamp) external view returns (bool)
```

### getExpiryPrice

```solidity
function getExpiryPrice(address _asset, uint256 _expiryTimestamp) external view returns (uint256, bool)
```

### getDisputer

```solidity
function getDisputer() external view returns (address)
```

### getPricer

```solidity
function getPricer(address _asset) external view returns (address)
```

### getPrice

```solidity
function getPrice(address _asset) external view returns (uint256)
```

### getPricerLockingPeriod

```solidity
function getPricerLockingPeriod(address _pricer) external view returns (uint256)
```

### getPricerDisputePeriod

```solidity
function getPricerDisputePeriod(address _pricer) external view returns (uint256)
```

### getChainlinkRoundData

```solidity
function getChainlinkRoundData(address _asset, uint80 _roundId) external view returns (uint256, uint256)
```

### setStablePrice

```solidity
function setStablePrice(address _asset, uint256 _price) external
```

### setAssetPricer

```solidity
function setAssetPricer(address _asset, address _pricer) external
```

### setLockingPeriod

```solidity
function setLockingPeriod(address _pricer, uint256 _lockingPeriod) external
```

### setDisputePeriod

```solidity
function setDisputePeriod(address _pricer, uint256 _disputePeriod) external
```

### setExpiryPrice

```solidity
function setExpiryPrice(address _asset, uint256 _expiryTimestamp, uint256 _price) external
```

### disputeExpiryPrice

```solidity
function disputeExpiryPrice(address _asset, uint256 _expiryTimestamp, uint256 _price) external
```

### setDisputer

```solidity
function setDisputer(address _disputer) external
```

## OtokenInterface

### addressBook

```solidity
function addressBook() external view returns (address)
```

### underlyingAsset

```solidity
function underlyingAsset() external view returns (address)
```

### strikeAsset

```solidity
function strikeAsset() external view returns (address)
```

### collateralAsset

```solidity
function collateralAsset() external view returns (address)
```

### strikePrice

```solidity
function strikePrice() external view returns (uint256)
```

### expiryTimestamp

```solidity
function expiryTimestamp() external view returns (uint256)
```

### isPut

```solidity
function isPut() external view returns (bool)
```

### init

```solidity
function init(address _addressBook, address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external
```

### getOtokenDetails

```solidity
function getOtokenDetails() external view returns (address, address, address, uint256, uint256, bool)
```

### mintOtoken

```solidity
function mintOtoken(address account, uint256 amount) external
```

### burnOtoken

```solidity
function burnOtoken(address account, uint256 amount) external
```

## WSTETHInterface

### name

```solidity
function name() external view returns (string)
```

### symbol

```solidity
function symbol() external view returns (string)
```

### decimals

```solidity
function decimals() external view returns (uint8)
```

### stEthPerToken

```solidity
function stEthPerToken() external view returns (uint256)
```

## WhitelistInterface

### addressBook

```solidity
function addressBook() external view returns (address)
```

### isWhitelistedProduct

```solidity
function isWhitelistedProduct(address _underlying, address _strike, address _collateral, bool _isPut) external view returns (bool)
```

### isWhitelistedCollateral

```solidity
function isWhitelistedCollateral(address _collateral) external view returns (bool)
```

### isCoveredWhitelistedCollateral

```solidity
function isCoveredWhitelistedCollateral(address _collateral, address _underlying, bool _isPut) external view returns (bool)
```

### isNakedWhitelistedCollateral

```solidity
function isNakedWhitelistedCollateral(address _collateral, address _underlying, bool _isPut) external view returns (bool)
```

### isWhitelistedOtoken

```solidity
function isWhitelistedOtoken(address _otoken) external view returns (bool)
```

### isWhitelistedCallee

```solidity
function isWhitelistedCallee(address _callee) external view returns (bool)
```

### whitelistProduct

```solidity
function whitelistProduct(address _underlying, address _strike, address _collateral, bool _isPut) external
```

### blacklistProduct

```solidity
function blacklistProduct(address _underlying, address _strike, address _collateral, bool _isPut) external
```

### whitelistCollateral

```solidity
function whitelistCollateral(address _collateral) external
```

### blacklistCollateral

```solidity
function blacklistCollateral(address _collateral) external
```

### whitelistCoveredCollateral

```solidity
function whitelistCoveredCollateral(address _collateral, address _underlying, bool _isPut) external
```

### whitelistNakedCollateral

```solidity
function whitelistNakedCollateral(address _collateral, address _underlying, bool _isPut) external
```

### whitelistOtoken

```solidity
function whitelistOtoken(address _otoken) external
```

### blacklistOtoken

```solidity
function blacklistOtoken(address _otoken) external
```

### whitelistCallee

```solidity
function whitelistCallee(address _callee) external
```

### blacklistCallee

```solidity
function blacklistCallee(address _callee) external
```

## YearnVaultInterface

### name

```solidity
function name() external view returns (string)
```

### symbol

```solidity
function symbol() external view returns (string)
```

### decimals

```solidity
function decimals() external view returns (uint8)
```

### pricePerShare

```solidity
function pricePerShare() external view returns (uint256)
```

### deposit

```solidity
function deposit(uint256) external
```

### withdraw

```solidity
function withdraw(uint256) external
```

## Actions

A library that provides a ActionArgs struct, sub types of Action structs, and functions to parse ActionArgs into specific Actions.
errorCode
A1 can only parse arguments for open vault actions
A2 cannot open vault for an invalid account
A3 cannot open vault with an invalid type
A4 can only parse arguments for mint actions
A5 cannot mint from an invalid account
A6 can only parse arguments for burn actions
A7 cannot burn from an invalid account
A8 can only parse arguments for deposit actions
A9 cannot deposit to an invalid account
A10 can only parse arguments for withdraw actions
A11 cannot withdraw from an invalid account
A12 cannot withdraw to an invalid account
A13 can only parse arguments for redeem actions
A14 cannot redeem to an invalid account
A15 can only parse arguments for settle vault actions
A16 cannot settle vault for an invalid account
A17 cannot withdraw payout to an invalid account
A18 can only parse arguments for liquidate action
A19 cannot liquidate vault for an invalid account owner
A20 cannot send collateral to an invalid account
A21 cannot parse liquidate action with no round id
A22 can only parse arguments for call actions
A23 target address cannot be address(0)

### ActionType

```solidity
enum ActionType {
  OpenVault,
  MintShortOption,
  BurnShortOption,
  DepositLongOption,
  WithdrawLongOption,
  DepositCollateral,
  WithdrawCollateral,
  SettleVault,
  Redeem,
  Call,
  Liquidate
}
```

### ActionArgs

```solidity
struct ActionArgs {
  enum Actions.ActionType actionType;
  address owner;
  address secondAddress;
  address asset;
  uint256 vaultId;
  uint256 amount;
  uint256 index;
  bytes data;
}
```

### MintArgs

```solidity
struct MintArgs {
  address owner;
  uint256 vaultId;
  address to;
  address otoken;
  uint256 index;
  uint256 amount;
}
```

### BurnArgs

```solidity
struct BurnArgs {
  address owner;
  uint256 vaultId;
  address from;
  address otoken;
  uint256 index;
  uint256 amount;
}
```

### OpenVaultArgs

```solidity
struct OpenVaultArgs {
  address owner;
  uint256 vaultId;
  uint256 vaultType;
}
```

### DepositArgs

```solidity
struct DepositArgs {
  address owner;
  uint256 vaultId;
  address from;
  address asset;
  uint256 index;
  uint256 amount;
}
```

### RedeemArgs

```solidity
struct RedeemArgs {
  address receiver;
  address otoken;
  uint256 amount;
}
```

### WithdrawArgs

```solidity
struct WithdrawArgs {
  address owner;
  uint256 vaultId;
  address to;
  address asset;
  uint256 index;
  uint256 amount;
}
```

### SettleVaultArgs

```solidity
struct SettleVaultArgs {
  address owner;
  uint256 vaultId;
  address to;
}
```

### LiquidateArgs

```solidity
struct LiquidateArgs {
  address owner;
  address receiver;
  uint256 vaultId;
  uint256 amount;
  uint256 roundId;
}
```

### CallArgs

```solidity
struct CallArgs {
  address callee;
  bytes data;
}
```

### _parseOpenVaultArgs

```solidity
function _parseOpenVaultArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.OpenVaultArgs)
```

parses the passed in action arguments to get the arguments for an open vault action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.ActionArgs | general action arguments structure |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Actions.OpenVaultArgs | arguments for a open vault action |

### _parseMintArgs

```solidity
function _parseMintArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.MintArgs)
```

parses the passed in action arguments to get the arguments for a mint action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.ActionArgs | general action arguments structure |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Actions.MintArgs | arguments for a mint action |

### _parseBurnArgs

```solidity
function _parseBurnArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.BurnArgs)
```

parses the passed in action arguments to get the arguments for a burn action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.ActionArgs | general action arguments structure |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Actions.BurnArgs | arguments for a burn action |

### _parseDepositArgs

```solidity
function _parseDepositArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.DepositArgs)
```

parses the passed in action arguments to get the arguments for a deposit action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.ActionArgs | general action arguments structure |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Actions.DepositArgs | arguments for a deposit action |

### _parseWithdrawArgs

```solidity
function _parseWithdrawArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.WithdrawArgs)
```

parses the passed in action arguments to get the arguments for a withdraw action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.ActionArgs | general action arguments structure |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Actions.WithdrawArgs | arguments for a withdraw action |

### _parseRedeemArgs

```solidity
function _parseRedeemArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.RedeemArgs)
```

parses the passed in action arguments to get the arguments for an redeem action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.ActionArgs | general action arguments structure |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Actions.RedeemArgs | arguments for a redeem action |

### _parseSettleVaultArgs

```solidity
function _parseSettleVaultArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.SettleVaultArgs)
```

parses the passed in action arguments to get the arguments for a settle vault action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.ActionArgs | general action arguments structure |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Actions.SettleVaultArgs | arguments for a settle vault action |

### _parseLiquidateArgs

```solidity
function _parseLiquidateArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.LiquidateArgs)
```

### _parseCallArgs

```solidity
function _parseCallArgs(struct Actions.ActionArgs _args) internal pure returns (struct Actions.CallArgs)
```

parses the passed in action arguments to get the arguments for a call action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.ActionArgs | general action arguments structure |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Actions.CallArgs | arguments for a call action |

## FixedPointInt256

FixedPoint library

### SCALING_FACTOR

```solidity
int256 SCALING_FACTOR
```

### BASE_DECIMALS

```solidity
uint256 BASE_DECIMALS
```

### FixedPointInt

```solidity
struct FixedPointInt {
  int256 value;
}
```

### fromUnscaledInt

```solidity
function fromUnscaledInt(int256 a) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

constructs an `FixedPointInt` from an unscaled int, e.g., `b=5` gets stored internally as `5**27`.

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | int256 | int to convert into a FixedPoint. |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | the converted FixedPoint. |

### fromScaledUint

```solidity
function fromScaledUint(uint256 _a, uint256 _decimals) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

constructs an FixedPointInt from an scaled uint with {_decimals} decimals
Examples:
(1)  USDC    decimals = 6
     Input:  5 * 1e6 USDC  =>    Output: 5 * 1e27 (FixedPoint 5.0 USDC)
(2)  cUSDC   decimals = 8
     Input:  5 * 1e6 cUSDC =>    Output: 5 * 1e25 (FixedPoint 0.05 cUSDC)

| Name | Type | Description |
| ---- | ---- | ----------- |
| _a | uint256 | uint256 to convert into a FixedPoint. |
| _decimals | uint256 | original decimals _a has |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | the converted FixedPoint, with 27 decimals. |

### toScaledUint

```solidity
function toScaledUint(struct FixedPointInt256.FixedPointInt _a, uint256 _decimals, bool _roundDown) internal pure returns (uint256)
```

convert a FixedPointInt number to an uint256 with a specific number of decimals

| Name | Type | Description |
| ---- | ---- | ----------- |
| _a | struct FixedPointInt256.FixedPointInt | FixedPointInt to convert |
| _decimals | uint256 | number of decimals that the uint256 should be scaled to |
| _roundDown | bool | True to round down the result, False to round up |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the converted uint256 |

### add

```solidity
function add(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

add two signed integers, a + b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | sum of the two signed integers |

### sub

```solidity
function sub(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

subtract two signed integers, a-b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | difference of two signed integers |

### mul

```solidity
function mul(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

multiply two signed integers, a by b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | mul of two signed integers |

### div

```solidity
function div(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

divide two signed integers, a by b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | div of two signed integers |

### min

```solidity
function min(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

minimum between two signed integers, a and b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | min of two signed integers |

### max

```solidity
function max(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

maximum between two signed integers, a and b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | max of two signed integers |

### isEqual

```solidity
function isEqual(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (bool)
```

is a is equal to b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if equal, False if not |

### isGreaterThan

```solidity
function isGreaterThan(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (bool)
```

is a greater than b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if a > b, False if not |

### isGreaterThanOrEqual

```solidity
function isGreaterThanOrEqual(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (bool)
```

is a greater than or equal to b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if a >= b, False if not |

### isLessThan

```solidity
function isLessThan(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (bool)
```

is a is less than b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if a < b, False if not |

### isLessThanOrEqual

```solidity
function isLessThanOrEqual(struct FixedPointInt256.FixedPointInt a, struct FixedPointInt256.FixedPointInt b) internal pure returns (bool)
```

is a less than or equal to b

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | struct FixedPointInt256.FixedPointInt | FixedPointInt |
| b | struct FixedPointInt256.FixedPointInt | FixedPointInt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if a <= b, False if not |

## MarginVault

A library that provides the Controller with a Vault struct and the functions that manipulate vaults.
Vaults describe discrete position combinations of long options, short options, and collateral assets that a user can have.

### Vault

```solidity
struct Vault {
  address[] shortOtokens;
  address[] longOtokens;
  address[] collateralAssets;
  uint256[] shortAmounts;
  uint256[] longAmounts;
  uint256[] collateralAmounts;
}
```

### VaultLiquidationDetails

```solidity
struct VaultLiquidationDetails {
  address series;
  uint128 shortAmount;
  uint128 collateralAmount;
}
```

### addShort

```solidity
function addShort(struct MarginVault.Vault _vault, address _shortOtoken, uint256 _amount, uint256 _index) external
```

_increase the short oToken balance in a vault when a new oToken is minted_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault to add or increase the short position in |
| _shortOtoken | address | address of the _shortOtoken being minted from the user's vault |
| _amount | uint256 | number of _shortOtoken being minted from the user's vault |
| _index | uint256 | index of _shortOtoken in the user's vault.shortOtokens array |

### removeShort

```solidity
function removeShort(struct MarginVault.Vault _vault, address _shortOtoken, uint256 _amount, uint256 _index) external
```

_decrease the short oToken balance in a vault when an oToken is burned_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault to decrease short position in |
| _shortOtoken | address | address of the _shortOtoken being reduced in the user's vault |
| _amount | uint256 | number of _shortOtoken being reduced in the user's vault |
| _index | uint256 | index of _shortOtoken in the user's vault.shortOtokens array |

### addLong

```solidity
function addLong(struct MarginVault.Vault _vault, address _longOtoken, uint256 _amount, uint256 _index) external
```

_increase the long oToken balance in a vault when an oToken is deposited_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault to add a long position to |
| _longOtoken | address | address of the _longOtoken being added to the user's vault |
| _amount | uint256 | number of _longOtoken the protocol is adding to the user's vault |
| _index | uint256 | index of _longOtoken in the user's vault.longOtokens array |

### removeLong

```solidity
function removeLong(struct MarginVault.Vault _vault, address _longOtoken, uint256 _amount, uint256 _index) external
```

_decrease the long oToken balance in a vault when an oToken is withdrawn_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault to remove a long position from |
| _longOtoken | address | address of the _longOtoken being removed from the user's vault |
| _amount | uint256 | number of _longOtoken the protocol is removing from the user's vault |
| _index | uint256 | index of _longOtoken in the user's vault.longOtokens array |

### addCollateral

```solidity
function addCollateral(struct MarginVault.Vault _vault, address _collateralAsset, uint256 _amount, uint256 _index) external
```

_increase the collateral balance in a vault_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault to add collateral to |
| _collateralAsset | address | address of the _collateralAsset being added to the user's vault |
| _amount | uint256 | number of _collateralAsset being added to the user's vault |
| _index | uint256 | index of _collateralAsset in the user's vault.collateralAssets array |

### removeCollateral

```solidity
function removeCollateral(struct MarginVault.Vault _vault, address _collateralAsset, uint256 _amount, uint256 _index) external
```

_decrease the collateral balance in a vault_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault to remove collateral from |
| _collateralAsset | address | address of the _collateralAsset being removed from the user's vault |
| _amount | uint256 | number of _collateralAsset being removed from the user's vault |
| _index | uint256 | index of _collateralAsset in the user's vault.collateralAssets array |

## SignedConverter

A library to convert an unsigned integer to signed integer or signed integer to unsigned integer.

### uintToInt

```solidity
function uintToInt(uint256 a) internal pure returns (int256)
```

convert an unsigned integer to a signed integer

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | uint256 | uint to convert into a signed integer |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 | converted signed integer |

### intToUint

```solidity
function intToUint(int256 a) internal pure returns (uint256)
```

convert a signed integer to an unsigned integer

| Name | Type | Description |
| ---- | ---- | ----------- |
| a | int256 | int to convert into an unsigned integer |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | converted unsigned integer |

## NewMarginCalculator

Calculator module that checks if a given vault is valid, calculates margin requirements, and settlement proceeds

### ShortScaledDetails

```solidity
struct ShortScaledDetails {
  struct FixedPointInt256.FixedPointInt shortAmount;
  struct FixedPointInt256.FixedPointInt shortStrike;
  struct FixedPointInt256.FixedPointInt shortUnderlyingPrice;
}
```

### OptionType

```solidity
enum OptionType {
  PUT,
  NAKED_CALL,
  NAKED_PUT,
  COVERED_CALL
}
```

### SCALING_FACTOR

```solidity
uint256 SCALING_FACTOR
```

_decimals option upper bound value, spot shock and oracle deviation_

### BASE

```solidity
uint256 BASE
```

_decimals used by strike price and oracle price_

### AUCTION_TIME

```solidity
uint256 AUCTION_TIME
```

auction length

### VaultDetails

```solidity
struct VaultDetails {
  address shortUnderlyingAsset;
  address shortStrikeAsset;
  address shortCollateralAsset;
  address longUnderlyingAsset;
  address longStrikeAsset;
  address longCollateralAsset;
  uint256 shortStrikePrice;
  uint256 shortExpiryTimestamp;
  uint256 shortCollateralDecimals;
  uint256 longStrikePrice;
  uint256 longExpiryTimestamp;
  uint256 longCollateralDecimals;
  uint256 collateralDecimals;
  uint256 vaultType;
  bool isShortPut;
  bool isLongPut;
  bool hasLong;
  bool hasShort;
  bool hasCollateral;
}
```

### oracleDeviation

```solidity
uint256 oracleDeviation
```

_oracle deviation value (1e27)_

### ZERO

```solidity
struct FixedPointInt256.FixedPointInt ZERO
```

_FixedPoint 0_

### dust

```solidity
mapping(address => uint256) dust
```

_mapping to store dust amount per option collateral asset (scaled by collateral asset decimals)_

### timesToExpiryForProduct

```solidity
mapping(bytes32 => uint256[]) timesToExpiryForProduct
```

_mapping to store array of time to expiry for a given product_

### maxPriceAtTimeToExpiry

```solidity
mapping(bytes32 => mapping(uint256 => uint256)) maxPriceAtTimeToExpiry
```

_mapping to store option upper bound value at specific time to expiry for a given product (1e27)_

### spotShock

```solidity
mapping(bytes32 => uint256) spotShock
```

_mapping to store shock value for spot price of a given product (1e27)_

### liquidationMultiplier

```solidity
uint256 liquidationMultiplier
```

_multiplier on debt price for liquidations_

### MAX_BPS

```solidity
uint256 MAX_BPS
```

_max_bps_

### oracle

```solidity
contract OracleInterface oracle
```

_oracle module_

### addressBook

```solidity
contract AddressBookInterface addressBook
```

_addressbook module_

### CollateralDustUpdated

```solidity
event CollateralDustUpdated(address collateral, uint256 dust)
```

emits an event when collateral dust is updated

### TimeToExpiryAdded

```solidity
event TimeToExpiryAdded(bytes32 productHash, uint256 timeToExpiry)
```

emits an event when new time to expiry is added for a specific product

### MaxPriceAdded

```solidity
event MaxPriceAdded(bytes32 productHash, uint256 timeToExpiry, uint256 value)
```

emits an event when new upper bound value is added for a specific time to expiry timestamp

### MaxPriceUpdated

```solidity
event MaxPriceUpdated(bytes32 productHash, uint256 timeToExpiry, uint256 oldValue, uint256 newValue)
```

emits an event when updating upper bound value at specific expiry timestamp

### SpotShockUpdated

```solidity
event SpotShockUpdated(bytes32 product, uint256 spotShock)
```

emits an event when spot shock value is updated for a specific product

### OracleDeviationUpdated

```solidity
event OracleDeviationUpdated(uint256 oracleDeviation)
```

emits an event when oracle deviation value is updated

### LiquidationMultiplierUpdated

```solidity
event LiquidationMultiplierUpdated(uint256 liquidationMultiplier)
```

emits an event when the liquidation multiplier is updated

### constructor

```solidity
constructor(address _oracle, address _addressBook) public
```

constructor

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oracle | address | oracle module address |
| _addressBook | address | addressbook module address |

### setCollateralDust

```solidity
function setCollateralDust(address _collateral, uint256 _dust) external
```

set dust amount for collateral asset

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |
| _dust | uint256 | dust amount, should be scaled by collateral asset decimals |

### setLiquidationMultiplier

```solidity
function setLiquidationMultiplier(uint256 _liquidationMultiplier) external
```

set the liquidation multiplier

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _liquidationMultiplier | uint256 | the multiplier to apply to liquidations |

### setUpperBoundValues

```solidity
function setUpperBoundValues(address _underlying, address _strike, address _collateral, bool _isPut, uint256[] _timesToExpiry, uint256[] _values) external
```

set product upper bound values

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |
| _timesToExpiry | uint256[] | array of times to expiry timestamp |
| _values | uint256[] | upper bound values array |

### updateUpperBoundValue

```solidity
function updateUpperBoundValue(address _underlying, address _strike, address _collateral, bool _isPut, uint256 _timeToExpiry, uint256 _value) external
```

set option upper bound value for specific time to expiry (1e27)

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |
| _timeToExpiry | uint256 | option time to expiry timestamp |
| _value | uint256 | upper bound value |

### setSpotShock

```solidity
function setSpotShock(address _underlying, address _strike, address _collateral, bool _isPut, uint256 _shockValue) external
```

set spot shock value, scaled to 1e27

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |
| _shockValue | uint256 | spot shock value |

### setOracleDeviation

```solidity
function setOracleDeviation(uint256 _deviation) external
```

set oracle deviation (1e27)

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviation | uint256 | deviation value |

### getCollateralDust

```solidity
function getCollateralDust(address _collateral) external view returns (uint256)
```

get dust amount for collateral asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | dust amount |

### getTimesToExpiry

```solidity
function getTimesToExpiry(address _underlying, address _strike, address _collateral, bool _isPut) external view returns (uint256[])
```

get times to expiry for a specific product

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256[] | array of times to expiry |

### getMaxPrice

```solidity
function getMaxPrice(address _underlying, address _strike, address _collateral, bool _isPut, uint256 _timeToExpiry) external view returns (uint256)
```

get option upper bound value for specific time to expiry

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |
| _timeToExpiry | uint256 | option time to expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | option upper bound value (1e27) |

### getSpotShock

```solidity
function getSpotShock(address _underlying, address _strike, address _collateral, bool _isPut) external view returns (uint256)
```

get spot shock value

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _collateral | address | otoken collateral asset |
| _isPut | bool | otoken type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | _shockValue spot shock value (1e27) |

### getOracleDeviation

```solidity
function getOracleDeviation() external view returns (uint256)
```

get oracle deviation

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | oracle deviation value (1e27) |

### getNakedMarginRequired

```solidity
function getNakedMarginRequired(address _underlying, address _strike, address _collateral, uint256 _shortAmount, uint256 _strikePrice, uint256 _underlyingPrice, uint256 _shortExpiryTimestamp, uint256 _collateralDecimals, bool _isPut) external view returns (uint256)
```

return the collateral required for naked margin vault, in collateral asset decimals

__shortAmount, _strikePrice and _underlyingPrice should be scaled by 1e8_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | underlying asset address |
| _strike | address | strike asset address |
| _collateral | address | collateral asset address |
| _shortAmount | uint256 | amount of short otoken |
| _strikePrice | uint256 | otoken strike price |
| _underlyingPrice | uint256 | otoken underlying price |
| _shortExpiryTimestamp | uint256 | otoken expiry timestamp |
| _collateralDecimals | uint256 | otoken collateral asset decimals |
| _isPut | bool | otoken type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | collateral required for a naked margin vault, in collateral asset decimals |

### getExpiredPayoutRate

```solidity
function getExpiredPayoutRate(address _otoken) external view returns (uint256)
```

return the cash value of an expired oToken, denominated in collateral

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | how much collateral can be taken out by 1 otoken unit, scaled by 1e8, or how much collateral can be taken out for 1 (1e8) oToken |

### isLiquidatable

```solidity
function isLiquidatable(struct MarginVault.Vault _vault, uint256 _vaultType) external view returns (bool, uint256, uint256)
```

check if a specific vault is undercollateralized at a specific chainlink round

_if the vault is of type 0, the function will revert_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault struct |
| _vaultType | uint256 | vault type (0 for max loss/spread and 1 for naked margin vault) |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | isLiquidatable, true if vault is undercollateralized, liquidation price and collateral dust amount |
| [1] | uint256 |  |
| [2] | uint256 |  |

### getMarginRequired

```solidity
function getMarginRequired(struct MarginVault.Vault _vault, uint256 _vaultType) external view returns (struct FixedPointInt256.FixedPointInt, struct FixedPointInt256.FixedPointInt)
```

calculate required collateral margin for a vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | theoretical vault that needs to be checked |
| _vaultType | uint256 | vault type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | the vault collateral amount, and marginRequired the minimal amount of collateral needed in a vault, scaled to 1e27 |
| [1] | struct FixedPointInt256.FixedPointInt |  |

### getExcessCollateral

```solidity
function getExcessCollateral(struct MarginVault.Vault _vault, uint256 _vaultType) public view returns (uint256, bool)
```

returns the amount of collateral that can be removed from an actual or a theoretical vault

_return amount is denominated in the collateral asset for the oToken in the vault, or the collateral asset in the vault_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | theoretical vault that needs to be checked |
| _vaultType | uint256 | vault type (0 for spread/max loss, 1 for naked margin) |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | excessCollateral the amount by which the margin is above or below the required amount |
| [1] | bool | isExcess True if there is excess margin in the vault, False if there is a deficit of margin in the vault if True, collateral can be taken out from the vault, if False, additional collateral needs to be added to vault |

### _getExpiredCashValue

```solidity
function _getExpiredCashValue(address _underlying, address _strike, uint256 _expiryTimestamp, uint256 _strikePrice, bool _isPut) internal view returns (struct FixedPointInt256.FixedPointInt)
```

return the cash value of an expired oToken, denominated in strike asset

_for a call, return Max (0, underlyingPriceInStrike - otoken.strikePrice)
for a put, return Max(0, otoken.strikePrice - underlyingPriceInStrike)_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | otoken underlying asset |
| _strike | address | otoken strike asset |
| _expiryTimestamp | uint256 | otoken expiry timestamp |
| _strikePrice | uint256 | otoken strike price |
| _isPut | bool |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | cash value of an expired otoken, denominated in the strike asset |

### OtokenDetails

```solidity
struct OtokenDetails {
  address otokenUnderlyingAsset;
  address otokenCollateralAsset;
  address otokenStrikeAsset;
  uint256 otokenExpiry;
  bool isPut;
}
```

### _getMarginRequired

```solidity
function _getMarginRequired(struct MarginVault.Vault _vault, struct NewMarginCalculator.VaultDetails _vaultDetails) internal view returns (struct FixedPointInt256.FixedPointInt, struct FixedPointInt256.FixedPointInt)
```

calculate the amount of collateral needed for a vault

_vault passed in has already passed the checkIsValidVault function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | theoretical vault that needs to be checked |
| _vaultDetails | struct NewMarginCalculator.VaultDetails |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | the vault collateral amount, and marginRequired the minimal amount of collateral needed in a vault, scaled to 1e27 |
| [1] | struct FixedPointInt256.FixedPointInt |  |

### _getNakedMarginRequired

```solidity
function _getNakedMarginRequired(bytes32 _productHash, struct NewMarginCalculator.ShortScaledDetails ssd, uint256 _shortExpiryTimestamp, enum NewMarginCalculator.OptionType optionType) internal view returns (struct FixedPointInt256.FixedPointInt)
```

get required collateral for naked margin position
if put:
a = min(strike price, spot shock * underlying price)
b = max(strike price - spot shock * underlying price, 0)
marginRequired = ( option upper bound value * a + b) * short amount
if call:
a = min(1, strike price / (underlying price / spot shock value))
b = max(1- (strike price / (underlying price / spot shock value)), 0)
marginRequired = (option upper bound value * a + b) * short amount

| Name | Type | Description |
| ---- | ---- | ----------- |
| _productHash | bytes32 | product hash |
| ssd | struct NewMarginCalculator.ShortScaledDetails |  |
| _shortExpiryTimestamp | uint256 | short otoken expiry timestamp |
| optionType | enum NewMarginCalculator.OptionType |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | required margin for this naked vault, in FixedPointInt type (scaled by 1e27) |

### _findUpperBoundValue

```solidity
function _findUpperBoundValue(bytes32 _productHash, uint256 _expiryTimestamp) internal view returns (struct FixedPointInt256.FixedPointInt)
```

find upper bound value for product by specific expiry timestamp

_should return the upper bound value that correspond to option time to expiry, of if not found should return the next greater one, revert if no value found_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _productHash | bytes32 | product hash |
| _expiryTimestamp | uint256 | expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | option upper bound value |

### _getPutSpreadMarginRequired

```solidity
function _getPutSpreadMarginRequired(struct FixedPointInt256.FixedPointInt _shortAmount, struct FixedPointInt256.FixedPointInt _longAmount, struct FixedPointInt256.FixedPointInt _shortStrike, struct FixedPointInt256.FixedPointInt _longStrike) internal view returns (struct FixedPointInt256.FixedPointInt)
```

_returns the strike asset amount of margin required for a put or put spread with the given short oTokens, long oTokens and amounts

marginRequired = max( (short amount * short strike) - (long strike * min (short amount, long amount)) , 0 )_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | margin requirement denominated in the strike asset |

### _getCallSpreadMarginRequired

```solidity
function _getCallSpreadMarginRequired(struct FixedPointInt256.FixedPointInt _shortAmount, struct FixedPointInt256.FixedPointInt _longAmount, struct FixedPointInt256.FixedPointInt _shortStrike, struct FixedPointInt256.FixedPointInt _longStrike) internal view returns (struct FixedPointInt256.FixedPointInt)
```

_returns the underlying asset amount required for a call or call spread with the given short oTokens, long oTokens, and amounts

                          (long strike - short strike) * short amount
marginRequired =  max( ------------------------------------------------- , max (short amount - long amount, 0) )
                                          long strike

if long strike = 0, return max( short amount - long amount, 0)_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | margin requirement denominated in the underlying asset |

### _convertAmountOnLivePrice

```solidity
function _convertAmountOnLivePrice(struct FixedPointInt256.FixedPointInt _amount, address _assetA, address _assetB) internal view returns (struct FixedPointInt256.FixedPointInt)
```

convert an amount in asset A to equivalent amount of asset B, based on a live price

_function includes the amount and applies .mul() first to increase the accuracy_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | struct FixedPointInt256.FixedPointInt | amount in asset A |
| _assetA | address | asset A |
| _assetB | address | asset B |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | _amount in asset B |

### _convertAmountOnExpiryPrice

```solidity
function _convertAmountOnExpiryPrice(struct FixedPointInt256.FixedPointInt _amount, address _assetA, address _assetB, uint256 _expiry) internal view returns (struct FixedPointInt256.FixedPointInt)
```

convert an amount in asset A to equivalent amount of asset B, based on an expiry price

_function includes the amount and apply .mul() first to increase the accuracy_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | struct FixedPointInt256.FixedPointInt | amount in asset A |
| _assetA | address | asset A |
| _assetB | address | asset B |
| _expiry | uint256 |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | _amount in asset B |

### _getDebtPrice

```solidity
function _getDebtPrice(struct FixedPointInt256.FixedPointInt _vaultCollateral, struct FixedPointInt256.FixedPointInt _vaultDebt, uint256 _collateralDecimals) internal view returns (uint256)
```

return debt price, how much collateral asset per 1 otoken repaid in collateral decimal
price = vault collateral / vault debt

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultCollateral | struct FixedPointInt256.FixedPointInt | vault collateral amount |
| _vaultDebt | struct FixedPointInt256.FixedPointInt | vault short amount |
| _collateralDecimals | uint256 | collateral asset decimals |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of 1 debt otoken in collateral asset scaled by collateral decimals |

### _getVaultDetails

```solidity
function _getVaultDetails(struct MarginVault.Vault _vault, uint256 _vaultType) internal view returns (struct NewMarginCalculator.VaultDetails)
```

get vault details to save us from making multiple external calls

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | vault struct |
| _vaultType | uint256 | vault type, 0 for max loss/spreads and 1 for naked margin vault |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct NewMarginCalculator.VaultDetails | vault details in VaultDetails struct |

### _getExpiredSpreadCashValue

```solidity
function _getExpiredSpreadCashValue(struct FixedPointInt256.FixedPointInt _shortAmount, struct FixedPointInt256.FixedPointInt _longAmount, struct FixedPointInt256.FixedPointInt _shortCashValue, struct FixedPointInt256.FixedPointInt _longCashValue) internal pure returns (struct FixedPointInt256.FixedPointInt)
```

_calculate the cash value obligation for an expired vault, where a positive number is an obligation

Formula: net = (short cash value * short amount) - ( long cash value * long Amount )_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct FixedPointInt256.FixedPointInt | cash value obligation denominated in the strike asset |

### _isNotEmpty

```solidity
function _isNotEmpty(address[] _assets) internal pure returns (bool)
```

_check if asset array contain a token address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the array is not empty |

### _checkIsValidVault

```solidity
function _checkIsValidVault(struct MarginVault.Vault _vault, struct NewMarginCalculator.VaultDetails _vaultDetails) internal view
```

_ensure that:
a) at most 1 asset type used as collateral
b) at most 1 series of option used as the long option
c) at most 1 series of option used as the short option
d) asset array lengths match for long, short and collateral
e) long option and collateral asset is acceptable for margin with short asset_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | the vault to check |
| _vaultDetails | struct NewMarginCalculator.VaultDetails | vault details struct |

### _isMarginableLong

```solidity
function _isMarginableLong(struct MarginVault.Vault _vault, struct NewMarginCalculator.VaultDetails _vaultDetails) internal pure returns (bool)
```

_if there is a short option and a long option in the vault, ensure that the long option is able to be used as collateral for the short option_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | the vault to check |
| _vaultDetails | struct NewMarginCalculator.VaultDetails | vault details struct |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if long is marginable or false if not |

### _isMarginableCollateral

```solidity
function _isMarginableCollateral(struct MarginVault.Vault _vault, struct NewMarginCalculator.VaultDetails _vaultDetails) internal view returns (bool)
```

_if there is short option and collateral asset in the vault, ensure that the collateral asset is valid for the short option_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vault | struct MarginVault.Vault | the vault to check |
| _vaultDetails | struct NewMarginCalculator.VaultDetails | vault details struct |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if marginable or false |

### _getProductHash

```solidity
function _getProductHash(address _underlying, address _strike, address _collateral, bool _isPut) internal pure returns (bytes32)
```

get a product hash

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | option underlying asset |
| _strike | address | option strike asset |
| _collateral | address | option collateral asset |
| _isPut | bool | option type |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | product hash |

### _getCashValue

```solidity
function _getCashValue(struct FixedPointInt256.FixedPointInt _strikePrice, struct FixedPointInt256.FixedPointInt _underlyingPrice, bool _isPut) internal view returns (struct FixedPointInt256.FixedPointInt)
```

get option cash value

_this assume that the underlying price is denominated in strike asset
cash value = max(underlying price - strike price, 0)_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _strikePrice | struct FixedPointInt256.FixedPointInt | option strike price |
| _underlyingPrice | struct FixedPointInt256.FixedPointInt | option underlying price |
| _isPut | bool | option type, true for put and false for call option |

### _getOtokenDetails

```solidity
function _getOtokenDetails(address _otoken) internal view returns (address, address, address, uint256, uint256, bool)
```

_get otoken detail, from both otoken versions_

### makeShortScaledDetails

```solidity
function makeShortScaledDetails(uint256 short, uint256 strike, uint256 underlying) internal pure returns (struct NewMarginCalculator.ShortScaledDetails)
```

_construct a short scaled details struct_

### getOptionType

```solidity
function getOptionType(bool _isPut, address collateral, address underlying) internal view returns (enum NewMarginCalculator.OptionType)
```

get the type of option that is being created based on flavor and collateral

| Name | Type | Description |
| ---- | ---- | ----------- |
| _isPut | bool | option type, true for put and false for call option |
| collateral | address | the asset used as vault collateral |
| underlying | address | the asset used as the option reference asset |

## NewController

Contract that controls the Gamma Protocol and the interaction of all sub contracts

### addressbook

```solidity
contract AddressBookInterface addressbook
```

### whitelist

```solidity
contract WhitelistInterface whitelist
```

### oracle

```solidity
contract OracleInterface oracle
```

### calculator

```solidity
contract MarginCalculatorInterface calculator
```

### pool

```solidity
contract MarginPoolInterface pool
```

### BASE

```solidity
uint256 BASE
```

_scale used in MarginCalculator_

### partialPauser

```solidity
address partialPauser
```

address that has permission to partially pause the system, where system functionality is paused
except redeem and settleVault

### fullPauser

```solidity
address fullPauser
```

address that has permission to fully pause the system, where all system functionality is paused

### systemPartiallyPaused

```solidity
bool systemPartiallyPaused
```

True if all system functionality is paused other than redeem and settle vault

### systemFullyPaused

```solidity
bool systemFullyPaused
```

True if all system functionality is paused

### callRestricted

```solidity
bool callRestricted
```

True if a call action can only be executed to a whitelisted callee

### accountVaultCounter

```solidity
mapping(address => uint256) accountVaultCounter
```

_mapping between an owner address and the number of owner address vaults_

### vaults

```solidity
mapping(address => mapping(uint256 => struct MarginVault.Vault)) vaults
```

_mapping between an owner address and a specific vault using a vault id_

### operators

```solidity
mapping(address => mapping(address => bool)) operators
```

_mapping between an account owner and their approved or unapproved account operators_

### vaultType

```solidity
mapping(address => mapping(uint256 => uint256)) vaultType
```

_mapping to map vault by each vault type, naked margin vault should be set to 1, spread/max loss vault should be set to 0_

### vaultLatestUpdate

```solidity
mapping(address => mapping(uint256 => uint256)) vaultLatestUpdate
```

_mapping to store the timestamp at which the vault was last updated, will be updated in every action that changes the vault state or when calling sync()_

### nakedCap

```solidity
mapping(address => uint256) nakedCap
```

_mapping to store cap amount for naked margin vault per options collateral asset (scaled by collateral asset decimals)_

### nakedPoolBalance

```solidity
mapping(address => uint256) nakedPoolBalance
```

_mapping to store amount of naked margin vaults in pool_

### vaultLiquidationDetails

```solidity
mapping(address => mapping(uint256 => struct MarginVault.VaultLiquidationDetails)) vaultLiquidationDetails
```

_mapping to store liquidation states of a naked margin vault_

### AccountOperatorUpdated

```solidity
event AccountOperatorUpdated(address accountOwner, address operator, bool isSet)
```

emits an event when an account operator is updated for a specific account owner

### VaultOpened

```solidity
event VaultOpened(address accountOwner, uint256 vaultId, uint256 vaultType)
```

emits an event when a new vault is opened

### LongOtokenDeposited

```solidity
event LongOtokenDeposited(address otoken, address accountOwner, address from, uint256 vaultId, uint256 amount)
```

emits an event when a long oToken is deposited into a vault

### LongOtokenWithdrawed

```solidity
event LongOtokenWithdrawed(address otoken, address AccountOwner, address to, uint256 vaultId, uint256 amount)
```

emits an event when a long oToken is withdrawn from a vault

### CollateralAssetDeposited

```solidity
event CollateralAssetDeposited(address asset, address accountOwner, address from, uint256 vaultId, uint256 amount)
```

emits an event when a collateral asset is deposited into a vault

### CollateralAssetWithdrawed

```solidity
event CollateralAssetWithdrawed(address asset, address AccountOwner, address to, uint256 vaultId, uint256 amount)
```

emits an event when a collateral asset is withdrawn from a vault

### ShortOtokenMinted

```solidity
event ShortOtokenMinted(address otoken, address AccountOwner, address to, uint256 vaultId, uint256 amount)
```

emits an event when a short oToken is minted from a vault

### ShortOtokenBurned

```solidity
event ShortOtokenBurned(address otoken, address AccountOwner, address from, uint256 vaultId, uint256 amount)
```

emits an event when a short oToken is burned

### Redeem

```solidity
event Redeem(address otoken, address redeemer, address receiver, address collateralAsset, uint256 otokenBurned, uint256 payout)
```

emits an event when an oToken is redeemed

### VaultSettled

```solidity
event VaultSettled(address accountOwner, address oTokenAddress, address to, uint256 payout, uint256 vaultId, uint256 vaultType)
```

emits an event when a vault is settled

### VaultLiquidated

```solidity
event VaultLiquidated(address liquidator, address receiver, address vaultOwner, uint256 auctionPrice, uint256 collateralPayout, uint256 debtAmount, uint256 vaultId, address series)
```

emits an event when a vault is liquidated

### CallExecuted

```solidity
event CallExecuted(address from, address to, bytes data)
```

emits an event when a call action is executed

### FullPauserUpdated

```solidity
event FullPauserUpdated(address oldFullPauser, address newFullPauser)
```

emits an event when the fullPauser address changes

### PartialPauserUpdated

```solidity
event PartialPauserUpdated(address oldPartialPauser, address newPartialPauser)
```

emits an event when the partialPauser address changes

### SystemPartiallyPaused

```solidity
event SystemPartiallyPaused(bool isPaused)
```

emits an event when the system partial paused status changes

### SystemFullyPaused

```solidity
event SystemFullyPaused(bool isPaused)
```

emits an event when the system fully paused status changes

### CallRestricted

```solidity
event CallRestricted(bool isRestricted)
```

emits an event when the call action restriction changes

### Donated

```solidity
event Donated(address donator, address asset, uint256 amount)
```

emits an event when a donation transfer executed

### NakedCapUpdated

```solidity
event NakedCapUpdated(address collateral, uint256 cap)
```

emits an event when naked cap is updated

### notPartiallyPaused

```solidity
modifier notPartiallyPaused()
```

modifier to check if the system is not partially paused, where only redeem and settleVault is allowed

### notFullyPaused

```solidity
modifier notFullyPaused()
```

modifier to check if the system is not fully paused, where no functionality is allowed

### onlyFullPauser

```solidity
modifier onlyFullPauser()
```

modifier to check if sender is the fullPauser address

### onlyPartialPauser

```solidity
modifier onlyPartialPauser()
```

modifier to check if the sender is the partialPauser address

### onlyAuthorized

```solidity
modifier onlyAuthorized(address _sender, address _accountOwner)
```

modifier to check if the sender is the account owner or an approved account operator

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sender | address | sender address |
| _accountOwner | address | account owner address |

### onlyWhitelistedCallee

```solidity
modifier onlyWhitelistedCallee(address _callee)
```

modifier to check if the called address is a whitelisted callee address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | called address |

### _isNotPartiallyPaused

```solidity
function _isNotPartiallyPaused() internal view
```

_check if the system is not in a partiallyPaused state_

### _isNotFullyPaused

```solidity
function _isNotFullyPaused() internal view
```

_check if the system is not in an fullyPaused state_

### _isAuthorized

```solidity
function _isAuthorized(address _sender, address _accountOwner) internal view
```

_check if the sender is an authorized operator_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sender | address | msg.sender |
| _accountOwner | address | owner of a vault |

### initialize

```solidity
function initialize(address _addressBook, address _owner) external
```

initalize the deployed contract

| Name | Type | Description |
| ---- | ---- | ----------- |
| _addressBook | address | addressbook module |
| _owner | address | account owner address |

### donate

```solidity
function donate(address _asset, uint256 _amount) external
```

send asset amount to margin pool

_use donate() instead of direct transfer() to store the balance in assetBalance_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | asset address |
| _amount | uint256 | amount to donate to pool |

### setSystemPartiallyPaused

```solidity
function setSystemPartiallyPaused(bool _partiallyPaused) external
```

allows the partialPauser to toggle the systemPartiallyPaused variable and partially pause or partially unpause the system

_can only be called by the partialPauser_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _partiallyPaused | bool | new boolean value to set systemPartiallyPaused to |

### setSystemFullyPaused

```solidity
function setSystemFullyPaused(bool _fullyPaused) external
```

allows the fullPauser to toggle the systemFullyPaused variable and fully pause or fully unpause the system

_can only be called by the fullyPauser_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fullyPaused | bool | new boolean value to set systemFullyPaused to |

### setFullPauser

```solidity
function setFullPauser(address _fullPauser) external
```

allows the owner to set the fullPauser address

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fullPauser | address | new fullPauser address |

### setPartialPauser

```solidity
function setPartialPauser(address _partialPauser) external
```

allows the owner to set the partialPauser address

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _partialPauser | address | new partialPauser address |

### setCallRestriction

```solidity
function setCallRestriction(bool _isRestricted) external
```

allows the owner to toggle the restriction on whitelisted call actions and only allow whitelisted
call addresses or allow any arbitrary call addresses

_can only be called by the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _isRestricted | bool | new call restriction state |

### setOperator

```solidity
function setOperator(address _operator, bool _isOperator) external
```

allows a user to give or revoke privileges to an operator which can act on their behalf on their vaults

_can only be updated by the vault owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _operator | address | operator that the sender wants to give privileges to or revoke them from |
| _isOperator | bool | new boolean value that expresses if the sender is giving or revoking privileges for _operator |

### refreshConfiguration

```solidity
function refreshConfiguration() external
```

_updates the configuration of the controller. can only be called by the owner_

### setNakedCap

```solidity
function setNakedCap(address _collateral, uint256 _cap) external
```

set cap amount for collateral asset used in naked margin

_can only be called by owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |
| _cap | uint256 | cap amount, should be scaled by collateral asset decimals |

### operate

```solidity
function operate(struct Actions.ActionArgs[] _actions) external
```

execute a number of actions on specific vaults

_can only be called when the system is not fully paused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _actions | struct Actions.ActionArgs[] | array of actions arguments |

### sync

```solidity
function sync(address _owner, uint256 _vaultId) external
```

sync vault latest update timestamp

_anyone can update the latest time the vault was touched by calling this function
vaultLatestUpdate will sync if the vault is well collateralized_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | vault owner address |
| _vaultId | uint256 | vault id |

### clearVaultLiquidationDetails

```solidity
function clearVaultLiquidationDetails(uint256 _vaultId) external
```

clear a vaults liquidation details

| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultId | uint256 | vaultId to return balances for |

### isOperator

```solidity
function isOperator(address _owner, address _operator) external view returns (bool)
```

check if a specific address is an operator for an owner account

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner address |
| _operator | address | account operator address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the _operator is an approved operator for the _owner account |

### getConfiguration

```solidity
function getConfiguration() external view returns (address, address, address, address)
```

returns the current controller configuration

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | whitelist, the address of the whitelist module |
| [1] | address | oracle, the address of the oracle module |
| [2] | address | calculator, the address of the calculator module |
| [3] | address | pool, the address of the pool module |

### getProceed

```solidity
function getProceed(address _owner, uint256 _vaultId) external view returns (uint256)
```

return a vault's proceeds pre or post expiry, the amount of collateral that can be removed from a vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner of the vault |
| _vaultId | uint256 | vaultId to return balances for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of collateral that can be taken out |

### getVaultLiquidationDetails

```solidity
function getVaultLiquidationDetails(address _owner, uint256 _vaultId) external view returns (address, uint256, uint256)
```

return a vault's past liquidation details

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner of the vault |
| _vaultId | uint256 | vaultId to return balances for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | series address liquidated |
| [1] | uint256 | amount of shorts liquidated |
| [2] | uint256 | amount of collateral transferred for liquidation |

### isLiquidatable

```solidity
function isLiquidatable(address _owner, uint256 _vaultId) external view returns (bool, uint256, uint256)
```

check if a vault is liquidatable in a specific round id

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | vault owner address |
| _vaultId | uint256 | vault id to check |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | isUnderCollat, true if vault is undercollateralized, the price of 1 repaid otoken and the otoken collateral dust amount |
| [1] | uint256 |  |
| [2] | uint256 |  |

### getPayout

```solidity
function getPayout(address _otoken, uint256 _amount) public view returns (uint256)
```

get an oToken's payout/cash value after expiry, in the collateral asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken address |
| _amount | uint256 | amount of the oToken to calculate the payout for, always represented in 1e8 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of collateral to pay out |

### isSettlementAllowed

```solidity
function isSettlementAllowed(address _otoken) external view returns (bool)
```

_return if an expired oToken is ready to be settled, only true when price for underlying,
strike and collateral assets at this specific expiry is available in our Oracle module_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken |

### canSettleAssets

```solidity
function canSettleAssets(address _underlying, address _strike, address _collateral, uint256 _expiry) external view returns (bool)
```

_return if underlying, strike, collateral are all allowed to be settled_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | oToken underlying asset |
| _strike | address | oToken strike asset |
| _collateral | address | oToken collateral asset |
| _expiry | uint256 | otoken expiry timestamp |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the oToken has expired AND all oracle prices at the expiry timestamp have been finalized, False if not |

### getAccountVaultCounter

```solidity
function getAccountVaultCounter(address _accountOwner) external view returns (uint256)
```

get the number of vaults for a specified account owner

| Name | Type | Description |
| ---- | ---- | ----------- |
| _accountOwner | address | account owner address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | number of vaults |

### hasExpired

```solidity
function hasExpired(address _otoken) external view returns (bool)
```

check if an oToken has expired

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the otoken has expired, False if not |

### getVault

```solidity
function getVault(address _owner, uint256 _vaultId) external view returns (struct MarginVault.Vault)
```

return a specific vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner |
| _vaultId | uint256 | vault id of vault to return |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct MarginVault.Vault | Vault struct that corresponds to the _vaultId of _owner |

### getVaultWithDetails

```solidity
function getVaultWithDetails(address _owner, uint256 _vaultId) public view returns (struct MarginVault.Vault, uint256, uint256)
```

return a specific vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner |
| _vaultId | uint256 | vault id of vault to return |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct MarginVault.Vault | Vault struct that corresponds to the _vaultId of _owner, vault type and the latest timestamp when the vault was updated |
| [1] | uint256 |  |
| [2] | uint256 |  |

### getNakedCap

```solidity
function getNakedCap(address _asset) external view returns (uint256)
```

get cap amount for collateral asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | collateral asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | cap amount |

### getNakedPoolBalance

```solidity
function getNakedPoolBalance(address _asset) external view returns (uint256)
```

get amount of collateral deposited in all naked margin vaults

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | collateral asset address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | naked pool balance |

### _runActions

```solidity
function _runActions(struct Actions.ActionArgs[] _actions) internal returns (bool, address, uint256)
```

execute a variety of actions

_for each action in the action array, execute the corresponding action, only one vault can be modified
for all actions except SettleVault, Redeem, and Call_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _actions | struct Actions.ActionArgs[] | array of type Actions.ActionArgs[], which expresses which actions the user wants to execute |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | vaultUpdated, indicates if a vault has changed |
| [1] | address | owner, the vault owner if a vault has changed |
| [2] | uint256 | vaultId, the vault Id if a vault has changed |

### _verifyFinalState

```solidity
function _verifyFinalState(address _owner, uint256 _vaultId) internal view
```

verify the vault final state after executing all actions

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | account owner address |
| _vaultId | uint256 | vault id of the final vault |

### _openVault

```solidity
function _openVault(struct Actions.OpenVaultArgs _args) internal
```

open a new vault inside an account

_only the account owner or operator can open a vault, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.OpenVaultArgs | OpenVaultArgs structure |

### _depositLong

```solidity
function _depositLong(struct Actions.DepositArgs _args) internal
```

deposit a long oToken into a vault

_only the account owner or operator can deposit a long oToken, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.DepositArgs | DepositArgs structure |

### _withdrawLong

```solidity
function _withdrawLong(struct Actions.WithdrawArgs _args) internal
```

withdraw a long oToken from a vault

_only the account owner or operator can withdraw a long oToken, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.WithdrawArgs | WithdrawArgs structure |

### _depositCollateral

```solidity
function _depositCollateral(struct Actions.DepositArgs _args) internal
```

deposit a collateral asset into a vault

_only the account owner or operator can deposit collateral, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.DepositArgs | DepositArgs structure |

### _withdrawCollateral

```solidity
function _withdrawCollateral(struct Actions.WithdrawArgs _args) internal
```

withdraw a collateral asset from a vault

_only the account owner or operator can withdraw collateral, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.WithdrawArgs | WithdrawArgs structure |

### _mintOtoken

```solidity
function _mintOtoken(struct Actions.MintArgs _args) internal
```

mint short oTokens from a vault which creates an obligation that is recorded in the vault

_only the account owner or operator can mint an oToken, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.MintArgs | MintArgs structure |

### _burnOtoken

```solidity
function _burnOtoken(struct Actions.BurnArgs _args) internal
```

burn oTokens to reduce or remove the minted oToken obligation recorded in a vault

_only the account owner or operator can burn an oToken, cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.BurnArgs | MintArgs structure |

### _redeem

```solidity
function _redeem(struct Actions.RedeemArgs _args) internal
```

redeem an oToken after expiry, receiving the payout of the oToken in the collateral asset

_cannot be called when system is fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.RedeemArgs | RedeemArgs structure |

### _settleVault

```solidity
function _settleVault(struct Actions.SettleVaultArgs _args) internal
```

settle a vault after expiry, removing the net proceeds/collateral after both long and short oToken payouts have settled

_deletes a vault of vaultId after net proceeds/collateral is removed, cannot be called when system is fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.SettleVaultArgs | SettleVaultArgs structure |

### _liquidate

```solidity
function _liquidate(struct Actions.LiquidateArgs _args) internal
```

liquidate naked margin vault

_can liquidate different vaults id in the same operate() call_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.LiquidateArgs | liquidation action arguments struct |

### _call

```solidity
function _call(struct Actions.CallArgs _args) internal
```

execute arbitrary calls

_cannot be called when system is partiallyPaused or fullyPaused_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _args | struct Actions.CallArgs | Call action |

### _checkVaultId

```solidity
function _checkVaultId(address _accountOwner, uint256 _vaultId) internal view returns (bool)
```

check if a vault id is valid for a given account owner address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _accountOwner | address | account owner address |
| _vaultId | uint256 | vault id to check |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the _vaultId is valid, False if not |

### _isNotEmpty

```solidity
function _isNotEmpty(address[] _array) internal pure returns (bool)
```

### _isCalleeWhitelisted

```solidity
function _isCalleeWhitelisted(address _callee) internal view returns (bool)
```

return if a callee address is whitelisted or not

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | callee address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if callee address is whitelisted, False if not |

### _isLiquidatable

```solidity
function _isLiquidatable(address _owner, uint256 _vaultId) internal view returns (struct MarginVault.Vault, bool, uint256, uint256)
```

check if a vault is liquidatable in a specific round id

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | vault owner address |
| _vaultId | uint256 | vault id to check |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct MarginVault.Vault | vault struct, isLiquidatable, true if vault is undercollateralized, the price of 1 repaid otoken and the otoken collateral dust amount |
| [1] | bool |  |
| [2] | uint256 |  |
| [3] | uint256 |  |

### _getOtokenDetails

```solidity
function _getOtokenDetails(address _otoken) internal view returns (address, address, address, uint256)
```

_get otoken detail, from both otoken versions_

### _canSettleAssets

```solidity
function _canSettleAssets(address _underlying, address _strike, address _collateral, uint256 _expiry) internal view returns (bool)
```

_return if an expired oToken is ready to be settled, only true when price for underlying,
strike and collateral assets at this specific expiry is available in our Oracle module_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the oToken has expired AND all oracle prices at the expiry timestamp have been finalized, False if not |

### _refreshConfigInternal

```solidity
function _refreshConfigInternal() internal
```

_updates the internal configuration of the controller_

## MarginCalculatorInterface

### addressBook

```solidity
function addressBook() external view returns (address)
```

### getExpiredPayoutRate

```solidity
function getExpiredPayoutRate(address _otoken) external view returns (uint256)
```

### getExcessCollateral

```solidity
function getExcessCollateral(struct MarginVault.Vault _vault, uint256 _vaultType) external view returns (uint256 netValue, bool isExcess)
```

### isLiquidatable

```solidity
function isLiquidatable(struct MarginVault.Vault _vault, uint256 _vaultType) external view returns (bool, uint256, uint256)
```

## NewWhitelist

The whitelist module keeps track of all valid oToken addresses, product hashes, collateral addresses, and callee addresses.

### addressBook

```solidity
address addressBook
```

AddressBook module address

### whitelistedProduct

```solidity
mapping(bytes32 => bool) whitelistedProduct
```

_mapping to track whitelisted products_

### whitelistedCollateral

```solidity
mapping(address => bool) whitelistedCollateral
```

_mapping to track whitelisted collateral_

### coveredWhitelistedCollateral

```solidity
mapping(bytes32 => bool) coveredWhitelistedCollateral
```

_mapping to mapping to track whitelisted collateral for covered calls or puts_

### nakedWhitelistedCollateral

```solidity
mapping(bytes32 => bool) nakedWhitelistedCollateral
```

_mapping to mapping to track whitelisted collateral for naked calls or puts_

### whitelistedOtoken

```solidity
mapping(address => bool) whitelistedOtoken
```

_mapping to track whitelisted oTokens_

### whitelistedCallee

```solidity
mapping(address => bool) whitelistedCallee
```

_mapping to track whitelisted callee addresses for the call action_

### constructor

```solidity
constructor(address _addressBook) public
```

_constructor_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _addressBook | address | AddressBook module address |

### ProductWhitelisted

```solidity
event ProductWhitelisted(bytes32 productHash, address underlying, address strike, address collateral, bool isPut)
```

emits an event a product is whitelisted by the owner address

### ProductBlacklisted

```solidity
event ProductBlacklisted(bytes32 productHash, address underlying, address strike, address collateral, bool isPut)
```

emits an event a product is blacklisted by the owner address

### CollateralWhitelisted

```solidity
event CollateralWhitelisted(address collateral)
```

emits an event when a collateral address is whitelisted by the owner address

### CoveredCollateralWhitelisted

```solidity
event CoveredCollateralWhitelisted(address collateral, address underlying, bool isPut)
```

emits an event when a collateral address for vault type 0 is whitelisted by the owner address

### NakedCollateralWhitelisted

```solidity
event NakedCollateralWhitelisted(address collateral, address underlying, bool isPut)
```

emits an event when a collateral address for vault type 1 is whitelisted by the owner address

### CollateralBlacklisted

```solidity
event CollateralBlacklisted(address collateral)
```

emits an event when a collateral address is blacklist by the owner address

### OtokenWhitelisted

```solidity
event OtokenWhitelisted(address otoken)
```

emits an event when an oToken is whitelisted by the OtokenFactory module

### OtokenBlacklisted

```solidity
event OtokenBlacklisted(address otoken)
```

emits an event when an oToken is blacklisted by the OtokenFactory module

### CalleeWhitelisted

```solidity
event CalleeWhitelisted(address _callee)
```

emits an event when a callee address is whitelisted by the owner address

### CalleeBlacklisted

```solidity
event CalleeBlacklisted(address _callee)
```

emits an event when a callee address is blacklisted by the owner address

### onlyFactory

```solidity
modifier onlyFactory()
```

check if the sender is the oTokenFactory module

### isWhitelistedProduct

```solidity
function isWhitelistedProduct(address _underlying, address _strike, address _collateral, bool _isPut) external view returns (bool)
```

check if a product is whitelisted

_product is the hash of underlying asset, strike asset, collateral asset, and isPut_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | asset that the option references |
| _strike | address | asset that the strike price is denominated in |
| _collateral | address | asset that is held as collateral against short/written options |
| _isPut | bool | True if a put option, False if a call option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if product is whitelisted |

### isWhitelistedCollateral

```solidity
function isWhitelistedCollateral(address _collateral) external view returns (bool)
```

check if a collateral asset is whitelisted

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | asset that is held as collateral against short/written options |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if the collateral is whitelisted |

### isCoveredWhitelistedCollateral

```solidity
function isCoveredWhitelistedCollateral(address _collateral, address _underlying, bool _isPut) external view returns (bool)
```

check if a collateral asset is whitelisted for vault type 0

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | asset that is held as collateral against short/written options |
| _underlying | address | asset that is used as the underlying asset for the written options |
| _isPut | bool | bool for whether the collateral is to be checked for suitability on a call or put |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if the collateral is whitelisted for vault type 0 |

### isNakedWhitelistedCollateral

```solidity
function isNakedWhitelistedCollateral(address _collateral, address _underlying, bool _isPut) external view returns (bool)
```

check if a collateral asset is whitelisted for vault type 1

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | asset that is held as collateral against short/written options |
| _underlying | address | asset that is used as the underlying asset for the written options |
| _isPut | bool | bool for whether the collateral is to be checked for suitability on a call or put |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if the collateral is whitelisted for vault type 1 |

### isWhitelistedOtoken

```solidity
function isWhitelistedOtoken(address _otoken) external view returns (bool)
```

check if an oToken is whitelisted

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otoken | address | oToken address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if the oToken is whitelisted |

### isWhitelistedCallee

```solidity
function isWhitelistedCallee(address _callee) external view returns (bool)
```

check if a callee address is whitelisted for the call action

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | callee destination address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | boolean, True if the address is whitelisted |

### whitelistProduct

```solidity
function whitelistProduct(address _underlying, address _strike, address _collateral, bool _isPut) external
```

allows the owner to whitelist a product

_product is the hash of underlying asset, strike asset, collateral asset, and isPut
can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | asset that the option references |
| _strike | address | asset that the strike price is denominated in |
| _collateral | address | asset that is held as collateral against short/written options |
| _isPut | bool | True if a put option, False if a call option |

### blacklistProduct

```solidity
function blacklistProduct(address _underlying, address _strike, address _collateral, bool _isPut) external
```

allow the owner to blacklist a product

_product is the hash of underlying asset, strike asset, collateral asset, and isPut
can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | asset that the option references |
| _strike | address | asset that the strike price is denominated in |
| _collateral | address | asset that is held as collateral against short/written options |
| _isPut | bool | True if a put option, False if a call option |

### whitelistCollateral

```solidity
function whitelistCollateral(address _collateral) external
```

allows the owner to whitelist a collateral address

_can only be called from the owner address. This function is used to whitelist any asset other than Otoken as collateral. WhitelistOtoken() is used to whitelist Otoken contracts._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |

### whitelistCoveredCollateral

```solidity
function whitelistCoveredCollateral(address _collateral, address _underlying, bool _isPut) external
```

allows the owner to whitelist a collateral address for vault type 0

_can only be called from the owner address. This function is used to whitelist any asset other than Otoken as collateral._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |
| _underlying | address | underlying asset address |
| _isPut | bool | bool for whether the collateral is suitable for puts or calls |

### whitelistNakedCollateral

```solidity
function whitelistNakedCollateral(address _collateral, address _underlying, bool _isPut) external
```

allows the owner to whitelist a collateral address for vault type 1

_can only be called from the owner address. This function is used to whitelist any asset other than Otoken as collateral._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |
| _underlying | address | underlying asset address |
| _isPut | bool | bool for whether the collateral is suitable for puts or calls |

### blacklistCollateral

```solidity
function blacklistCollateral(address _collateral) external
```

allows the owner to blacklist a collateral address

_can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateral | address | collateral asset address |

### whitelistOtoken

```solidity
function whitelistOtoken(address _otokenAddress) external
```

allows the OtokenFactory module to whitelist a new option

_can only be called from the OtokenFactory address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otokenAddress | address | oToken |

### blacklistOtoken

```solidity
function blacklistOtoken(address _otokenAddress) external
```

allows the owner to blacklist an option

_can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _otokenAddress | address | oToken |

### whitelistCallee

```solidity
function whitelistCallee(address _callee) external
```

allows the owner to whitelist a destination address for the call action

_can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | callee address |

### blacklistCallee

```solidity
function blacklistCallee(address _callee) external
```

allows the owner to blacklist a destination address for the call action

_can only be called from the owner address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callee | address | callee address |

## BokkyPooBahsDateTimeLibrary

### SECONDS_PER_DAY

```solidity
uint256 SECONDS_PER_DAY
```

### OFFSET19700101

```solidity
int256 OFFSET19700101
```

### _daysToDate

```solidity
function _daysToDate(uint256 _days) internal pure returns (uint256 year, uint256 month, uint256 day)
```

### timestampToDate

```solidity
function timestampToDate(uint256 timestamp) internal pure returns (uint256 year, uint256 month, uint256 day)
```

## Spawn

This contract provides creation code that is used by Spawner in order
to initialize and deploy eip-1167 minimal proxies for a given logic contract.
SPDX-License-Identifier: MIT

### constructor

```solidity
constructor(address logicContract, bytes initializationCalldata) public payable
```

## Address

_Collection of functions related to the address type_

### isContract

```solidity
function isContract(address account) internal view returns (bool)
```

_Returns true if `account` is a contract.

[IMPORTANT]
====
It is unsafe to assume that an address for which this function returns
false is an externally-owned account (EOA) and not a contract.

Among others, `isContract` will return false for the following
types of addresses:

 - an externally-owned account
 - a contract in construction
 - an address where a contract will be created
 - an address where a contract lived, but was destroyed
====_

### sendValue

```solidity
function sendValue(address payable recipient, uint256 amount) internal
```

_Replacement for Solidity's `transfer`: sends `amount` wei to
`recipient`, forwarding all available gas and reverting on errors.

https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
of certain opcodes, possibly making contracts go over the 2300 gas limit
imposed by `transfer`, making them unable to receive funds via
`transfer`. {sendValue} removes this limitation.

https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].

IMPORTANT: because control is transferred to `recipient`, care must be
taken to not create reentrancy vulnerabilities. Consider using
{ReentrancyGuard} or the
https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern]._

### functionCall

```solidity
function functionCall(address target, bytes data) internal returns (bytes)
```

_Performs a Solidity function call using a low level `call`. A
plain`call` is an unsafe replacement for a function call: use this
function instead.

If `target` reverts with a revert reason, it is bubbled up by this
function (like regular Solidity function calls).

Returns the raw returned data. To convert to the expected return value,
use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].

Requirements:

- `target` must be a contract.
- calling `target` with `data` must not revert.

_Available since v3.1.__

### functionCall

```solidity
function functionCall(address target, bytes data, string errorMessage) internal returns (bytes)
```

_Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
`errorMessage` as a fallback revert reason when `target` reverts.

_Available since v3.1.__

### functionCallWithValue

```solidity
function functionCallWithValue(address target, bytes data, uint256 value) internal returns (bytes)
```

_Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
but also transferring `value` wei to `target`.

Requirements:

- the calling contract must have an ETH balance of at least `value`.
- the called Solidity function must be `payable`.

_Available since v3.1.__

### functionCallWithValue

```solidity
function functionCallWithValue(address target, bytes data, uint256 value, string errorMessage) internal returns (bytes)
```

_Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
with `errorMessage` as a fallback revert reason when `target` reverts.

_Available since v3.1.__

### _functionCallWithValue

```solidity
function _functionCallWithValue(address target, bytes data, uint256 weiValue, string errorMessage) private returns (bytes)
```

## Context

### _msgSender

```solidity
function _msgSender() internal view virtual returns (address payable)
```

### _msgData

```solidity
function _msgData() internal view virtual returns (bytes)
```

## Create2

_Helper to make usage of the `CREATE2` EVM opcode easier and safer.
`CREATE2` can be used to compute in advance the address where a smart
contract will be deployed, which allows for interesting new mechanisms known
as 'counterfactual interactions'.

See the https://eips.ethereum.org/EIPS/eip-1014#motivation[EIP] for more
information._

### deploy

```solidity
function deploy(uint256 amount, bytes32 salt, bytes bytecode) internal returns (address)
```

_Deploys a contract using `CREATE2`. The address where the contract
will be deployed can be known in advance via {computeAddress}.

The bytecode for a contract can be obtained from Solidity with
`type(contractName).creationCode`.

Requirements:

- `bytecode` must not be empty.
- `salt` must have not been used for `bytecode` already.
- the factory must have a balance of at least `amount`.
- if `amount` is non-zero, `bytecode` must have a `payable` constructor._

### computeAddress

```solidity
function computeAddress(bytes32 salt, bytes32 bytecodeHash) internal view returns (address)
```

_Returns the address where a contract will be stored if deployed via {deploy}. Any change in the
`bytecodeHash` or `salt` will result in a new destination address._

### computeAddress

```solidity
function computeAddress(bytes32 salt, bytes32 bytecodeHash, address deployer) internal pure returns (address)
```

_Returns the address where a contract will be stored if deployed via {deploy} from a contract located at
`deployer`. If `deployer` is this contract's address, returns the same value as {computeAddress}._

## Ownable

_Contract module which provides a basic access control mechanism, where
there is an account (an owner) that can be granted exclusive access to
specific functions.

By default, the owner account will be the one that deploys the contract. This
can later be changed with {transferOwnership}.

This module is used through inheritance. It will make available the modifier
`onlyOwner`, which can be applied to your functions to restrict their use to
the owner._

### _owner

```solidity
address _owner
```

### OwnershipTransferred

```solidity
event OwnershipTransferred(address previousOwner, address newOwner)
```

### constructor

```solidity
constructor() internal
```

_Initializes the contract setting the deployer as the initial owner._

### owner

```solidity
function owner() public view returns (address)
```

_Returns the address of the current owner._

### onlyOwner

```solidity
modifier onlyOwner()
```

_Throws if called by any account other than the owner._

### renounceOwnership

```solidity
function renounceOwnership() public virtual
```

_Leaves the contract without owner. It will not be possible to call
`onlyOwner` functions anymore. Can only be called by the current owner.

NOTE: Renouncing ownership will leave the contract without an owner,
thereby removing any functionality that is only available to the owner._

### transferOwnership

```solidity
function transferOwnership(address newOwner) public virtual
```

_Transfers ownership of the contract to a new account (`newOwner`).
Can only be called by the current owner._

## ReentrancyGuard

_Contract module that helps prevent reentrant calls to a function.

Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
available, which can be applied to functions to make sure there are no nested
(reentrant) calls to them.

Note that because there is a single `nonReentrant` guard, functions marked as
`nonReentrant` may not call one another. This can be worked around by making
those functions `private`, and then adding `external` `nonReentrant` entry
points to them.

TIP: If you would like to learn more about reentrancy and alternative ways
to protect against it, check out our blog post
https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul]._

### _NOT_ENTERED

```solidity
uint256 _NOT_ENTERED
```

### _ENTERED

```solidity
uint256 _ENTERED
```

### _status

```solidity
uint256 _status
```

### constructor

```solidity
constructor() internal
```

### nonReentrant

```solidity
modifier nonReentrant()
```

_Prevents a contract from calling itself, directly or indirectly.
Calling a `nonReentrant` function from another `nonReentrant`
function is not supported. It is possible to prevent this from happening
by making the `nonReentrant` function external, and make it call a
`private` function that does the actual work._

## SafeERC20

_Wrappers around ERC20 operations that throw on failure (when the token
contract returns false). Tokens that return no value (and instead revert or
throw on failure) are also supported, non-reverting calls are assumed to be
successful.
To use this library you can add a `using SafeERC20 for ERC20Interface;` statement to your contract,
which allows you to call the safe operations as `token.safeTransfer(...)`, etc._

### safeTransfer

```solidity
function safeTransfer(contract ERC20Interface token, address to, uint256 value) internal
```

### safeTransferFrom

```solidity
function safeTransferFrom(contract ERC20Interface token, address from, address to, uint256 value) internal
```

### safeApprove

```solidity
function safeApprove(contract ERC20Interface token, address spender, uint256 value) internal
```

_Deprecated. This function has issues similar to the ones found in
{ERC20Interface-approve}, and its usage is discouraged.

Whenever possible, use {safeIncreaseAllowance} and
{safeDecreaseAllowance} instead._

### safeIncreaseAllowance

```solidity
function safeIncreaseAllowance(contract ERC20Interface token, address spender, uint256 value) internal
```

### safeDecreaseAllowance

```solidity
function safeDecreaseAllowance(contract ERC20Interface token, address spender, uint256 value) internal
```

### _callOptionalReturn

```solidity
function _callOptionalReturn(contract ERC20Interface token, bytes data) private
```

_Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
on the return value: the return value is optional (but if data is returned, it must not be false)._

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | contract ERC20Interface | The token targeted by the call. |
| data | bytes | The call data (encoded using abi.encode or one of its variants). |

## SafeMath

_Wrappers over Solidity's arithmetic operations with added overflow
checks.

Arithmetic operations in Solidity wrap on overflow. This can easily result
in bugs, because programmers usually assume that an overflow raises an
error, which is the standard behavior in high level programming languages.
`SafeMath` restores this intuition by reverting the transaction when an
operation overflows.

Using this library instead of the unchecked operations eliminates an entire
class of bugs, so it's recommended to use it always._

### add

```solidity
function add(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the addition of two unsigned integers, reverting on
overflow.

Counterpart to Solidity's `+` operator.

Requirements:
- Addition cannot overflow._

### sub

```solidity
function sub(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the subtraction of two unsigned integers, reverting on
overflow (when the result is negative).

Counterpart to Solidity's `-` operator.

Requirements:
- Subtraction cannot overflow._

### sub

```solidity
function sub(uint256 a, uint256 b, string errorMessage) internal pure returns (uint256)
```

_Returns the subtraction of two unsigned integers, reverting with custom message on
overflow (when the result is negative).

Counterpart to Solidity's `-` operator.

Requirements:
- Subtraction cannot overflow._

### mul

```solidity
function mul(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the multiplication of two unsigned integers, reverting on
overflow.

Counterpart to Solidity's `*` operator.

Requirements:
- Multiplication cannot overflow._

### div

```solidity
function div(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the integer division of two unsigned integers. Reverts on
division by zero. The result is rounded towards zero.

Counterpart to Solidity's `/` operator. Note: this function uses a
`revert` opcode (which leaves remaining gas untouched) while Solidity
uses an invalid opcode to revert (consuming all remaining gas).

Requirements:
- The divisor cannot be zero._

### div

```solidity
function div(uint256 a, uint256 b, string errorMessage) internal pure returns (uint256)
```

_Returns the integer division of two unsigned integers. Reverts with custom message on
division by zero. The result is rounded towards zero.

Counterpart to Solidity's `/` operator. Note: this function uses a
`revert` opcode (which leaves remaining gas untouched) while Solidity
uses an invalid opcode to revert (consuming all remaining gas).

Requirements:
- The divisor cannot be zero._

### mod

```solidity
function mod(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
Reverts when dividing by zero.

Counterpart to Solidity's `%` operator. This function uses a `revert`
opcode (which leaves remaining gas untouched) while Solidity uses an
invalid opcode to revert (consuming all remaining gas).

Requirements:
- The divisor cannot be zero._

### mod

```solidity
function mod(uint256 a, uint256 b, string errorMessage) internal pure returns (uint256)
```

_Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
Reverts with custom message when dividing by zero.

Counterpart to Solidity's `%` operator. This function uses a `revert`
opcode (which leaves remaining gas untouched) while Solidity uses an
invalid opcode to revert (consuming all remaining gas).

Requirements:
- The divisor cannot be zero._

## SignedSafeMath

_Signed math operations with safety checks that revert on error._

### _INT256_MIN

```solidity
int256 _INT256_MIN
```

### mul

```solidity
function mul(int256 a, int256 b) internal pure returns (int256)
```

_Returns the multiplication of two signed integers, reverting on
overflow.

Counterpart to Solidity's `*` operator.

Requirements:

- Multiplication cannot overflow._

### div

```solidity
function div(int256 a, int256 b) internal pure returns (int256)
```

_Returns the integer division of two signed integers. Reverts on
division by zero. The result is rounded towards zero.

Counterpart to Solidity's `/` operator. Note: this function uses a
`revert` opcode (which leaves remaining gas untouched) while Solidity
uses an invalid opcode to revert (consuming all remaining gas).

Requirements:

- The divisor cannot be zero._

### sub

```solidity
function sub(int256 a, int256 b) internal pure returns (int256)
```

_Returns the subtraction of two signed integers, reverting on
overflow.

Counterpart to Solidity's `-` operator.

Requirements:

- Subtraction cannot overflow._

### add

```solidity
function add(int256 a, int256 b) internal pure returns (int256)
```

_Returns the addition of two signed integers, reverting on
overflow.

Counterpart to Solidity's `+` operator.

Requirements:

- Addition cannot overflow._

## Strings

_String operations._

### toString

```solidity
function toString(uint256 value) internal pure returns (string)
```

_Converts a `uint256` to its ASCII `string` representation._

## ERC20Upgradeable

_Implementation of the {IERC20} interface.

This implementation is agnostic to the way tokens are created. This means
that a supply mechanism has to be added in a derived contract using {_mint}.
For a generic mechanism see {ERC20PresetMinterPauser}.

TIP: For a detailed writeup see our guide
https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226[How
to implement supply mechanisms].

We have followed general OpenZeppelin guidelines: functions revert instead
of returning `false` on failure. This behavior is nonetheless conventional
and does not conflict with the expectations of ERC20 applications.

Additionally, an {Approval} event is emitted on calls to {transferFrom}.
This allows applications to reconstruct the allowance for all accounts just
by listening to said events. Other implementations of the EIP may not emit
these events, as it isn't required by the specification.

Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
functions have been added to mitigate the well-known issues around setting
allowances. See {IERC20-approve}._

### _balances

```solidity
mapping(address => uint256) _balances
```

### _allowances

```solidity
mapping(address => mapping(address => uint256)) _allowances
```

### _totalSupply

```solidity
uint256 _totalSupply
```

### _name

```solidity
string _name
```

### _symbol

```solidity
string _symbol
```

### _decimals

```solidity
uint8 _decimals
```

### __ERC20_init

```solidity
function __ERC20_init(string name_, string symbol_) internal
```

_Sets the values for {name} and {symbol}, initializes {decimals} with
a default value of 18.

To select a different value for {decimals}, use {_setupDecimals}.

All three of these values are immutable: they can only be set once during
construction._

### __ERC20_init_unchained

```solidity
function __ERC20_init_unchained(string name_, string symbol_) internal
```

### name

```solidity
function name() public view returns (string)
```

_Returns the name of the token._

### symbol

```solidity
function symbol() public view returns (string)
```

_Returns the symbol of the token, usually a shorter version of the
name._

### decimals

```solidity
function decimals() public view returns (uint8)
```

_Returns the number of decimals used to get its user representation.
For example, if `decimals` equals `2`, a balance of `505` tokens should
be displayed to a user as `5,05` (`505 / 10 ** 2`).

Tokens usually opt for a value of 18, imitating the relationship between
Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is
called.

NOTE: This information is only used for _display_ purposes: it in
no way affects any of the arithmetic of the contract, including
{IERC20-balanceOf} and {IERC20-transfer}._

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

_See {IERC20-totalSupply}._

### balanceOf

```solidity
function balanceOf(address account) public view returns (uint256)
```

_See {IERC20-balanceOf}._

### transfer

```solidity
function transfer(address recipient, uint256 amount) public virtual returns (bool)
```

_See {IERC20-transfer}.

Requirements:

- `recipient` cannot be the zero address.
- the caller must have a balance of at least `amount`._

### allowance

```solidity
function allowance(address owner, address spender) public view virtual returns (uint256)
```

_See {IERC20-allowance}._

### approve

```solidity
function approve(address spender, uint256 amount) public virtual returns (bool)
```

_See {IERC20-approve}.

Requirements:

- `spender` cannot be the zero address._

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) public virtual returns (bool)
```

_See {IERC20-transferFrom}.

Emits an {Approval} event indicating the updated allowance. This is not
required by the EIP. See the note at the beginning of {ERC20}.

Requirements:

- `sender` and `recipient` cannot be the zero address.
- `sender` must have a balance of at least `amount`.
- the caller must have allowance for ``sender``'s tokens of at least
`amount`._

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool)
```

_Atomically increases the allowance granted to `spender` by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- `spender` cannot be the zero address._

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool)
```

_Atomically decreases the allowance granted to `spender` by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- `spender` cannot be the zero address.
- `spender` must have allowance for the caller of at least
`subtractedValue`._

### _transfer

```solidity
function _transfer(address sender, address recipient, uint256 amount) internal virtual
```

_Moves tokens `amount` from `sender` to `recipient`.

This is internal function is equivalent to {transfer}, and can be used to
e.g. implement automatic token fees, slashing mechanisms, etc.

Emits a {Transfer} event.

Requirements:

- `sender` cannot be the zero address.
- `recipient` cannot be the zero address.
- `sender` must have a balance of at least `amount`._

### _mint

```solidity
function _mint(address account, uint256 amount) internal virtual
```

_Creates `amount` tokens and assigns them to `account`, increasing
the total supply.

Emits a {Transfer} event with `from` set to the zero address.

Requirements:

- `to` cannot be the zero address._

### _burn

```solidity
function _burn(address account, uint256 amount) internal virtual
```

_Destroys `amount` tokens from `account`, reducing the
total supply.

Emits a {Transfer} event with `to` set to the zero address.

Requirements:

- `account` cannot be the zero address.
- `account` must have at least `amount` tokens._

### _approve

```solidity
function _approve(address owner, address spender, uint256 amount) internal virtual
```

_Sets `amount` as the allowance of `spender` over the `owner` s tokens.

This internal function is equivalent to `approve`, and can be used to
e.g. set automatic allowances for certain subsystems, etc.

Emits an {Approval} event.

Requirements:

- `owner` cannot be the zero address.
- `spender` cannot be the zero address._

### _setupDecimals

```solidity
function _setupDecimals(uint8 decimals_) internal
```

_Sets {decimals} to a value other than the default one of 18.

WARNING: This function should only be called from the constructor. Most
applications that interact with token contracts will not expect
{decimals} to ever change, and may work incorrectly if it does._

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual
```

_Hook that is called before any transfer of tokens. This includes
minting and burning.

Calling conditions:

- when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
will be to transferred to `to`.
- when `from` is zero, `amount` tokens will be minted for `to`.
- when `to` is zero, `amount` of ``from``'s tokens will be burned.
- `from` and `to` are never both zero.

To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks]._

### __gap

```solidity
uint256[44] __gap
```

## ContextUpgradeable

### __Context_init

```solidity
function __Context_init() internal
```

### __Context_init_unchained

```solidity
function __Context_init_unchained() internal
```

### _msgSender

```solidity
function _msgSender() internal view virtual returns (address payable)
```

### _msgData

```solidity
function _msgData() internal view virtual returns (bytes)
```

### __gap

```solidity
uint256[50] __gap
```

## IERC20Upgradeable

_Interface of the ERC20 standard as defined in the EIP._

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

_Returns the amount of tokens in existence._

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

_Returns the amount of tokens owned by `account`._

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from the caller's account to `recipient`.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

_Returns the remaining number of tokens that `spender` will be
allowed to spend on behalf of `owner` through {transferFrom}. This is
zero by default.

This value changes when {approve} or {transferFrom} are called._

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

_Sets `amount` as the allowance of `spender` over the caller's tokens.

Returns a boolean value indicating whether the operation succeeded.

IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender's allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

Emits an {Approval} event._

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from `sender` to `recipient` using the
allowance mechanism. `amount` is then deducted from the caller's
allowance.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

_Emitted when `value` tokens are moved from one account (`from`) to
another (`to`).

Note that `value` may be zero._

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

_Emitted when the allowance of a `spender` for an `owner` is set by
a call to {approve}. `value` is the new allowance._

## Initializable

_Helper contract to support initializer functions. To use it, replace
the constructor with a function that has the `initializer` modifier.
WARNING: Unlike constructors, initializer functions must be manually
invoked. This applies both to deploying an Initializable contract, as well
as extending an Initializable contract via inheritance.
WARNING: When used with inheritance, manual care must be taken to not invoke
a parent initializer twice, or ensure that all initializers are idempotent,
because this is not dealt with automatically as with constructors._

### initialized

```solidity
bool initialized
```

_Indicates that the contract has been initialized._

### initializing

```solidity
bool initializing
```

_Indicates that the contract is in the process of being initialized._

### initializer

```solidity
modifier initializer()
```

_Modifier to use in the initializer function of a contract._

### isConstructor

```solidity
function isConstructor() private view returns (bool)
```

_Returns true if and only if the function is running in the constructor_

### ______gap

```solidity
uint256[50] ______gap
```

## OwnableUpgradeSafe

_Contract module which provides a basic access control mechanism, where
there is an account (an owner) that can be granted exclusive access to
specific functions.

By default, the owner account will be the one that deploys the contract. This
can later be changed with {transferOwnership}.

This module is used through inheritance. It will make available the modifier
`onlyOwner`, which can be applied to your functions to restrict their use to
the owner._

### _owner

```solidity
address _owner
```

### OwnershipTransferred

```solidity
event OwnershipTransferred(address previousOwner, address newOwner)
```

### __Ownable_init

```solidity
function __Ownable_init(address _sender) internal
```

_Initializes the contract setting the deployer as the initial owner._

### __Ownable_init_unchained

```solidity
function __Ownable_init_unchained(address _sender) internal
```

### owner

```solidity
function owner() public view returns (address)
```

_Returns the address of the current owner._

### onlyOwner

```solidity
modifier onlyOwner()
```

_Throws if called by any account other than the owner._

### renounceOwnership

```solidity
function renounceOwnership() public virtual
```

_Leaves the contract without owner. It will not be possible to call
`onlyOwner` functions anymore. Can only be called by the current owner.

NOTE: Renouncing ownership will leave the contract without an owner,
thereby removing any functionality that is only available to the owner._

### transferOwnership

```solidity
function transferOwnership(address newOwner) public virtual
```

_Transfers ownership of the contract to a new account (`newOwner`).
Can only be called by the current owner._

### __gap

```solidity
uint256[49] __gap
```

## OwnedUpgradeabilityProxy

_This contract combines an upgradeability proxy with basic authorization control functionalities_

### ProxyOwnershipTransferred

```solidity
event ProxyOwnershipTransferred(address previousOwner, address newOwner)
```

_Event to show ownership has been transferred_

| Name | Type | Description |
| ---- | ---- | ----------- |
| previousOwner | address | representing the address of the previous owner |
| newOwner | address | representing the address of the new owner |

### proxyOwnerPosition

```solidity
bytes32 proxyOwnerPosition
```

_Storage position of the owner of the contract_

### constructor

```solidity
constructor() public
```

_the constructor sets the original owner of the contract to the sender account._

### onlyProxyOwner

```solidity
modifier onlyProxyOwner()
```

_Throws if called by any account other than the owner._

### proxyOwner

```solidity
function proxyOwner() public view returns (address owner)
```

_Tells the address of the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | the address of the owner |

### setUpgradeabilityOwner

```solidity
function setUpgradeabilityOwner(address _newProxyOwner) internal
```

_Sets the address of the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newProxyOwner | address | address of new proxy owner |

### transferProxyOwnership

```solidity
function transferProxyOwnership(address _newOwner) public
```

_Allows the current owner to transfer control of the contract to a newOwner._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address | The address to transfer ownership to. |

### upgradeTo

```solidity
function upgradeTo(address _implementation) public
```

_Allows the proxy owner to upgrade the current version of the proxy._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _implementation | address | representing the address of the new implementation to be set. |

### upgradeToAndCall

```solidity
function upgradeToAndCall(address _implementation, bytes _data) public payable
```

_Allows the proxy owner to upgrade the current version of the proxy and call the new implementation
to initialize whatever is needed through a low level call._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _implementation | address | representing the address of the new implementation to be set. |
| _data | bytes | represents the msg.data to bet sent in the low level call. This parameter may include the function signature of the implementation to be called with the needed payload |

## Proxy

_Gives the possibility to delegate any call to a foreign implementation._

### implementation

```solidity
function implementation() public view virtual returns (address)
```

_Tells the address of the implementation where every call will be delegated._

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | address of the implementation to which it will be delegated |

### fallback

```solidity
fallback() external payable
```

_Fallback function allowing to perform a delegatecall to the given implementation.
This function will return whatever the implementation call returns_

## ReentrancyGuardUpgradeSafe

_Contract module that helps prevent reentrant calls to a function.

Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
available, which can be applied to functions to make sure there are no nested
(reentrant) calls to them.

Note that because there is a single `nonReentrant` guard, functions marked as
`nonReentrant` may not call one another. This can be worked around by making
those functions `private`, and then adding `external` `nonReentrant` entry
points to them.

TIP: If you would like to learn more about reentrancy and alternative ways
to protect against it, check out our blog post
https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul]._

### _notEntered

```solidity
bool _notEntered
```

### __ReentrancyGuard_init

```solidity
function __ReentrancyGuard_init() internal
```

### __ReentrancyGuard_init_unchained

```solidity
function __ReentrancyGuard_init_unchained() internal
```

### nonReentrant

```solidity
modifier nonReentrant()
```

_Prevents a contract from calling itself, directly or indirectly.
Calling a `nonReentrant` function from another `nonReentrant`
function is not supported. It is possible to prevent this from happening
by making the `nonReentrant` function external, and make it call a
`private` function that does the actual work._

### __gap

```solidity
uint256[49] __gap
```

## UpgradeabilityProxy

_This contract represents a proxy where the implementation address to which it will delegate can be upgraded_

### Upgraded

```solidity
event Upgraded(address implementation)
```

_This event will be emitted every time the implementation gets upgraded_

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | representing the address of the upgraded implementation |

### implementationPosition

```solidity
bytes32 implementationPosition
```

_Storage position of the address of the current implementation_

### implementation

```solidity
function implementation() public view returns (address impl)
```

_Tells the address of the current implementation_

| Name | Type | Description |
| ---- | ---- | ----------- |
| impl | address | address of the current implementation |

### setImplementation

```solidity
function setImplementation(address _newImplementation) internal
```

_Sets the address of the current implementation_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newImplementation | address | address representing the new implementation to be set |

### _upgradeTo

```solidity
function _upgradeTo(address _newImplementation) internal
```

_Upgrades the implementation address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newImplementation | address | representing the address of the new implementation to be set |

## ECDSAUpgradeable

_Elliptic Curve Digital Signature Algorithm (ECDSA) operations.

These functions can be used to verify that a message was signed by the holder
of the private keys of a given address._

### recover

```solidity
function recover(bytes32 hash, bytes signature) internal pure returns (address)
```

_Returns the address that signed a hashed message (`hash`) with
`signature`. This address can then be used for verification purposes.

The `ecrecover` EVM opcode allows for malleable (non-unique) signatures:
this function rejects them by requiring the `s` value to be in the lower
half order, and the `v` value to be either 27 or 28.

IMPORTANT: `hash` _must_ be the result of a hash operation for the
verification to be secure: it is possible to craft signatures that
recover to arbitrary addresses for non-hashed data. A safe way to ensure
this is by receiving a hash of the original message (which may otherwise
be too long), and then calling {toEthSignedMessageHash} on it._

### recover

```solidity
function recover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address)
```

_Overload of {ECDSA-recover-bytes32-bytes-} that receives the `v`,
`r` and `s` signature fields separately._

### toEthSignedMessageHash

```solidity
function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32)
```

_Returns an Ethereum Signed Message, created from a `hash`. This
replicates the behavior of the
https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign[`eth_sign`]
JSON-RPC method.

See {recover}._

## EIP712Upgradeable

_https://eips.ethereum.org/EIPS/eip-712[EIP 712] is a standard for hashing and signing of typed structured data.

The encoding specified in the EIP is very generic, and such a generic implementation in Solidity is not feasible,
thus this contract does not implement the encoding itself. Protocols need to implement the type-specific encoding
they need in their contracts using a combination of `abi.encode` and `keccak256`.

This contract implements the EIP 712 domain separator ({_domainSeparatorV4}) that is used as part of the encoding
scheme, and the final step of the encoding to obtain the message digest that is then signed via ECDSA
({_hashTypedDataV4}).

The implementation of the domain separator was designed to be as efficient as possible while still properly updating
the chain id to protect against replay attacks on an eventual fork of the chain.

NOTE: This contract implements the version of the encoding known as "v4", as implemented by the JSON RPC method
https://docs.metamask.io/guide/signing-data.html[`eth_signTypedDataV4` in MetaMask]._

### _HASHED_NAME

```solidity
bytes32 _HASHED_NAME
```

### _HASHED_VERSION

```solidity
bytes32 _HASHED_VERSION
```

### _TYPE_HASH

```solidity
bytes32 _TYPE_HASH
```

### __EIP712_init

```solidity
function __EIP712_init(string name, string version) internal
```

_Initializes the domain separator and parameter caches.

The meaning of `name` and `version` is specified in
https://eips.ethereum.org/EIPS/eip-712#definition-of-domainseparator[EIP 712]:

- `name`: the user readable name of the signing domain, i.e. the name of the DApp or the protocol.
- `version`: the current major version of the signing domain.

NOTE: These parameters cannot be changed except through a xref:learn::upgrading-smart-contracts.adoc[smart
contract upgrade]._

### __EIP712_init_unchained

```solidity
function __EIP712_init_unchained(string name, string version) internal
```

### _domainSeparatorV4

```solidity
function _domainSeparatorV4() internal view returns (bytes32)
```

_Returns the domain separator for the current chain._

### _buildDomainSeparator

```solidity
function _buildDomainSeparator(bytes32 typeHash, bytes32 name, bytes32 version) private view returns (bytes32)
```

### _hashTypedDataV4

```solidity
function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32)
```

_Given an already https://eips.ethereum.org/EIPS/eip-712#definition-of-hashstruct[hashed struct], this
function returns the hash of the fully encoded EIP712 message for this domain.

This hash can be used together with {ECDSA-recover} to obtain the signer of a message. For example:

```solidity
bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
    keccak256("Mail(address to,string contents)"),
    mailTo,
    keccak256(bytes(mailContents))
)));
address signer = ECDSA.recover(digest, signature);
```_

### _getChainId

```solidity
function _getChainId() private view returns (uint256 chainId)
```

### _EIP712NameHash

```solidity
function _EIP712NameHash() internal view virtual returns (bytes32)
```

_The hash of the name parameter for the EIP712 domain.

NOTE: This function reads from storage by default, but can be redefined to return a constant value if gas costs
are a concern._

### _EIP712VersionHash

```solidity
function _EIP712VersionHash() internal view virtual returns (bytes32)
```

_The hash of the version parameter for the EIP712 domain.

NOTE: This function reads from storage by default, but can be redefined to return a constant value if gas costs
are a concern._

### __gap

```solidity
uint256[50] __gap
```

## ERC20PermitUpgradeable

_Implementation of the ERC20 Permit extension allowing approvals to be made via signatures, as defined in
https://eips.ethereum.org/EIPS/eip-2612[EIP-2612].

Adds the {permit} method, which can be used to change an account's ERC20 allowance (see {IERC20-allowance}) by
presenting a message signed by the account. By not relying on `{IERC20-approve}`, the token holder account doesn't
need to send a transaction, and thus is not required to hold Ether at all._

### _nonces

```solidity
mapping(address => struct CountersUpgradeable.Counter) _nonces
```

### _PERMIT_TYPEHASH

```solidity
bytes32 _PERMIT_TYPEHASH
```

### __ERC20Permit_init

```solidity
function __ERC20Permit_init(string name) internal
```

_Initializes the {EIP712} domain separator using the `name` parameter, and setting `version` to `"1"`.

It's a good idea to use the same `name` that is defined as the ERC20 token name._

### __ERC20Permit_init_unchained

```solidity
function __ERC20Permit_init_unchained(string name) internal
```

### permit

```solidity
function permit(address owner, address spender, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public virtual
```

_See {IERC20Permit-permit}._

### nonces

```solidity
function nonces(address owner) public view returns (uint256)
```

_See {IERC20Permit-nonces}._

### DOMAIN_SEPARATOR

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32)
```

_See {IERC20Permit-DOMAIN_SEPARATOR}._

### __gap

```solidity
uint256[49] __gap
```

## IERC20PermitUpgradeable

_Interface of the ERC20 Permit extension allowing approvals to be made via signatures, as defined in
https://eips.ethereum.org/EIPS/eip-2612[EIP-2612].

Adds the {permit} method, which can be used to change an account's ERC20 allowance (see {IERC20-allowance}) by
presenting a message signed by the account. By not relying on `{IERC20-approve}`, the token holder account doesn't
need to send a transaction, and thus is not required to hold Ether at all._

### permit

```solidity
function permit(address owner, address spender, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external
```

_Sets `amount` as the allowance of `spender` over `owner`'s tokens,
given `owner`'s signed approval.

IMPORTANT: The same issues {IERC20-approve} has related to transaction
ordering also apply here.

Emits an {Approval} event.

Requirements:

- `spender` cannot be the zero address.
- `deadline` must be a timestamp in the future.
- `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
over the EIP712-formatted function arguments.
- the signature must use ``owner``'s current nonce (see {nonces}).

For more information on the signature format, see the
https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
section]._

### nonces

```solidity
function nonces(address owner) external view returns (uint256)
```

_Returns the current nonce for `owner`. This value must be
included whenever a signature is generated for {permit}.

Every successful call to {permit} increases ``owner``'s nonce by one. This
prevents a signature from being used multiple times._

### DOMAIN_SEPARATOR

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32)
```

_Returns the domain separator used in the encoding of the signature for `permit`, as defined by {EIP712}._

## SafeMathUpgradeable

_Wrappers over Solidity's arithmetic operations with added overflow
checks.

Arithmetic operations in Solidity wrap on overflow. This can easily result
in bugs, because programmers usually assume that an overflow raises an
error, which is the standard behavior in high level programming languages.
`SafeMath` restores this intuition by reverting the transaction when an
operation overflows.

Using this library instead of the unchecked operations eliminates an entire
class of bugs, so it's recommended to use it always._

### add

```solidity
function add(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the addition of two unsigned integers, reverting on
overflow.

Counterpart to Solidity's `+` operator.

Requirements:

- Addition cannot overflow._

### sub

```solidity
function sub(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the subtraction of two unsigned integers, reverting on
overflow (when the result is negative).

Counterpart to Solidity's `-` operator.

Requirements:

- Subtraction cannot overflow._

### sub

```solidity
function sub(uint256 a, uint256 b, string errorMessage) internal pure returns (uint256)
```

_Returns the subtraction of two unsigned integers, reverting with custom message on
overflow (when the result is negative).

Counterpart to Solidity's `-` operator.

Requirements:

- Subtraction cannot overflow._

### mul

```solidity
function mul(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the multiplication of two unsigned integers, reverting on
overflow.

Counterpart to Solidity's `*` operator.

Requirements:

- Multiplication cannot overflow._

### div

```solidity
function div(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the integer division of two unsigned integers. Reverts on
division by zero. The result is rounded towards zero.

Counterpart to Solidity's `/` operator. Note: this function uses a
`revert` opcode (which leaves remaining gas untouched) while Solidity
uses an invalid opcode to revert (consuming all remaining gas).

Requirements:

- The divisor cannot be zero._

### div

```solidity
function div(uint256 a, uint256 b, string errorMessage) internal pure returns (uint256)
```

_Returns the integer division of two unsigned integers. Reverts with custom message on
division by zero. The result is rounded towards zero.

Counterpart to Solidity's `/` operator. Note: this function uses a
`revert` opcode (which leaves remaining gas untouched) while Solidity
uses an invalid opcode to revert (consuming all remaining gas).

Requirements:

- The divisor cannot be zero._

### mod

```solidity
function mod(uint256 a, uint256 b) internal pure returns (uint256)
```

_Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
Reverts when dividing by zero.

Counterpart to Solidity's `%` operator. This function uses a `revert`
opcode (which leaves remaining gas untouched) while Solidity uses an
invalid opcode to revert (consuming all remaining gas).

Requirements:

- The divisor cannot be zero._

### mod

```solidity
function mod(uint256 a, uint256 b, string errorMessage) internal pure returns (uint256)
```

_Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
Reverts with custom message when dividing by zero.

Counterpart to Solidity's `%` operator. This function uses a `revert`
opcode (which leaves remaining gas untouched) while Solidity uses an
invalid opcode to revert (consuming all remaining gas).

Requirements:

- The divisor cannot be zero._

## CountersUpgradeable

_Provides counters that can only be incremented or decremented by one. This can be used e.g. to track the number
of elements in a mapping, issuing ERC721 ids, or counting request ids.

Include with `using Counters for Counters.Counter;`
Since it is not possible to overflow a 256 bit integer with increments of one, `increment` can skip the {SafeMath}
overflow check, thereby saving gas. This does assume however correct usage, in that the underlying `_value` is never
directly accessed._

### Counter

```solidity
struct Counter {
  uint256 _value;
}
```

### current

```solidity
function current(struct CountersUpgradeable.Counter counter) internal view returns (uint256)
```

### increment

```solidity
function increment(struct CountersUpgradeable.Counter counter) internal
```

### decrement

```solidity
function decrement(struct CountersUpgradeable.Counter counter) internal
```

## ChainLinkPricer

A Pricer contract for one asset as reported by Chainlink

### BASE

```solidity
uint256 BASE
```

_base decimals_

### aggregatorDecimals

```solidity
uint256 aggregatorDecimals
```

chainlink response decimals

### oracle

```solidity
contract OracleInterface oracle
```

the opyn oracle address

### aggregator

```solidity
contract AggregatorInterface aggregator
```

the aggregator for an asset

### asset

```solidity
address asset
```

asset that this pricer will a get price for

### bot

```solidity
address bot
```

bot address that is allowed to call setExpiryPriceInOracle

### constructor

```solidity
constructor(address _bot, address _asset, address _aggregator, address _oracle) public
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| _bot | address | priveleged address that can call setExpiryPriceInOracle |
| _asset | address | asset that this pricer will get a price for |
| _aggregator | address | Chainlink aggregator contract for the asset |
| _oracle | address | Opyn Oracle address |

### onlyBot

```solidity
modifier onlyBot()
```

modifier to check if sender address is equal to bot address

### setExpiryPriceInOracle

```solidity
function setExpiryPriceInOracle(uint256 _expiryTimestamp, uint80 _roundId) external
```

set the expiry price in the oracle, can only be called by Bot address

_a roundId must be provided to confirm price validity, which is the first Chainlink price provided after the expiryTimestamp_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _expiryTimestamp | uint256 | expiry to set a price for |
| _roundId | uint80 | the first roundId after expiryTimestamp |

### getPrice

```solidity
function getPrice() external view returns (uint256)
```

get the live price for the asset

_overides the getPrice function in OpynPricerInterface_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of the asset in USD, scaled by 1e8 |

### getHistoricalPrice

```solidity
function getHistoricalPrice(uint80 _roundId) external view returns (uint256, uint256)
```

get historical chainlink price

| Name | Type | Description |
| ---- | ---- | ----------- |
| _roundId | uint80 | chainlink round id |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | round price and timestamp |
| [1] | uint256 |  |

### _scaleToBase

```solidity
function _scaleToBase(uint256 _price) internal view returns (uint256)
```

scale aggregator response to base decimals (1e8)

| Name | Type | Description |
| ---- | ---- | ----------- |
| _price | uint256 | aggregator price |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price scaled to 1e8 |

## CompoundPricer

A Pricer contract for a Compound cToken

### oracle

```solidity
contract OracleInterface oracle
```

opyn oracle address

### cToken

```solidity
contract CTokenInterface cToken
```

cToken that this pricer will a get price for

### underlying

```solidity
contract ERC20Interface underlying
```

underlying asset for this cToken

### constructor

```solidity
constructor(address _cToken, address _underlying, address _oracle) public
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| _cToken | address | cToken asset |
| _underlying | address | underlying asset for this cToken |
| _oracle | address | Opyn Oracle contract address |

### getPrice

```solidity
function getPrice() external view returns (uint256)
```

get the live price for the asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of 1e8 cToken in USD, scaled by 1e8 |

### setExpiryPriceInOracle

```solidity
function setExpiryPriceInOracle(uint256 _expiryTimestamp) external
```

set the expiry price in the oracle

_requires that the underlying price has been set before setting a cToken price_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _expiryTimestamp | uint256 | expiry to set a price for |

### _underlyingPriceToCtokenPrice

```solidity
function _underlyingPriceToCtokenPrice(uint256 _underlyingPrice) internal view returns (uint256)
```

_convert underlying price to cToken price with the cToken to underlying exchange rate_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlyingPrice | uint256 | price of 1 underlying token (ie 1e6 USDC, 1e18 WETH) in USD, scaled by 1e8 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of 1e8 cToken in USD, scaled by 1e8 |

## WstethPricer

A Pricer contract for a wstETH token

### oracle

```solidity
contract OracleInterface oracle
```

opyn oracle address

### wstETH

```solidity
contract WSTETHInterface wstETH
```

wstETH token

### underlying

```solidity
address underlying
```

underlying asset (WETH)

### constructor

```solidity
constructor(address _wstETH, address _underlying, address _oracle) public
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| _wstETH | address | wstETH |
| _underlying | address | underlying asset for wstETH |
| _oracle | address | Opyn Oracle contract address |

### getPrice

```solidity
function getPrice() external view returns (uint256)
```

get the live price for the asset

_overrides the getPrice function in OpynPricerInterface_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of 1 wstETH in USD, scaled by 1e8 |

### setExpiryPriceInOracle

```solidity
function setExpiryPriceInOracle(uint256 _expiryTimestamp) external
```

set the expiry price in the oracle

_requires that the underlying price has been set before setting a wstETH price_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _expiryTimestamp | uint256 | expiry to set a price for |

### _underlyingPriceToWstethPrice

```solidity
function _underlyingPriceToWstethPrice(uint256 _underlyingPrice) private view returns (uint256)
```

_convert underlying price to wstETH price with the wstETH to stETH exchange rate (1 stETH ≈ 1 ETH)_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlyingPrice | uint256 | price of 1 underlying token (ie 1e18 WETH) in USD, scaled by 1e8 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of 1 wstETH in USD, scaled by 1e8 |

### getHistoricalPrice

```solidity
function getHistoricalPrice(uint80) external view returns (uint256, uint256)
```

## YearnPricer

A Pricer contract for a Yearn yToken

### oracle

```solidity
contract OracleInterface oracle
```

opyn oracle address

### yToken

```solidity
contract YearnVaultInterface yToken
```

yToken that this pricer will a get price for

### underlying

```solidity
contract ERC20Interface underlying
```

underlying asset for this yToken

### constructor

```solidity
constructor(address _yToken, address _underlying, address _oracle) public
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| _yToken | address | yToken asset |
| _underlying | address | underlying asset for this yToken |
| _oracle | address | Opyn Oracle contract address |

### getPrice

```solidity
function getPrice() external view returns (uint256)
```

get the live price for the asset

_overrides the getPrice function in OpynPricerInterface_

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of 1e8 yToken in USD, scaled by 1e8 |

### setExpiryPriceInOracle

```solidity
function setExpiryPriceInOracle(uint256 _expiryTimestamp) external
```

set the expiry price in the oracle

_requires that the underlying price has been set before setting a yToken price_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _expiryTimestamp | uint256 | expiry to set a price for |

### _underlyingPriceToYtokenPrice

```solidity
function _underlyingPriceToYtokenPrice(uint256 _underlyingPrice) private view returns (uint256)
```

_convert underlying price to yToken price with the yToken to underlying exchange rate_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlyingPrice | uint256 | price of 1 underlying token (ie 1e6 USDC, 1e18 WETH) in USD, scaled by 1e8 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | price of 1e8 yToken in USD, scaled by 1e8 |

### getHistoricalPrice

```solidity
function getHistoricalPrice(uint80 _roundId) external view returns (uint256, uint256)
```

## AlphaOptionHandler

@title Contract used for all user facing options interactions
 @dev Interacts with liquidityPool to write options and quote their prices.

### liquidityPool

```solidity
contract ILiquidityPool liquidityPool
```

immutable variables ///

### protocol

```solidity
contract Protocol protocol
```

### strikeAsset

```solidity
address strikeAsset
```

### underlyingAsset

```solidity
address underlyingAsset
```

### collateralAsset

```solidity
address collateralAsset
```

### orderIdCounter

```solidity
uint256 orderIdCounter
```

dynamic variables ///

### orderStores

```solidity
mapping(uint256 => struct Types.Order) orderStores
```

### customOrderBounds

```solidity
struct AlphaOptionHandler.CustomOrderBounds customOrderBounds
```

governance settable variables ///

### MAX_BPS

```solidity
uint256 MAX_BPS
```

constant variables ///

### maxOrderExpiry

```solidity
uint256 maxOrderExpiry
```

### CustomOrderBounds

```solidity
struct CustomOrderBounds {
  uint128 callMinDelta;
  uint128 callMaxDelta;
  int128 putMinDelta;
  int128 putMaxDelta;
  uint256 maxPriceRange;
}
```

### OrderCreated

```solidity
event OrderCreated(uint256 orderId)
```

### OrderExecuted

```solidity
event OrderExecuted(uint256 orderId)
```

### constructor

```solidity
constructor(address _authority, address _protocol, address _liquidityPool) public
```

### setCustomOrderBounds

```solidity
function setCustomOrderBounds(uint128 _callMinDelta, uint128 _callMaxDelta, int128 _putMinDelta, int128 _putMaxDelta, uint32 _maxPriceRange) external
```

set new custom order parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callMinDelta | uint128 | the minimum delta value a sold custom call option can have (e18 format - for 0.05 enter 5e16). Must be positive or 0. |
| _callMaxDelta | uint128 | the maximum delta value a sold custom call option can have. Must be positive and have greater magnitude than _callMinDelta. |
| _putMinDelta | int128 | the minimum delta value a sold custom put option can have. Must be negative and have greater magnitude than _putMaxDelta |
| _putMaxDelta | int128 | the maximum delta value a sold custom put option can have. Must be negative or 0. |
| _maxPriceRange | uint32 | the max percentage below the LP calculated premium that the order may be sold for. Measured in BPS - for 10% enter 1000 |

### createOrder

```solidity
function createOrder(struct Types.OptionSeries _optionSeries, uint256 _amount, uint256 _price, uint256 _orderExpiry, address _buyerAddress, bool _isBuyBack, uint256[2] _spotMovementRange) public returns (uint256)
```

creates an order for a number of options from the pool to a specified user. The function
     is intended to be used to issue options to market makers/ OTC market participants
     in order to have flexibility and customisability on option issuance and market
     participant UX.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _optionSeries | struct Types.OptionSeries | the option token series to issue - strike in e18 |
| _amount | uint256 | the number of options to issue - e18 |
| _price | uint256 | the price per unit to issue at - in e18 |
| _orderExpiry | uint256 | the expiry of the custom order, after which the         buyer cannot use this order (if past the order is redundant) |
| _buyerAddress | address | the agreed upon buyer address |
| _isBuyBack | bool | whether the order being created is buy back |
| _spotMovementRange | uint256[2] | min and max amount that the spot price can move during the order |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | orderId the unique id of the order |

### createStrangle

```solidity
function createStrangle(struct Types.OptionSeries _optionSeriesCall, struct Types.OptionSeries _optionSeriesPut, uint256 _amountCall, uint256 _amountPut, uint256 _priceCall, uint256 _pricePut, uint256 _orderExpiry, address _buyerAddress, uint256[2] _callSpotMovementRange, uint256[2] _putSpotMovementRange) external returns (uint256, uint256)
```

creates a strangle order. One custom put and one custom call order to be executed simultaneously.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _optionSeriesCall | struct Types.OptionSeries | the option token series to issue for the call part of the strangle - strike in e18 |
| _optionSeriesPut | struct Types.OptionSeries | the option token series to issue for the put part of the strangle - strike in e18 |
| _amountCall | uint256 | the number of call options to issue |
| _amountPut | uint256 | the number of put options to issue |
| _priceCall | uint256 | the price per unit to issue calls at |
| _pricePut | uint256 | the price per unit to issue puts at |
| _orderExpiry | uint256 | the expiry of the order (if past the order is redundant) |
| _buyerAddress | address | the agreed upon buyer address |
| _callSpotMovementRange | uint256[2] | min and max amount that the spot price can move during the order for the call |
| _putSpotMovementRange | uint256[2] | min and max amount that the spot price can move during the order for the call |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | putOrderId the unique id of the put part of the strangle |
| [1] | uint256 | callOrderId the unique id of the call part of the strangle |

### executeOrder

```solidity
function executeOrder(uint256 _orderId) public
```

fulfills an order for a number of options from the pool to a specified user. The function
     is intended to be used to issue options to market makers/ OTC market participants
     in order to have flexibility and customisability on option issuance and market
     participant UX.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _orderId | uint256 | the id of the order for options purchase |

### executeBuyBackOrder

```solidity
function executeBuyBackOrder(uint256 _orderId) public
```

fulfills a buyback order for a number of options from the pool to a specified user. The function
     is intended to be used to issue options to market makers/ OTC market participants
     in order to have flexibility and customisability on option issuance and market
     participant UX.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _orderId | uint256 | the id of the order for options purchase |

### executeStrangle

```solidity
function executeStrangle(uint256 _orderId1, uint256 _orderId2) external
```

fulfills a stored strangle order consisting of a stores call and a stored put.
This is intended to be called by market makers/OTC market participants.

### getOptionRegistry

```solidity
function getOptionRegistry() internal view returns (contract IOptionRegistry)
```

get the option registry used for storing and managing the options

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IOptionRegistry | the option registry contract |

### getPortfolioValuesFeed

```solidity
function getPortfolioValuesFeed() internal view returns (contract IPortfolioValuesFeed)
```

get the portfolio values feed used by the liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IPortfolioValuesFeed | the portfolio values feed contract |

### _getUnderlyingPrice

```solidity
function _getUnderlyingPrice(address underlying, address _strikeAsset) internal view returns (uint256)
```

get the underlying price with just the underlying asset and strike asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | the asset that is used as the reference asset |
| _strikeAsset | address | the asset that the underlying value is denominated in |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the underlying price |

## AlphaPortfolioValuesFeed

Options portfolio storage and calculations

### OptionStores

```solidity
struct OptionStores {
  struct Types.OptionSeries optionSeries;
  int256 shortExposure;
  int256 longExposure;
}
```

### oTokenDecimals

```solidity
uint256 oTokenDecimals
```

immutable variables ///

### storesForAddress

```solidity
mapping(address => struct AlphaPortfolioValuesFeed.OptionStores) storesForAddress
```

dynamic variables ///

### addressSet

```solidity
struct EnumerableSet.AddressSet addressSet
```

### portfolioValues

```solidity
mapping(address => mapping(address => struct Types.PortfolioValues)) portfolioValues
```

### protocol

```solidity
contract Protocol protocol
```

govern settable variables ///

### liquidityPool

```solidity
contract ILiquidityPool liquidityPool
```

### handler

```solidity
mapping(address => bool) handler
```

### keeper

```solidity
mapping(address => bool) keeper
```

### rfr

```solidity
uint256 rfr
```

### DataFullfilled

```solidity
event DataFullfilled(address underlying, address strike, int256 delta, int256 gamma, int256 vega, int256 theta, int256 callPutsValue)
```

events ///

### RequestedUpdate

```solidity
event RequestedUpdate(address _underlying, address _strike)
```

### StoresUpdated

```solidity
event StoresUpdated(address seriesAddress, int256 shortExposure, int256 longExposure, struct Types.OptionSeries optionSeries)
```

### OptionHasExpiredInStores

```solidity
error OptionHasExpiredInStores(uint256 index, address seriesAddress)
```

### NoVaultForShortPositions

```solidity
error NoVaultForShortPositions()
```

### IncorrectSeriesToRemove

```solidity
error IncorrectSeriesToRemove()
```

### SeriesNotExpired

```solidity
error SeriesNotExpired()
```

### NoShortPositions

```solidity
error NoShortPositions()
```

### constructor

```solidity
constructor(address _authority) public
```

Executes once when a contract is created to initialize state variables
	   Make sure the protocol is configured after deployment

### setLiquidityPool

```solidity
function setLiquidityPool(address _liquidityPool) external
```

setters ///

### setProtocol

```solidity
function setProtocol(address _protocol) external
```

### setRFR

```solidity
function setRFR(uint256 _rfr) external
```

### setKeeper

```solidity
function setKeeper(address _keeper, bool _auth) external
```

change the status of a keeper

### setHandler

```solidity
function setHandler(address _handler, bool _auth) external
```

change the status of a handler

### fulfill

```solidity
function fulfill(address _underlying, address _strikeAsset) external
```

Fulfills the portfolio delta and portfolio value by doing a for loop over the stores.  This is then used to
        update the portfolio values for external contracts to know what the liquidity pool's value is
	   1/ Make sure any expired options are settled, otherwise this fulfillment will fail
	   2/ Once the addressSet is cleared of any

| Name | Type | Description |
| ---- | ---- | ----------- |
| _underlying | address | - response; underlying address |
| _strikeAsset | address | - response; strike address |

### updateStores

```solidity
function updateStores(struct Types.OptionSeries _optionSeries, int256 shortExposure, int256 longExposure, address _seriesAddress) external
```

Updates the option series stores to be used for portfolio value calculation

_callable by the handler and also during migration_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _optionSeries | struct Types.OptionSeries | the option series that was created, strike in e18 |
| shortExposure | int256 | the amount of short to increment the short exposure by |
| longExposure | int256 | the amount of long to increment the long exposure by |
| _seriesAddress | address | the address of the series represented by the oToken |

### addyList

```solidity
address[] addyList
```

LOOP CLEANING - FOR ALPHA
  This is necessary to reduce the size of the foor loop when its not necessary to.
  - Make sure the option has been settled!

### syncLooper

```solidity
function syncLooper() external
```

function to clean all expired series from the options storage to remove them from the looped array.

_FOLLOW THE LOOP CLEANING INSTRUCTIONS ABOVE WHEN CALLING THIS FUNCTION_

### cleanLooperManually

```solidity
function cleanLooperManually(address _series) external
```

function to clean an expired series from the portfolio values feed, this function will make sure the series and index match
		and will also check if the series has expired before any cleaning happens.

_FOLLOW THE LOOP CLEANING INSTRUCTIONS ABOVE WHEN CALLING THIS FUNCTION_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the series at the index input above |

### _cleanLooper

```solidity
function _cleanLooper(address _series) internal
```

internal function for removing an address from the address set and clearing all option stores for that series

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the option series address to be cleared |

### accountLiquidatedSeries

```solidity
function accountLiquidatedSeries(address _series) external
```

if a vault has been liquidated we need to account for it, so adjust our short positions to reality

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the option series address to be cleared |

### migrate

```solidity
function migrate(contract IPortfolioValuesFeed _migrateContract) external
```

migrate all stored options data to a new contract that has the IPortfolioValuesFeed interface

_FOLLOW THE MIGRATION PROCESS INSTRUCTIONS WHEN CALLING THIS FUNCTION_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _migrateContract | contract IPortfolioValuesFeed | the new portfolio values feed contract to migrate option values too |

### requestPortfolioData

```solidity
function requestPortfolioData(address _underlying, address _strike) external returns (bytes32 id)
```

requests a portfolio data update

### getPortfolioValues

```solidity
function getPortfolioValues(address underlying, address strike) external view returns (struct Types.PortfolioValues)
```

non-complex getters ///

### _isKeeper

```solidity
function _isKeeper() internal view
```

_keepers, managers or governors can access_

### _isHandler

```solidity
function _isHandler() internal view
```

_handlers can access_

### isAddressInSet

```solidity
function isAddressInSet(address _a) external view returns (bool)
```

get the address set details

### addressAtIndexInSet

```solidity
function addressAtIndexInSet(uint256 _i) external view returns (address)
```

### addressSetLength

```solidity
function addressSetLength() external view returns (uint256)
```

### getAddressSet

```solidity
function getAddressSet() external view returns (address[])
```

### _getVolatilityFeed

```solidity
function _getVolatilityFeed() internal view returns (contract VolatilityFeed)
```

get the volatility feed used by the liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract VolatilityFeed | the volatility feed contract interface |

### _getOptionRegistry

```solidity
function _getOptionRegistry() internal view returns (contract IOptionRegistry)
```

get the option registry used for storing and managing the options

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IOptionRegistry | the option registry contract |

### _getUnderlyingPrice

```solidity
function _getUnderlyingPrice(address underlying, address _strikeAsset) internal view returns (uint256)
```

get the underlying price with just the underlying asset and strike asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | the asset that is used as the reference asset |
| _strikeAsset | address | the asset that the underlying value is denominated in |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the underlying price |

## LiquidityPool

@title Contract used as the Dynamic Hedging Vault for storing funds, issuing shares and processing options transactions
 @dev Interacts with the OptionRegistry for options behaviour, Interacts with hedging reactors for alternative derivatives
      Interacts with Handlers for periphary user options interactions. Interacts with Chainlink price feeds throughout.
      Interacts with Volatility Feed via getImpliedVolatility(), interacts with a chainlink PortfolioValues external adaptor
      oracle via PortfolioValuesFeed.

### protocol

```solidity
contract Protocol protocol
```

immutable variables ///

### strikeAsset

```solidity
address strikeAsset
```

### underlyingAsset

```solidity
address underlyingAsset
```

### collateralAsset

```solidity
address collateralAsset
```

### collateralAllocated

```solidity
uint256 collateralAllocated
```

dynamic variables ///

### ephemeralLiabilities

```solidity
int256 ephemeralLiabilities
```

### ephemeralDelta

```solidity
int256 ephemeralDelta
```

### depositEpoch

```solidity
uint256 depositEpoch
```

### withdrawalEpoch

```solidity
uint256 withdrawalEpoch
```

### depositEpochPricePerShare

```solidity
mapping(uint256 => uint256) depositEpochPricePerShare
```

### withdrawalEpochPricePerShare

```solidity
mapping(uint256 => uint256) withdrawalEpochPricePerShare
```

### depositReceipts

```solidity
mapping(address => struct IAccounting.DepositReceipt) depositReceipts
```

### withdrawalReceipts

```solidity
mapping(address => struct IAccounting.WithdrawalReceipt) withdrawalReceipts
```

### pendingDeposits

```solidity
uint256 pendingDeposits
```

### pendingWithdrawals

```solidity
uint256 pendingWithdrawals
```

### partitionedFunds

```solidity
uint256 partitionedFunds
```

### bufferPercentage

```solidity
uint256 bufferPercentage
```

governance settable variables ///

### hedgingReactors

```solidity
address[] hedgingReactors
```

### collateralCap

```solidity
uint256 collateralCap
```

### maxDiscount

```solidity
uint256 maxDiscount
```

### bidAskIVSpread

```solidity
uint256 bidAskIVSpread
```

### optionParams

```solidity
struct Types.OptionParams optionParams
```

### riskFreeRate

```solidity
uint256 riskFreeRate
```

### handler

```solidity
mapping(address => bool) handler
```

### isTradingPaused

```solidity
bool isTradingPaused
```

### maxTimeDeviationThreshold

```solidity
uint256 maxTimeDeviationThreshold
```

### maxPriceDeviationThreshold

```solidity
uint256 maxPriceDeviationThreshold
```

### belowThresholdGradient

```solidity
uint256 belowThresholdGradient
```

### aboveThresholdGradient

```solidity
uint256 aboveThresholdGradient
```

### aboveThresholdYIntercept

```solidity
uint256 aboveThresholdYIntercept
```

### utilizationFunctionThreshold

```solidity
uint256 utilizationFunctionThreshold
```

### keeper

```solidity
mapping(address => bool) keeper
```

### MAX_BPS

```solidity
uint256 MAX_BPS
```

constant variables ///

### DepositEpochExecuted

```solidity
event DepositEpochExecuted(uint256 epoch)
```

structs && events ///

### WithdrawalEpochExecuted

```solidity
event WithdrawalEpochExecuted(uint256 epoch)
```

### Withdraw

```solidity
event Withdraw(address recipient, uint256 amount, uint256 shares)
```

### Deposit

```solidity
event Deposit(address recipient, uint256 amount, uint256 epoch)
```

### Redeem

```solidity
event Redeem(address recipient, uint256 amount, uint256 epoch)
```

### InitiateWithdraw

```solidity
event InitiateWithdraw(address recipient, uint256 amount, uint256 epoch)
```

### WriteOption

```solidity
event WriteOption(address series, uint256 amount, uint256 premium, uint256 escrow, address buyer)
```

### SettleVault

```solidity
event SettleVault(address series, uint256 collateralReturned, uint256 collateralLost, address closer)
```

### BuybackOption

```solidity
event BuybackOption(address series, uint256 amount, uint256 premium, uint256 escrowReturned, address seller)
```

### constructor

```solidity
constructor(address _protocol, address _strikeAsset, address _underlyingAsset, address _collateralAsset, uint256 rfr, string name, string symbol, struct Types.OptionParams _optionParams, address _authority) public
```

### pause

```solidity
function pause() external
```

setters ///

### pauseUnpauseTrading

```solidity
function pauseUnpauseTrading(bool _pause) external
```

### unpause

```solidity
function unpause() external
```

### setHedgingReactorAddress

```solidity
function setHedgingReactorAddress(address _reactorAddress) external
```

set a new hedging reactor

_only governance can call this function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _reactorAddress | address | append a new hedging reactor |

### removeHedgingReactorAddress

```solidity
function removeHedgingReactorAddress(uint256 _index, bool _override) external
```

remove a new hedging reactor by index

_only governance can call this function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _index | uint256 | remove a hedging reactor |
| _override | bool | whether to override whether the reactor is wound down  	 		 			(THE REACTOR SHOULD BE WOUND DOWN SEPERATELY) |

### setNewOptionParams

```solidity
function setNewOptionParams(uint128 _newMinCallStrike, uint128 _newMaxCallStrike, uint128 _newMinPutStrike, uint128 _newMaxPutStrike, uint128 _newMinExpiry, uint128 _newMaxExpiry) external
```

update all optionParam variables for max and min strikes and max and
        min expiries for options that the DHV can issue

_only management or above can call this function_

### setBidAskSpread

```solidity
function setBidAskSpread(uint256 _bidAskSpread) external
```

set the bid ask spread used to price option buying

_only management or above can call this function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _bidAskSpread | uint256 | the bid ask spread to update to |

### setMaxDiscount

```solidity
function setMaxDiscount(uint256 _maxDiscount) external
```

set the maximum percentage discount for an option

_only management or above can call this function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _maxDiscount | uint256 | of the option as a percentage in 1e18 format. ie: 1*e18 == 1% |

### setCollateralCap

```solidity
function setCollateralCap(uint256 _collateralCap) external
```

set the maximum collateral amount allowed in the pool

_only governance can call this function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateralCap | uint256 | of the collateral held |

### setBufferPercentage

```solidity
function setBufferPercentage(uint256 _bufferPercentage) external
```

update the liquidity pool buffer limit

_only governance can call this function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _bufferPercentage | uint256 | the minimum balance the liquidity pool must have as a percentage of collateral allocated to options. (for 20% enter 2000) |

### setRiskFreeRate

```solidity
function setRiskFreeRate(uint256 _riskFreeRate) external
```

update the liquidity pool risk free rate

| Name | Type | Description |
| ---- | ---- | ----------- |
| _riskFreeRate | uint256 | the risk free rate of the market |

### setMaxTimeDeviationThreshold

```solidity
function setMaxTimeDeviationThreshold(uint256 _maxTimeDeviationThreshold) external
```

update the max oracle time deviation threshold

### setMaxPriceDeviationThreshold

```solidity
function setMaxPriceDeviationThreshold(uint256 _maxPriceDeviationThreshold) external
```

update the max oracle price deviation threshold

### changeHandler

```solidity
function changeHandler(address _handler, bool auth) external
```

change the status of a handler

### setKeeper

```solidity
function setKeeper(address _keeper, bool _auth) external
```

change the status of a keeper

### setUtilizationSkewParams

```solidity
function setUtilizationSkewParams(uint256 _belowThresholdGradient, uint256 _aboveThresholdGradient, uint256 _utilizationFunctionThreshold) external
```

@notice sets the parameters for the function that determines the utilization price factor
 The function is made up of two parts, both linear. The line to the left of the utilisation threshold has a low gradient
 while the gradient to the right of the threshold is much steeper. The aim of this function is to make options much more
 expensive near full utilization while not having much effect at low utilizations.
 @param _belowThresholdGradient the gradient of the function where utiization is below function threshold. e18
 @param _aboveThresholdGradient the gradient of the line above the utilization threshold. e18
 @param _utilizationFunctionThreshold the percentage utilization above which the function moves from its shallow line to its steep line

### rebalancePortfolioDelta

```solidity
function rebalancePortfolioDelta(int256 delta, uint256 reactorIndex) external
```

function for hedging portfolio delta through external means

| Name | Type | Description |
| ---- | ---- | ----------- |
| delta | int256 | the current portfolio delta |
| reactorIndex | uint256 | the index of the reactor in the hedgingReactors array to use |

### adjustCollateral

```solidity
function adjustCollateral(uint256 lpCollateralDifference, bool addToLpBalance) external
```

adjust the collateral held in a specific vault because of health

_called by the option registry only_

| Name | Type | Description |
| ---- | ---- | ----------- |
| lpCollateralDifference | uint256 | amount of collateral taken from or given to the liquidity pool in collateral decimals |
| addToLpBalance | bool | true if collateral is returned to liquidity pool, false if collateral is withdrawn from liquidity pool |

### settleVault

```solidity
function settleVault(address seriesAddress) external returns (uint256)
```

closes an oToken vault, returning collateral (minus ITM option expiry value) back to the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| seriesAddress | address | the address of the oToken vault to close |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | collatReturned the amount of collateral returned to the liquidity pool, assumes in collateral decimals |

### handlerIssue

```solidity
function handlerIssue(struct Types.OptionSeries optionSeries) external returns (address)
```

issue an option

_only callable by a handler contract_

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | the series detail of the option - strike decimals in e18 |

### handlerWriteOption

```solidity
function handlerWriteOption(struct Types.OptionSeries optionSeries, address seriesAddress, uint256 amount, contract IOptionRegistry optionRegistry, uint256 premium, int256 delta, address recipient) external returns (uint256)
```

write an option that already exists

_only callable by a handler contract_

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | the series detail of the option - strike decimals in e8 |
| seriesAddress | address | the series address of the oToken |
| amount | uint256 | the number of options to write - in e18 |
| optionRegistry | contract IOptionRegistry | the registry used for options writing |
| premium | uint256 | the premium of the option - in collateral decimals |
| delta | int256 | the delta of the option - in e18 |
| recipient | address | the receiver of the option |

### handlerIssueAndWriteOption

```solidity
function handlerIssueAndWriteOption(struct Types.OptionSeries optionSeries, uint256 amount, uint256 premium, int256 delta, address recipient) external returns (uint256, address)
```

write an option that doesnt exist

_only callable by a handler contract_

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | the series detail of the option - strike decimals in e18 |
| amount | uint256 | the number of options to write - in e18 |
| premium | uint256 | the premium of the option - in collateral decimals |
| delta | int256 | the delta of the option - in e18 |
| recipient | address | the receiver of the option |

### handlerBuybackOption

```solidity
function handlerBuybackOption(struct Types.OptionSeries optionSeries, uint256 amount, contract IOptionRegistry optionRegistry, address seriesAddress, uint256 premium, int256 delta, address seller) external returns (uint256)
```

buy back an option that already exists

_only callable by a handler contract_

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | the series detail of the option - strike decimals in e8 |
| amount | uint256 | the number of options to buyback - in e18 |
| optionRegistry | contract IOptionRegistry | the registry used for options writing |
| seriesAddress | address | the series address of the oToken |
| premium | uint256 | the premium of the option - in collateral decimals |
| delta | int256 | the delta of the option - in e18 |
| seller | address | the receiver of the option |

### resetEphemeralValues

```solidity
function resetEphemeralValues() external
```

reset the temporary portfolio and delta values that have been changed since the last oracle update

_only callable by the portfolio values feed oracle contract_

### pauseTradingAndRequest

```solidity
function pauseTradingAndRequest() external returns (bytes32)
```

reset the temporary portfolio and delta values that have been changed since the last oracle update

_this function must be called in order to execute an epoch calculation_

### executeEpochCalculation

```solidity
function executeEpochCalculation() external
```

execute the epoch and set all the price per shares

_this function must be called in order to execute an epoch calculation and batch a mutual fund epoch_

### deposit

```solidity
function deposit(uint256 _amount) external returns (bool)
```

function for adding liquidity to the options liquidity pool

_entry point to provide liquidity to dynamic hedging vault_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | amount of the strike asset to deposit |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | success |

### redeem

```solidity
function redeem(uint256 _shares) external returns (uint256)
```

function for allowing a user to redeem their shares from a previous epoch

| Name | Type | Description |
| ---- | ---- | ----------- |
| _shares | uint256 | the number of shares to redeem |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the number of shares actually returned |

### initiateWithdraw

```solidity
function initiateWithdraw(uint256 _shares) external
```

function for initiating a withdraw request from the pool

_entry point to remove liquidity to dynamic hedging vault_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _shares | uint256 | amount of shares to return |

### completeWithdraw

```solidity
function completeWithdraw(uint256 _shares) external returns (uint256)
```

function for completing the withdraw from a pool

_entry point to remove liquidity to dynamic hedging vault_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _shares | uint256 | amount of shares to return |

### _getNormalizedBalance

```solidity
function _getNormalizedBalance(address asset) internal view returns (uint256 normalizedBalance)
```

Returning balance in 1e18 format

| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | address | address of the asset to get balance and normalize |

| Name | Type | Description |
| ---- | ---- | ----------- |
| normalizedBalance | uint256 | balance in 1e18 format |

### getBalance

```solidity
function getBalance(address asset) public view returns (uint256)
```

Returning balance in 1e6 format

| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | address | address of the asset to get balance |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | balance of the address accounting for partitionedFunds |

### getExternalDelta

```solidity
function getExternalDelta() public view returns (int256 externalDelta)
```

get the delta of the hedging reactors

| Name | Type | Description |
| ---- | ---- | ----------- |
| externalDelta | int256 | hedging reactor delta in e18 format |

### getPortfolioDelta

```solidity
function getPortfolioDelta() public view returns (int256)
```

get the delta of the portfolio

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 | portfolio delta |

### quotePriceWithUtilizationGreeks

```solidity
function quotePriceWithUtilizationGreeks(struct Types.OptionSeries optionSeries, uint256 amount, bool toBuy) external view returns (uint256 quote, int256 delta)
```

get the quote price and delta for a given option

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | option type to quote - strike assumed in e18 |
| amount | uint256 | the number of options to mint  - assumed in e18 |
| toBuy | bool | whether the protocol is buying the option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| quote | uint256 | the price of the options - returns in e18 |
| delta | int256 | the delta of the options - returns in e18 |

### addUtilizationPremium

```solidity
function addUtilizationPremium(struct Types.UtilizationState quoteState, struct Types.OptionSeries optionSeries, uint256 amount, bool toBuy) internal view
```

applies a utilization premium when the protocol is selling options.
Stores the utilization price in quoteState.utilizationPrice for use in quotePriceWithUtilizationGreeks

| Name | Type | Description |
| ---- | ---- | ----------- |
| quoteState | struct Types.UtilizationState | the struct created in quoteStateWithUtilizationGreeks to store memory variables |
| optionSeries | struct Types.OptionSeries | the option type for which we are quoting a price |
| amount | uint256 | the amount of options. e18 |
| toBuy | bool | whether we are buying an option. False if selling |

### applyDeltaPremium

```solidity
function applyDeltaPremium(struct Types.UtilizationState quoteState, bool toBuy) internal view returns (uint256 quote)
```

Applies a discount or premium based on the liquidity pool's delta exposure
Gives discount if the transaction results in a lower delta exposure for the liquidity pool.
Prices option more richly if the transaction results in higher delta exposure for liquidity pool.

| Name | Type | Description |
| ---- | ---- | ----------- |
| quoteState | struct Types.UtilizationState | the struct created in quoteStateWithUtilizationGreeks to store memory variables |
| toBuy | bool | whether we are buying an option. False if selling |

| Name | Type | Description |
| ---- | ---- | ----------- |
| quote | uint256 | the quote for the option with the delta skew applied |

### getImpliedVolatility

```solidity
function getImpliedVolatility(bool isPut, uint256 underlyingPrice, uint256 strikePrice, uint256 expiration) public view returns (uint256)
```

get the current implied volatility from the feed

| Name | Type | Description |
| ---- | ---- | ----------- |
| isPut | bool | Is the option a call or put? |
| underlyingPrice | uint256 | The underlying price - assumed in e18 |
| strikePrice | uint256 | The strike price of the option - assumed in e18 |
| expiration | uint256 | expiration timestamp of option as a PRBMath Float |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Implied volatility adjusted for volatility surface - assumed in e18 |

### getAssets

```solidity
function getAssets() external view returns (uint256)
```

### getNAV

```solidity
function getNAV() external view returns (uint256)
```

### _redeem

```solidity
function _redeem(uint256 _shares) internal returns (uint256)
```

functionality for allowing a user to redeem their shares from a previous epoch

| Name | Type | Description |
| ---- | ---- | ----------- |
| _shares | uint256 | the number of shares to redeem |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | toRedeem the number of shares actually returned |

### _getNAV

```solidity
function _getNAV() internal view returns (uint256)
```

get the Net Asset Value

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Net Asset Value in e18 decimal format |

### _getAssets

```solidity
function _getAssets() internal view returns (uint256 assets)
```

get the Asset Value

| Name | Type | Description |
| ---- | ---- | ----------- |
| assets | uint256 | Asset Value in e18 decimal format |

### _getLiabilities

```solidity
function _getLiabilities() internal view returns (int256 liabilities)
```

### checkBuffer

```solidity
function checkBuffer() public view returns (uint256 bufferRemaining)
```

calculates amount of liquidity that can be used before hitting buffer

| Name | Type | Description |
| ---- | ---- | ----------- |
| bufferRemaining | uint256 | the amount of liquidity available before reaching buffer in e6 |

### _issue

```solidity
function _issue(struct Types.OptionSeries optionSeries, contract IOptionRegistry optionRegistry) internal returns (address series)
```

create the option contract in the options registry

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | option type to mint - option series strike in e18 |
| optionRegistry | contract IOptionRegistry | interface for the options issuer |

| Name | Type | Description |
| ---- | ---- | ----------- |
| series | address | the address of the option series minted |

### _writeOption

```solidity
function _writeOption(struct Types.OptionSeries optionSeries, address seriesAddress, uint256 amount, contract IOptionRegistry optionRegistry, uint256 premium, int256 delta, uint256 bufferRemaining, address recipient) internal returns (uint256)
```

write a number of options for a given OptionSeries

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | option type to mint - strike in e8 |
| seriesAddress | address | the address of the options series |
| amount | uint256 | the amount to be written - in e18 |
| optionRegistry | contract IOptionRegistry | the option registry of the pool |
| premium | uint256 | the premium to charge the user - in collateral decimals |
| delta | int256 | the delta of the option position - in e18 |
| bufferRemaining | uint256 | the amount of buffer that can be used - in e6 |
| recipient | address |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the amount that was written |

### _buybackOption

```solidity
function _buybackOption(struct Types.OptionSeries optionSeries, uint256 amount, contract IOptionRegistry optionRegistry, address seriesAddress, uint256 premium, int256 delta, address seller) internal returns (uint256)
```

buys a number of options back and burns the tokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | the option token series to buyback - strike passed in as e8 |
| amount | uint256 | the number of options to buyback expressed in 1e18 |
| optionRegistry | contract IOptionRegistry | the registry |
| seriesAddress | address | the series being sold |
| premium | uint256 | the premium to be sent back to the owner (in collat decimals) |
| delta | int256 | the delta of the option |
| seller | address | the address |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the number of options burned in e18 |

### _adjustVariables

```solidity
function _adjustVariables(uint256 collateralAmount, uint256 optionsValue, int256 delta, bool isSale) internal
```

adjust the variables of the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| collateralAmount | uint256 | the amount of collateral transferred to change on collateral allocated in collateral decimals |
| optionsValue | uint256 | the value of the options in e18 decimals |
| delta | int256 | the delta of the options in e18 decimals |
| isSale | bool | whether the action was an option sale or not |

### _getVolatilityFeed

```solidity
function _getVolatilityFeed() internal view returns (contract VolatilityFeed)
```

get the volatility feed used by the liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract VolatilityFeed | the volatility feed contract interface |

### _getPortfolioValuesFeed

```solidity
function _getPortfolioValuesFeed() internal view returns (contract IPortfolioValuesFeed)
```

get the portfolio values feed used by the liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IPortfolioValuesFeed | the portfolio values feed contract |

### _getAccounting

```solidity
function _getAccounting() internal view returns (contract IAccounting)
```

get the DHV accounting calculations contract used by the liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAccounting | the Accounting contract |

### _getOptionRegistry

```solidity
function _getOptionRegistry() internal view returns (contract IOptionRegistry)
```

get the option registry used for storing and managing the options

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IOptionRegistry | the option registry contract |

### _getUnderlyingPrice

```solidity
function _getUnderlyingPrice(address underlying, address _strikeAsset) internal view returns (uint256)
```

get the underlying price with just the underlying asset and strike asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | the asset that is used as the reference asset |
| _strikeAsset | address | the asset that the underlying value is denominated in |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the underlying price |

### _isTradingNotPaused

```solidity
function _isTradingNotPaused() internal view
```

### _isHandler

```solidity
function _isHandler() internal view
```

### _isKeeper

```solidity
function _isKeeper() internal view
```

_keepers, managers or governors can access_

## OptionHandler

@title Contract used for all user facing options interactions
 @dev Interacts with liquidityPool to write options and quote their prices.

### liquidityPool

```solidity
contract ILiquidityPool liquidityPool
```

immutable variables ///

### protocol

```solidity
contract Protocol protocol
```

### strikeAsset

```solidity
address strikeAsset
```

### underlyingAsset

```solidity
address underlyingAsset
```

### collateralAsset

```solidity
address collateralAsset
```

### orderIdCounter

```solidity
uint256 orderIdCounter
```

dynamic variables ///

### orderStores

```solidity
mapping(uint256 => struct Types.Order) orderStores
```

### customOrderBounds

```solidity
struct OptionHandler.CustomOrderBounds customOrderBounds
```

governance settable variables ///

### buybackWhitelist

```solidity
mapping(address => bool) buybackWhitelist
```

### minDeltaForRequest

```solidity
uint256 minDeltaForRequest
```

### MAX_BPS

```solidity
uint256 MAX_BPS
```

constant variables ///

### maxOrderExpiry

```solidity
uint256 maxOrderExpiry
```

### CustomOrderBounds

```solidity
struct CustomOrderBounds {
  uint128 callMinDelta;
  uint128 callMaxDelta;
  int128 putMinDelta;
  int128 putMaxDelta;
  uint32 maxPriceRange;
}
```

### OrderCreated

```solidity
event OrderCreated(uint256 orderId)
```

### OrderExecuted

```solidity
event OrderExecuted(uint256 orderId)
```

### constructor

```solidity
constructor(address _authority, address _protocol, address _liquidityPool) public
```

### setCustomOrderBounds

```solidity
function setCustomOrderBounds(uint128 _callMinDelta, uint128 _callMaxDelta, int128 _putMinDelta, int128 _putMaxDelta, uint32 _maxPriceRange) external
```

set new custom order parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _callMinDelta | uint128 | the minimum delta value a sold custom call option can have (e18 format - for 0.05 enter 5e16). Must be positive or 0. |
| _callMaxDelta | uint128 | the maximum delta value a sold custom call option can have. Must be positive and have greater magnitude than _callMinDelta. |
| _putMinDelta | int128 | the minimum delta value a sold custom put option can have. Must be negative and have greater magnitude than _putMaxDelta |
| _putMaxDelta | int128 | the maximum delta value a sold custom put option can have. Must be negative or 0. |
| _maxPriceRange | uint32 | the max percentage below the LP calculated premium that the order may be sold for. Measured in BPS - for 10% enter 1000 |

### pause

```solidity
function pause() external
```

### unpause

```solidity
function unpause() external
```

### addOrRemoveBuybackAddress

```solidity
function addOrRemoveBuybackAddress(address _addressToWhitelist, bool toAdd) external
```

add or remove addresses who have no restrictions on the options they can sell back to the pool

### setMinDeltaForRequest

```solidity
function setMinDeltaForRequest(uint256 _minDeltaForRequest) external
```

the minimum required delta of the trade to trigger a request

### createOrder

```solidity
function createOrder(struct Types.OptionSeries _optionSeries, uint256 _amount, uint256 _price, uint256 _orderExpiry, address _buyerAddress, uint256[2] _spotMovementRange) public returns (uint256)
```

creates an order for a number of options from the pool to a specified user. The function
     is intended to be used to issue options to market makers/ OTC market participants
     in order to have flexibility and customisability on option issuance and market
     participant UX.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _optionSeries | struct Types.OptionSeries | the option token series to issue - strike in e18 |
| _amount | uint256 | the number of options to issue - e18 |
| _price | uint256 | the price per unit to issue at - in e18 |
| _orderExpiry | uint256 | the expiry of the custom order, after which the         buyer cannot use this order (if past the order is redundant) |
| _buyerAddress | address | the agreed upon buyer address |
| _spotMovementRange | uint256[2] |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | orderId the unique id of the order |

### createStrangle

```solidity
function createStrangle(struct Types.OptionSeries _optionSeriesCall, struct Types.OptionSeries _optionSeriesPut, uint256 _amountCall, uint256 _amountPut, uint256 _priceCall, uint256 _pricePut, uint256 _orderExpiry, address _buyerAddress, uint256[2] _callSpotMovementRange, uint256[2] _putSpotMovementRange) external returns (uint256, uint256)
```

creates a strangle order. One custom put and one custom call order to be executed simultaneously.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _optionSeriesCall | struct Types.OptionSeries | the option token series to issue for the call part of the strangle - strike in e18 |
| _optionSeriesPut | struct Types.OptionSeries | the option token series to issue for the put part of the strangle - strike in e18 |
| _amountCall | uint256 | the number of call options to issue |
| _amountPut | uint256 | the number of put options to issue |
| _priceCall | uint256 | the price per unit to issue calls at |
| _pricePut | uint256 | the price per unit to issue puts at |
| _orderExpiry | uint256 | the expiry of the order (if past the order is redundant) |
| _buyerAddress | address | the agreed upon buyer address |
| _callSpotMovementRange | uint256[2] |  |
| _putSpotMovementRange | uint256[2] |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | putOrderId the unique id of the put part of the strangle |
| [1] | uint256 | callOrderId the unique id of the call part of the strangle |

### executeOrder

```solidity
function executeOrder(uint256 _orderId) public
```

fulfills an order for a number of options from the pool to a specified user. The function
     is intended to be used to issue options to market makers/ OTC market participants
     in order to have flexibility and customisability on option issuance and market
     participant UX.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _orderId | uint256 | the id of the order for options purchase |

### executeStrangle

```solidity
function executeStrangle(uint256 _orderId1, uint256 _orderId2) external
```

fulfills a stored strangle order consisting of a stores call and a stored put.
This is intended to be called by market makers/OTC market participants.

### issueAndWriteOption

```solidity
function issueAndWriteOption(struct Types.OptionSeries optionSeries, uint256 amount) external returns (uint256 optionAmount, address series)
```

write a number of options for a given series addres

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | option type to mint - strike in e18 |
| amount | uint256 | the number of options to mint in e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionAmount | uint256 | the number of options minted in 2 |
| series | address | the address of the option series minted |

### issue

```solidity
function issue(struct Types.OptionSeries optionSeries) external returns (address series)
```

issue a series

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | option type to mint - strike in e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| series | address | the address of the option series minted |

### writeOption

```solidity
function writeOption(address seriesAddress, uint256 amount) external returns (uint256)
```

write a number of options for a given series address

| Name | Type | Description |
| ---- | ---- | ----------- |
| seriesAddress | address | the option token series address |
| amount | uint256 | the number of options to mint expressed as 1e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | number of options minted |

### buybackOption

```solidity
function buybackOption(address seriesAddress, uint256 amount) external returns (uint256)
```

buys a number of options back and burns the tokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| seriesAddress | address | the option token series address to buyback |
| amount | uint256 | the number of options to buyback expressed in 1e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the number of options bought and burned |

### getOptionRegistry

```solidity
function getOptionRegistry() internal view returns (contract IOptionRegistry)
```

get the option registry used for storing and managing the options

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IOptionRegistry | the option registry contract |

### getPortfolioValuesFeed

```solidity
function getPortfolioValuesFeed() internal view returns (contract IPortfolioValuesFeed)
```

get the portfolio values feed used by the liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IPortfolioValuesFeed | the portfolio values feed contract |

### _getUnderlyingPrice

```solidity
function _getUnderlyingPrice(address underlying, address _strikeAsset) internal view returns (uint256)
```

get the underlying price with just the underlying asset and strike asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | the asset that is used as the reference asset |
| _strikeAsset | address | the asset that the underlying value is denominated in |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the underlying price |

## OptionRegistry

@title Contract used for conducting options issuance and settlement as well as collateral management
 @dev Interacts with the opyn-rysk gamma protocol via OpynInteractions for options activity. Interacts with
      the liquidity pool for collateral and instructions.

### oTokenFactory

```solidity
address oTokenFactory
```

immutable variables ///

### gammaController

```solidity
address gammaController
```

### collateralAsset

```solidity
address collateralAsset
```

### addressBook

```solidity
contract AddressBookInterface addressBook
```

### marginPool

```solidity
address marginPool
```

### seriesInfo

```solidity
mapping(address => struct Types.OptionSeries) seriesInfo
```

dynamic variables ///

### vaultIds

```solidity
mapping(address => uint256) vaultIds
```

### seriesAddress

```solidity
mapping(bytes32 => address) seriesAddress
```

### vaultCount

```solidity
uint64 vaultCount
```

### liquidityPool

```solidity
address liquidityPool
```

governance settable variables ///

### callUpperHealthFactor

```solidity
uint64 callUpperHealthFactor
```

### callLowerHealthFactor

```solidity
uint64 callLowerHealthFactor
```

### putUpperHealthFactor

```solidity
uint64 putUpperHealthFactor
```

### putLowerHealthFactor

```solidity
uint64 putLowerHealthFactor
```

### keeper

```solidity
mapping(address => bool) keeper
```

### MAX_BPS

```solidity
uint256 MAX_BPS
```

constant variables ///

### SCALE_FROM

```solidity
uint256 SCALE_FROM
```

### OPYN_DECIMALS

```solidity
uint8 OPYN_DECIMALS
```

### OptionTokenCreated

```solidity
event OptionTokenCreated(address token)
```

events && errors && modifiers ///

### SeriesRedeemed

```solidity
event SeriesRedeemed(address series, uint256 underlyingAmount, uint256 strikeAmount)
```

### OptionsContractOpened

```solidity
event OptionsContractOpened(address series, uint256 vaultId, uint256 optionsAmount)
```

### OptionsContractClosed

```solidity
event OptionsContractClosed(address series, uint256 vaultId, uint256 closedAmount)
```

### OptionsContractSettled

```solidity
event OptionsContractSettled(address series, uint256 collateralReturned, uint256 collateralLost, uint256 amountLost)
```

### VaultLiquidationRegistered

```solidity
event VaultLiquidationRegistered(address series, uint256 vaultId, uint256 amountLiquidated, uint256 collateralLiquidated)
```

### NoVault

```solidity
error NoVault()
```

### NotKeeper

```solidity
error NotKeeper()
```

### NotExpired

```solidity
error NotExpired()
```

### HealthyVault

```solidity
error HealthyVault()
```

### AlreadyExpired

```solidity
error AlreadyExpired()
```

### NotLiquidityPool

```solidity
error NotLiquidityPool()
```

### NonExistentSeries

```solidity
error NonExistentSeries()
```

### InvalidCollateral

```solidity
error InvalidCollateral()
```

### VaultNotLiquidated

```solidity
error VaultNotLiquidated()
```

### InsufficientBalance

```solidity
error InsufficientBalance()
```

### constructor

```solidity
constructor(address _collateralAsset, address _oTokenFactory, address _gammaController, address _marginPool, address _liquidityPool, address _addressBook, address _authority) public
```

### setLiquidityPool

```solidity
function setLiquidityPool(address _newLiquidityPool) external
```

Set the liquidity pool address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newLiquidityPool | address | set the liquidityPool address |

### setKeeper

```solidity
function setKeeper(address _target, bool _auth) external
```

Set or revoke a keeper

| Name | Type | Description |
| ---- | ---- | ----------- |
| _target | address | address to become a keeper |
| _auth | bool | accept or revoke |

### setHealthThresholds

```solidity
function setHealthThresholds(uint64 _putLower, uint64 _putUpper, uint64 _callLower, uint64 _callUpper) external
```

Set the health thresholds of the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| _putLower | uint64 | the lower health threshold for puts |
| _putUpper | uint64 | the upper health threshold for puts |
| _callLower | uint64 | the lower health threshold for calls |
| _callUpper | uint64 | the upper health threshold for calls |

### issue

```solidity
function issue(struct Types.OptionSeries optionSeries) external returns (address)
```

Either retrieves the option token if it already exists, or deploy it

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | the series used for the mint - strike passed in as e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### open

```solidity
function open(address _series, uint256 amount, uint256 collateralAmount) external returns (bool, uint256)
```

Open an options contract using collateral from the liquidity pool

_only callable by the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be created |
| amount | uint256 | the amount of options to deploy - assume in e18 |
| collateralAmount | uint256 | the collateral required for the option - assumes in collateral decimals |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 | the amount of collateral taken from the liquidityPool |

### close

```solidity
function close(address _series, uint256 amount) external returns (bool, uint256)
```

Close an options contract (oToken) before it has expired

_only callable by the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be burnt |
| amount | uint256 | the amount of options to burn - assumes in e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 |  |

### settle

```solidity
function settle(address _series) external returns (bool, uint256, uint256, uint256)
```

Settle an options vault

_callable by the liquidityPool so that local variables can also be updated_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be burnt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 | the amount of collateral returned from the vault |
| [2] | uint256 | the amount of collateral used to pay ITM options on vault settle |
| [3] | uint256 | number of oTokens that the vault was short |

### adjustCollateral

```solidity
function adjustCollateral(uint256 vaultId) external
```

adjust the collateral held in a specific vault because of health

| Name | Type | Description |
| ---- | ---- | ----------- |
| vaultId | uint256 | the id of the vault to check |

### adjustCollateralCaller

```solidity
function adjustCollateralCaller(uint256 vaultId) external
```

adjust the collateral held in a specific vault because of health, using collateral from the caller. Only takes
        from msg.sender, doesnt give them if vault is above the max.

_this is a safety function, if worst comes to worse any caller can collateralise a vault to save it._

| Name | Type | Description |
| ---- | ---- | ----------- |
| vaultId | uint256 | the id of the vault to check |

### wCollatLiquidatedVault

```solidity
function wCollatLiquidatedVault(uint256 vaultId) external
```

withdraw collateral from a fully liquidated vault

_this is a safety function, if a vault is liquidated._

| Name | Type | Description |
| ---- | ---- | ----------- |
| vaultId | uint256 | the id of the vault to check |

### registerLiquidatedVault

```solidity
function registerLiquidatedVault(uint256 vaultId) external
```

register a liquidated vault so the collateral allocated is managed

_this is a safety function, if a vault is liquidated to update the collateral assets in the pool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| vaultId | uint256 | the id of the vault to register liquidation for |

### redeem

```solidity
function redeem(address _series) external returns (uint256)
```

Redeem oTokens for the locked collateral

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be burnt and redeemed |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount returned |

### getCollateral

```solidity
function getCollateral(struct Types.OptionSeries series, uint256 amount) external view returns (uint256)
```

Send collateral funds for an option to be minted

_series.strike should be scaled by 1e8._

| Name | Type | Description |
| ---- | ---- | ----------- |
| series | struct Types.OptionSeries | details of the option series |
| amount | uint256 | amount of options to mint always in e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount transferred |

### getOtoken

```solidity
function getOtoken(address underlying, address strikeAsset, uint256 expiration, bool isPut, uint256 strike, address collateral) external view returns (address)
```

Retrieves the option token if it exists

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | is the address of the underlying asset of the option |
| strikeAsset | address | is the address of the collateral asset of the option |
| expiration | uint256 | is the expiry timestamp of the option |
| isPut | bool | the type of option |
| strike | uint256 | is the strike price of the option - 1e18 format |
| collateral | address | is the address of the asset to collateralize the option with |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### checkVaultHealth

```solidity
function checkVaultHealth(uint256 vaultId) public view returns (bool isBelowMin, bool isAboveMax, uint256 healthFactor, uint256 upperHealthFactor, uint256 collatRequired, address collatAsset)
```

check the health of a specific vault to see if it requires collateral

| Name | Type | Description |
| ---- | ---- | ----------- |
| vaultId | uint256 | the id of the vault to check |

| Name | Type | Description |
| ---- | ---- | ----------- |
| isBelowMin | bool | bool to determine whether the vault needs topping up |
| isAboveMax | bool | bool to determine whether the vault is too overcollateralised |
| healthFactor | uint256 | the health factor of the vault in MAX_BPS format |
| upperHealthFactor | uint256 | the upper bound of the acceptable health facor range in MAX_BPS format |
| collatRequired | uint256 | the amount of collateral required to return the vault back to normal |
| collatAsset | address | the address of the collateral asset |

### getSeriesAddress

```solidity
function getSeriesAddress(bytes32 issuanceHash) external view returns (address)
```

non-complex getters ///

### getSeries

```solidity
function getSeries(struct Types.OptionSeries _series) external view returns (address)
```

### getSeriesInfo

```solidity
function getSeriesInfo(address series) external view returns (struct Types.OptionSeries)
```

### getIssuanceHash

```solidity
function getIssuanceHash(struct Types.OptionSeries _series) public pure returns (bytes32)
```

### getIssuanceHash

```solidity
function getIssuanceHash(address underlying, address strikeAsset, address collateral, uint256 expiration, bool isPut, uint256 strike) internal pure returns (bytes32)
```

Helper function for computing the hash of a given issuance.

### formatStrikePrice

```solidity
function formatStrikePrice(uint256 strikePrice, address collateral) public view returns (uint256)
```

Converts strike price to 1e8 format and floors least significant digits if needed

| Name | Type | Description |
| ---- | ---- | ----------- |
| strikePrice | uint256 | strikePrice in 1e18 format |
| collateral | address | address of collateral asset |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | if the transaction succeeded |

### _isLiquidityPool

```solidity
function _isLiquidityPool() internal view
```

### _isKeeper

```solidity
function _isKeeper() internal view
```

_keepers, managers or governors can access_

## PriceFeed

@title Contract used for accessing exchange rates using chainlink price feeds
 @dev Interacts with chainlink price feeds and services all contracts in the system for price data.

### priceFeeds

```solidity
mapping(address => mapping(address => address)) priceFeeds
```

governance settable variables ///

### SCALE_DECIMALS

```solidity
uint8 SCALE_DECIMALS
```

constant variables ///

### constructor

```solidity
constructor(address _authority) public
```

### addPriceFeed

```solidity
function addPriceFeed(address underlying, address strike, address feed) public
```

setters ///

### getRate

```solidity
function getRate(address underlying, address strike) external view returns (uint256)
```

complex getters ///

### getNormalizedRate

```solidity
function getNormalizedRate(address underlying, address strike) external view returns (uint256)
```

_get the rate from chainlink and convert it to e18 decimals_

## Protocol

@title Contract used for storage of important contracts for the liquidity pool

### optionRegistry

```solidity
address optionRegistry
```

static variables ///

### volatilityFeed

```solidity
address volatilityFeed
```

governance settable variables ///

### portfolioValuesFeed

```solidity
address portfolioValuesFeed
```

### accounting

```solidity
address accounting
```

### priceFeed

```solidity
address priceFeed
```

### constructor

```solidity
constructor(address _optionRegistry, address _priceFeed, address _volatilityFeed, address _portfolioValuesFeed, address _authority) public
```

### changeVolatilityFeed

```solidity
function changeVolatilityFeed(address _volFeed) external
```

setters ///

### changePortfolioValuesFeed

```solidity
function changePortfolioValuesFeed(address _portfolioValuesFeed) external
```

### changeAccounting

```solidity
function changeAccounting(address _accounting) external
```

### changePriceFeed

```solidity
function changePriceFeed(address _priceFeed) external
```

## VolatilityFeed

@title Contract used as the Dynamic Hedging Vault for storing funds, issuing shares and processing options transactions
 @dev Interacts with liquidity pool to feed in volatility data.

### sabrParams

```solidity
mapping(uint256 => struct VolatilityFeed.SABRParams) sabrParams
```

settable variables ///

### keeper

```solidity
mapping(address => bool) keeper
```

### ONE_YEAR_SECONDS

```solidity
int256 ONE_YEAR_SECONDS
```

constant variables ///

### BIPS_SCALE

```solidity
int256 BIPS_SCALE
```

### BIPS

```solidity
int256 BIPS
```

### SABRParams

```solidity
struct SABRParams {
  int32 callAlpha;
  int32 callBeta;
  int32 callRho;
  int32 callVolvol;
  int32 putAlpha;
  int32 putBeta;
  int32 putRho;
  int32 putVolvol;
}
```

### constructor

```solidity
constructor(address _authority) public
```

### AlphaError

```solidity
error AlphaError()
```

setters ///

### BetaError

```solidity
error BetaError()
```

### RhoError

```solidity
error RhoError()
```

### VolvolError

```solidity
error VolvolError()
```

### setSabrParameters

```solidity
function setSabrParameters(struct VolatilityFeed.SABRParams _sabrParams, uint256 _expiry) external
```

set the sabr volatility params

_only keepers can call this function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sabrParams | struct VolatilityFeed.SABRParams | set the SABR parameters |
| _expiry | uint256 | the expiry that the SABR parameters represent |

### setKeeper

```solidity
function setKeeper(address _keeper, bool _auth) external
```

update the keepers

### getImpliedVolatility

```solidity
function getImpliedVolatility(bool isPut, uint256 underlyingPrice, uint256 strikePrice, uint256 expiration) external view returns (uint256)
```

get the current implied volatility from the feed

| Name | Type | Description |
| ---- | ---- | ----------- |
| isPut | bool | Is the option a call or put? |
| underlyingPrice | uint256 | The underlying price |
| strikePrice | uint256 | The strike price of the option |
| expiration | uint256 | expiration timestamp of option as a PRBMath Float |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Implied volatility adjusted for volatility surface |

### _isKeeper

```solidity
function _isKeeper() internal view
```

_keepers, managers or governors can access_

## AddressBookInterface

### getOtokenImpl

```solidity
function getOtokenImpl() external view returns (address)
```

### getOtokenFactory

```solidity
function getOtokenFactory() external view returns (address)
```

### getWhitelist

```solidity
function getWhitelist() external view returns (address)
```

### getController

```solidity
function getController() external view returns (address)
```

### getOracle

```solidity
function getOracle() external view returns (address)
```

### getMarginPool

```solidity
function getMarginPool() external view returns (address)
```

### getMarginCalculator

```solidity
function getMarginCalculator() external view returns (address)
```

### getLiquidationManager

```solidity
function getLiquidationManager() external view returns (address)
```

### getAddress

```solidity
function getAddress(bytes32 _id) external view returns (address)
```

### setOtokenImpl

```solidity
function setOtokenImpl(address _otokenImpl) external
```

### setOtokenFactory

```solidity
function setOtokenFactory(address _factory) external
```

### setOracleImpl

```solidity
function setOracleImpl(address _otokenImpl) external
```

### setWhitelist

```solidity
function setWhitelist(address _whitelist) external
```

### setController

```solidity
function setController(address _controller) external
```

### setMarginPool

```solidity
function setMarginPool(address _marginPool) external
```

### setMarginCalculator

```solidity
function setMarginCalculator(address _calculator) external
```

### setLiquidationManager

```solidity
function setLiquidationManager(address _liquidationManager) external
```

### setAddress

```solidity
function setAddress(bytes32 _id, address _newImpl) external
```

## AggregatorV3Interface

### decimals

```solidity
function decimals() external view returns (uint8)
```

### description

```solidity
function description() external view returns (string)
```

### version

```solidity
function version() external view returns (uint256)
```

### getRoundData

```solidity
function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

### latestRoundData

```solidity
function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

## GammaTypes

### Vault

```solidity
struct Vault {
  address[] shortOtokens;
  address[] longOtokens;
  address[] collateralAssets;
  uint256[] shortAmounts;
  uint256[] longAmounts;
  uint256[] collateralAmounts;
}
```

### VaultLiquidationDetails

```solidity
struct VaultLiquidationDetails {
  address series;
  uint128 shortAmount;
  uint128 collateralAmount;
}
```

## IOtoken

### underlyingAsset

```solidity
function underlyingAsset() external view returns (address)
```

### strikeAsset

```solidity
function strikeAsset() external view returns (address)
```

### collateralAsset

```solidity
function collateralAsset() external view returns (address)
```

### strikePrice

```solidity
function strikePrice() external view returns (uint256)
```

### expiryTimestamp

```solidity
function expiryTimestamp() external view returns (uint256)
```

### isPut

```solidity
function isPut() external view returns (bool)
```

## IOtokenFactory

### getOtoken

```solidity
function getOtoken(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external view returns (address)
```

### createOtoken

```solidity
function createOtoken(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external returns (address)
```

### getTargetOtokenAddress

```solidity
function getTargetOtokenAddress(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external view returns (address)
```

### OtokenCreated

```solidity
event OtokenCreated(address tokenAddress, address creator, address underlying, address strike, address collateral, uint256 strikePrice, uint256 expiry, bool isPut)
```

## IController

### ActionType

```solidity
enum ActionType {
  OpenVault,
  MintShortOption,
  BurnShortOption,
  DepositLongOption,
  WithdrawLongOption,
  DepositCollateral,
  WithdrawCollateral,
  SettleVault,
  Redeem,
  Call,
  Liquidate
}
```

### ActionArgs

```solidity
struct ActionArgs {
  enum IController.ActionType actionType;
  address owner;
  address secondAddress;
  address asset;
  uint256 vaultId;
  uint256 amount;
  uint256 index;
  bytes data;
}
```

### RedeemArgs

```solidity
struct RedeemArgs {
  address receiver;
  address otoken;
  uint256 amount;
}
```

### getPayout

```solidity
function getPayout(address _otoken, uint256 _amount) external view returns (uint256)
```

### operate

```solidity
function operate(struct IController.ActionArgs[] _actions) external
```

### getAccountVaultCounter

```solidity
function getAccountVaultCounter(address owner) external view returns (uint256)
```

### oracle

```solidity
function oracle() external view returns (address)
```

### getVault

```solidity
function getVault(address _owner, uint256 _vaultId) external view returns (struct GammaTypes.Vault)
```

### getProceed

```solidity
function getProceed(address _owner, uint256 _vaultId) external view returns (uint256)
```

### isSettlementAllowed

```solidity
function isSettlementAllowed(address _underlying, address _strike, address _collateral, uint256 _expiry) external view returns (bool)
```

### clearVaultLiquidationDetails

```solidity
function clearVaultLiquidationDetails(uint256 _vaultId) external
```

### getVaultLiquidationDetails

```solidity
function getVaultLiquidationDetails(address _owner, uint256 _vaultId) external view returns (address, uint256, uint256)
```

## IAccounting

### DepositReceipt

```solidity
struct DepositReceipt {
  uint128 epoch;
  uint128 amount;
  uint256 unredeemedShares;
}
```

### WithdrawalReceipt

```solidity
struct WithdrawalReceipt {
  uint128 epoch;
  uint128 shares;
}
```

### deposit

```solidity
function deposit(address depositor, uint256 _amount) external returns (uint256 depositAmount, uint256 unredeemedShares)
```

logic for adding liquidity to the options liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositor | address | the address making the deposit |
| _amount | uint256 | amount of the collateral asset to deposit |

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositAmount | uint256 | the amount to deposit from the round |
| unredeemedShares | uint256 | number of shares held in the deposit receipt that havent been redeemed |

### redeem

```solidity
function redeem(address redeemer, uint256 shares) external returns (uint256 toRedeem, struct IAccounting.DepositReceipt depositReceipt)
```

logic for allowing a user to redeem their shares from a previous epoch

| Name | Type | Description |
| ---- | ---- | ----------- |
| redeemer | address | the address making the deposit |
| shares | uint256 | amount of the collateral asset to deposit |

| Name | Type | Description |
| ---- | ---- | ----------- |
| toRedeem | uint256 | the amount to actually redeem |
| depositReceipt | struct IAccounting.DepositReceipt | the updated deposit receipt after the redeem has completed |

### initiateWithdraw

```solidity
function initiateWithdraw(address withdrawer, uint256 shares) external returns (struct IAccounting.WithdrawalReceipt withdrawalReceipt)
```

logic for accounting a user to initiate a withdraw request from the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawer | address | the address carrying out the withdrawal |
| shares | uint256 | the amount of shares to withdraw for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawalReceipt | struct IAccounting.WithdrawalReceipt | the new withdrawal receipt to pass to the liquidityPool |

### completeWithdraw

```solidity
function completeWithdraw(address withdrawer, uint256 shares) external returns (uint256 withdrawalAmount, uint256 withdrawalShares, struct IAccounting.WithdrawalReceipt withdrawalReceipt)
```

logic for accounting a user to complete a withdrawal

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawer | address | the address carrying out the withdrawal |
| shares | uint256 | the amount of shares to withdraw for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawalAmount | uint256 | the amount of collateral to withdraw |
| withdrawalShares | uint256 | the number of shares to withdraw |
| withdrawalReceipt | struct IAccounting.WithdrawalReceipt | the new withdrawal receipt to pass to the liquidityPool |

### executeEpochCalculation

```solidity
function executeEpochCalculation(uint256 totalSupply, uint256 assets, int256 liabilities) external view returns (uint256 newPricePerShareDeposit, uint256 newPricePerShareWithdrawal, uint256 sharesToMint, uint256 totalWithdrawAmount, uint256 amountNeeded)
```

execute the next epoch

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalSupply | uint256 | the total number of share tokens |
| assets | uint256 | the amount of collateral assets |
| liabilities | int256 | the amount of liabilities of the pool |

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPricePerShareDeposit | uint256 | the price per share for deposits |
| newPricePerShareWithdrawal | uint256 | the price per share for withdrawals |
| sharesToMint | uint256 | the number of shares to mint this epoch |
| totalWithdrawAmount | uint256 | the amount of collateral to set aside for partitioning |
| amountNeeded | uint256 | the amount needed to reach the total withdraw amount if collateral balance of lp is insufficient |

### sharesForAmount

```solidity
function sharesForAmount(uint256 _amount, uint256 assetPerShare) external view returns (uint256 shares)
```

get the number of shares for a given amount

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | the amount to convert to shares - assumed in collateral decimals |
| assetPerShare | uint256 | the amount of assets received per share |

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | the number of shares based on the amount - assumed in e18 |

## IAuthority

### GovernorPushed

```solidity
event GovernorPushed(address from, address to, bool _effectiveImmediately)
```

### GuardianPushed

```solidity
event GuardianPushed(address to, bool _effectiveImmediately)
```

### ManagerPushed

```solidity
event ManagerPushed(address from, address to, bool _effectiveImmediately)
```

### GovernorPulled

```solidity
event GovernorPulled(address from, address to)
```

### GuardianPulled

```solidity
event GuardianPulled(address to)
```

### ManagerPulled

```solidity
event ManagerPulled(address from, address to)
```

### governor

```solidity
function governor() external view returns (address)
```

### guardian

```solidity
function guardian(address _target) external view returns (bool)
```

### manager

```solidity
function manager() external view returns (address)
```

## IHedgingReactor

### hedgeDelta

```solidity
function hedgeDelta(int256 delta) external returns (int256)
```

Execute a strategy to hedge delta exposure

| Name | Type | Description |
| ---- | ---- | ----------- |
| delta | int256 | The exposure of the liquidity pool that the reactor needs to hedge against |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 | deltaChange The difference in delta exposure as a result of strategy execution |

### getDelta

```solidity
function getDelta() external view returns (int256 delta)
```

Returns the delta exposure of the reactor

### getPoolDenominatedValue

```solidity
function getPoolDenominatedValue() external view returns (uint256 value)
```

Returns the value of the reactor denominated in the liquidity pool asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | the value of the reactor in the liquidity pool asset |

### withdraw

```solidity
function withdraw(uint256 amount) external returns (uint256)
```

Withdraw a given asset from the hedging reactor to the calling liquidity pool.

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to withdraw |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the amount actually withdrawn from the reactor denominated in the liquidity pool asset |

### update

```solidity
function update() external returns (uint256)
```

Handle events such as collateralisation rebalancing

## ILiquidityPool

### strikeAsset

```solidity
function strikeAsset() external view returns (address)
```

immutable variables ///

### underlyingAsset

```solidity
function underlyingAsset() external view returns (address)
```

### collateralAsset

```solidity
function collateralAsset() external view returns (address)
```

### collateralAllocated

```solidity
function collateralAllocated() external view returns (uint256)
```

dynamic variables ///

### ephemeralLiabilities

```solidity
function ephemeralLiabilities() external view returns (int256)
```

### ephemeralDelta

```solidity
function ephemeralDelta() external view returns (int256)
```

### depositEpoch

```solidity
function depositEpoch() external view returns (uint256)
```

### withdrawalEpoch

```solidity
function withdrawalEpoch() external view returns (uint256)
```

### depositEpochPricePerShare

```solidity
function depositEpochPricePerShare(uint256 epoch) external view returns (uint256 price)
```

### withdrawalEpochPricePerShare

```solidity
function withdrawalEpochPricePerShare(uint256 epoch) external view returns (uint256 price)
```

### depositReceipts

```solidity
function depositReceipts(address depositor) external view returns (struct IAccounting.DepositReceipt)
```

### withdrawalReceipts

```solidity
function withdrawalReceipts(address withdrawer) external view returns (struct IAccounting.WithdrawalReceipt)
```

### pendingDeposits

```solidity
function pendingDeposits() external view returns (uint256)
```

### pendingWithdrawals

```solidity
function pendingWithdrawals() external view returns (uint256)
```

### partitionedFunds

```solidity
function partitionedFunds() external view returns (uint256)
```

### bufferPercentage

```solidity
function bufferPercentage() external view returns (uint256)
```

governance settable variables ///

### collateralCap

```solidity
function collateralCap() external view returns (uint256)
```

### handlerIssue

```solidity
function handlerIssue(struct Types.OptionSeries optionSeries) external returns (address)
```

functions ///

### resetEphemeralValues

```solidity
function resetEphemeralValues() external
```

### getAssets

```solidity
function getAssets() external view returns (uint256)
```

### redeem

```solidity
function redeem(uint256) external returns (uint256)
```

### handlerWriteOption

```solidity
function handlerWriteOption(struct Types.OptionSeries optionSeries, address seriesAddress, uint256 amount, contract IOptionRegistry optionRegistry, uint256 premium, int256 delta, address recipient) external returns (uint256)
```

### handlerBuybackOption

```solidity
function handlerBuybackOption(struct Types.OptionSeries optionSeries, uint256 amount, contract IOptionRegistry optionRegistry, address seriesAddress, uint256 premium, int256 delta, address seller) external returns (uint256)
```

### handlerIssueAndWriteOption

```solidity
function handlerIssueAndWriteOption(struct Types.OptionSeries optionSeries, uint256 amount, uint256 premium, int256 delta, address recipient) external returns (uint256, address)
```

### getPortfolioDelta

```solidity
function getPortfolioDelta() external view returns (int256)
```

### quotePriceWithUtilizationGreeks

```solidity
function quotePriceWithUtilizationGreeks(struct Types.OptionSeries optionSeries, uint256 amount, bool toBuy) external view returns (uint256 quote, int256 delta)
```

### checkBuffer

```solidity
function checkBuffer() external view returns (uint256 bufferRemaining)
```

### getBalance

```solidity
function getBalance(address asset) external view returns (uint256)
```

## IMarginCalculator

### getNakedMarginRequired

```solidity
function getNakedMarginRequired(address _underlying, address _strike, address _collateral, uint256 _shortAmount, uint256 _strikePrice, uint256 _underlyingPrice, uint256 _shortExpiryTimestamp, uint256 _collateralDecimals, bool _isPut) external view returns (uint256)
```

## IOptionRegistry

### issue

```solidity
function issue(struct Types.OptionSeries optionSeries) external returns (address)
```

Either retrieves the option token if it already exists, or deploy it

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | option series to issue |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### open

```solidity
function open(address _series, uint256 amount, uint256 collateralAmount) external returns (bool, uint256)
```

Open an options contract using collateral from the liquidity pool

_only callable by the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be created |
| amount | uint256 | the amount of options to deploy |
| collateralAmount | uint256 | the collateral required for the option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 | the amount of collateral taken from the liquidityPool |

### close

```solidity
function close(address _series, uint256 amount) external returns (bool, uint256)
```

Close an options contract (oToken) before it has expired

_only callable by the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be burnt |
| amount | uint256 | the amount of options to burn |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 |  |

### settle

```solidity
function settle(address _series) external returns (bool success, uint256 collatReturned, uint256 collatLost, uint256 amountShort)
```

Settle an options vault

_callable by anyone but returns funds to the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be burnt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool | if the transaction succeeded |
| collatReturned | uint256 | the amount of collateral returned from the vault |
| collatLost | uint256 | the amount of collateral used to pay ITM options on vault settle |
| amountShort | uint256 | number of oTokens that the vault was short |

### getCollateral

```solidity
function getCollateral(struct Types.OptionSeries series, uint256 amount) external view returns (uint256)
```

Send collateral funds for an option to be minted

_series.strike should be scaled by 1e8._

| Name | Type | Description |
| ---- | ---- | ----------- |
| series | struct Types.OptionSeries | details of the option series |
| amount | uint256 | amount of options to mint |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount transferred |

### getOtoken

```solidity
function getOtoken(address underlying, address strikeAsset, uint256 expiration, bool isPut, uint256 strike, address collateral) external view returns (address)
```

Retrieves the option token if it exists

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | is the address of the underlying asset of the option |
| strikeAsset | address | is the address of the collateral asset of the option |
| expiration | uint256 | is the expiry timestamp of the option |
| isPut | bool | the type of option |
| strike | uint256 | is the strike price of the option - 1e18 format |
| collateral | address | is the address of the asset to collateralize the option with |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### getSeriesInfo

```solidity
function getSeriesInfo(address series) external view returns (struct Types.OptionSeries)
```

non-complex getters ///

### vaultIds

```solidity
function vaultIds(address series) external view returns (uint256)
```

### gammaController

```solidity
function gammaController() external view returns (address)
```

## IOracle

### getPrice

```solidity
function getPrice(address _asset) external view returns (uint256)
```

## IPortfolioValuesFeed

### requestPortfolioData

```solidity
function requestPortfolioData(address _underlying, address _strike) external returns (bytes32 requestId)
```

Creates a Chainlink request to update portfolio values
data, then multiply by 1000000000000000000 (to remove decimal places from data).

| Name | Type | Description |
| ---- | ---- | ----------- |
| requestId | bytes32 | - id of the request |

### updateStores

```solidity
function updateStores(struct Types.OptionSeries _optionSeries, int256 _shortExposure, int256 _longExposure, address _seriesAddress) external
```

### getPortfolioValues

```solidity
function getPortfolioValues(address underlying, address strike) external view returns (struct Types.PortfolioValues)
```

non-complex getters ///

## I_ERC20

_Interface of the ERC20 standard as defined in the EIP._

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

_Returns the amount of tokens in existence._

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

_Returns the amount of tokens owned by `account`._

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from the caller's account to `recipient`.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

_Returns the remaining number of tokens that `spender` will be
allowed to spend on behalf of `owner` through {transferFrom}. This is
zero by default.

This value changes when {approve} or {transferFrom} are called._

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

_Sets `amount` as the allowance of `spender` over the caller's tokens.

Returns a boolean value indicating whether the operation succeeded.

IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender's allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

Emits an {Approval} event._

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from `sender` to `recipient` using the
allowance mechanism. `amount` is then deducted from the caller's
allowance.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

_Emitted when `value` tokens are moved from one account (`from`) to
another (`to`).

Note that `value` may be zero._

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

_Emitted when the allowance of a `spender` for an `owner` is set by
a call to {approve}. `value` is the new allowance._

## UNAUTHORIZED

```solidity
error UNAUTHORIZED()
```

## AccessControl

@title Contract used for access control functionality, based off of OlympusDao Access Control

### AuthorityUpdated

```solidity
event AuthorityUpdated(contract IAuthority authority)
```

### authority

```solidity
contract IAuthority authority
```

### constructor

```solidity
constructor(contract IAuthority _authority) internal
```

### setAuthority

```solidity
function setAuthority(contract IAuthority _newAuthority) external
```

### _onlyGovernor

```solidity
function _onlyGovernor() internal view
```

### _onlyGuardian

```solidity
function _onlyGuardian() internal view
```

### _onlyManager

```solidity
function _onlyManager() internal view
```

## BlackScholes

@title Library used to calculate an option price using Black Scholes

### ONE_YEAR_SECONDS

```solidity
uint256 ONE_YEAR_SECONDS
```

### ONE

```solidity
uint256 ONE
```

### TWO

```solidity
uint256 TWO
```

### Intermediates

```solidity
struct Intermediates {
  uint256 d1Denominator;
  int256 d1;
  int256 eToNegRT;
}
```

### callOptionPrice

```solidity
function callOptionPrice(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) public pure returns (uint256)
```

### callOptionPriceGreeks

```solidity
function callOptionPriceGreeks(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) public pure returns (uint256 quote, int256 delta)
```

### putOptionPriceGreeks

```solidity
function putOptionPriceGreeks(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) public pure returns (uint256 quote, int256 delta)
```

### putOptionPrice

```solidity
function putOptionPrice(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) public pure returns (uint256)
```

### getTimeStamp

```solidity
function getTimeStamp() private view returns (uint256)
```

### getD1

```solidity
function getD1(uint256 price, uint256 strike, uint256 time, uint256 vol, uint256 rfr) private pure returns (int256 d1, uint256 d1Denominator)
```

### getIntermediates

```solidity
function getIntermediates(uint256 price, uint256 strike, uint256 time, uint256 vol, uint256 rfr) private pure returns (struct BlackScholes.Intermediates)
```

### blackScholesCalc

```solidity
function blackScholesCalc(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) public view returns (uint256)
```

### blackScholesCalcGreeks

```solidity
function blackScholesCalcGreeks(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) public view returns (uint256 quote, int256 delta)
```

### getDelta

```solidity
function getDelta(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) public view returns (int256)
```

## CustomErrors

### NotKeeper

```solidity
error NotKeeper()
```

### IVNotFound

```solidity
error IVNotFound()
```

### NotHandler

```solidity
error NotHandler()
```

### InvalidPrice

```solidity
error InvalidPrice()
```

### InvalidBuyer

```solidity
error InvalidBuyer()
```

### InvalidOrder

```solidity
error InvalidOrder()
```

### OrderExpired

```solidity
error OrderExpired()
```

### InvalidAmount

```solidity
error InvalidAmount()
```

### TradingPaused

```solidity
error TradingPaused()
```

### IssuanceFailed

```solidity
error IssuanceFailed()
```

### EpochNotClosed

```solidity
error EpochNotClosed()
```

### TradingNotPaused

```solidity
error TradingNotPaused()
```

### NotLiquidityPool

```solidity
error NotLiquidityPool()
```

### DeltaNotDecreased

```solidity
error DeltaNotDecreased()
```

### NonExistentOtoken

```solidity
error NonExistentOtoken()
```

### OrderExpiryTooLong

```solidity
error OrderExpiryTooLong()
```

### InvalidShareAmount

```solidity
error InvalidShareAmount()
```

### ExistingWithdrawal

```solidity
error ExistingWithdrawal()
```

### TotalSupplyReached

```solidity
error TotalSupplyReached()
```

### StrikeAssetInvalid

```solidity
error StrikeAssetInvalid()
```

### OptionStrikeInvalid

```solidity
error OptionStrikeInvalid()
```

### OptionExpiryInvalid

```solidity
error OptionExpiryInvalid()
```

### NoExistingWithdrawal

```solidity
error NoExistingWithdrawal()
```

### SpotMovedBeyondRange

```solidity
error SpotMovedBeyondRange()
```

### CollateralAssetInvalid

```solidity
error CollateralAssetInvalid()
```

### UnderlyingAssetInvalid

```solidity
error UnderlyingAssetInvalid()
```

### CollateralAmountInvalid

```solidity
error CollateralAmountInvalid()
```

### WithdrawExceedsLiquidity

```solidity
error WithdrawExceedsLiquidity()
```

### InsufficientShareBalance

```solidity
error InsufficientShareBalance()
```

### MaxLiquidityBufferReached

```solidity
error MaxLiquidityBufferReached()
```

### LiabilitiesGreaterThanAssets

```solidity
error LiabilitiesGreaterThanAssets()
```

### CustomOrderInsufficientPrice

```solidity
error CustomOrderInsufficientPrice()
```

### CustomOrderInvalidDeltaValue

```solidity
error CustomOrderInvalidDeltaValue()
```

### DeltaQuoteError

```solidity
error DeltaQuoteError(uint256 quote, int256 delta)
```

### TimeDeltaExceedsThreshold

```solidity
error TimeDeltaExceedsThreshold(uint256 timeDelta)
```

### PriceDeltaExceedsThreshold

```solidity
error PriceDeltaExceedsThreshold(uint256 priceDelta)
```

### StrikeAmountExceedsLiquidity

```solidity
error StrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeLiquidity)
```

### MinStrikeAmountExceedsLiquidity

```solidity
error MinStrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeAmountMin)
```

### UnderlyingAmountExceedsLiquidity

```solidity
error UnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingLiquidity)
```

### MinUnderlyingAmountExceedsLiquidity

```solidity
error MinUnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingAmountMin)
```

## EnumerableSet

_Library for managing
https://en.wikipedia.org/wiki/Set_(abstract_data_type)[sets] of primitive
types.

Sets have the following properties:

- Elements are added, removed, and checked for existence in constant time
(O(1)).
- Elements are enumerated in O(n). No guarantees are made on the ordering.

```
contract Example {
    // Add the library methods
    using EnumerableSet for EnumerableSet.AddressSet;

    // Declare a set state variable
    EnumerableSet.AddressSet private mySet;
}
```

As of v3.3.0, sets of type `bytes32` (`Bytes32Set`), `address` (`AddressSet`)
and `uint256` (`UintSet`) are supported.

[WARNING]
====
 Trying to delete such a structure from storage will likely result in data corruption, rendering the structure unusable.
 See https://github.com/ethereum/solidity/pull/11843[ethereum/solidity#11843] for more info.

 In order to clean an EnumerableSet, you can either remove all elements one by one or create a fresh instance using an array of EnumerableSet.
====_

### Set

```solidity
struct Set {
  bytes32[] _values;
  mapping(bytes32 => uint256) _indexes;
}
```

### _add

```solidity
function _add(struct EnumerableSet.Set set, bytes32 value) private returns (bool)
```

_Add a value to a set. O(1).

Returns true if the value was added to the set, that is if it was not
already present._

### _remove

```solidity
function _remove(struct EnumerableSet.Set set, bytes32 value) private returns (bool)
```

_Removes a value from a set. O(1).

Returns true if the value was removed from the set, that is if it was
present._

### _contains

```solidity
function _contains(struct EnumerableSet.Set set, bytes32 value) private view returns (bool)
```

_Returns true if the value is in the set. O(1)._

### _length

```solidity
function _length(struct EnumerableSet.Set set) private view returns (uint256)
```

_Returns the number of values on the set. O(1)._

### _at

```solidity
function _at(struct EnumerableSet.Set set, uint256 index) private view returns (bytes32)
```

_Returns the value stored at position `index` in the set. O(1).

Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.

Requirements:

- `index` must be strictly less than {length}._

### _values

```solidity
function _values(struct EnumerableSet.Set set) private view returns (bytes32[])
```

_Return the entire set in an array

WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
this function has an unbounded cost, and using it as part of a state-changing function may render the function
uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block._

### AddressSet

```solidity
struct AddressSet {
  struct EnumerableSet.Set _inner;
}
```

### add

```solidity
function add(struct EnumerableSet.AddressSet set, address value) internal returns (bool)
```

_Add a value to a set. O(1).

Returns true if the value was added to the set, that is if it was not
already present._

### remove

```solidity
function remove(struct EnumerableSet.AddressSet set, address value) internal returns (bool)
```

_Removes a value from a set. O(1).

Returns true if the value was removed from the set, that is if it was
present._

### contains

```solidity
function contains(struct EnumerableSet.AddressSet set, address value) internal view returns (bool)
```

_Returns true if the value is in the set. O(1)._

### length

```solidity
function length(struct EnumerableSet.AddressSet set) internal view returns (uint256)
```

_Returns the number of values in the set. O(1)._

### at

```solidity
function at(struct EnumerableSet.AddressSet set, uint256 index) internal view returns (address)
```

_Returns the value stored at position `index` in the set. O(1).

Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.

Requirements:

- `index` must be strictly less than {length}._

### values

```solidity
function values(struct EnumerableSet.AddressSet set) internal view returns (address[])
```

_Return the entire set in an array

WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
this function has an unbounded cost, and using it as part of a state-changing function may render the function
uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block._

## NormalDist

@title Library used for approximating a normal distribution

### ONE

```solidity
int256 ONE
```

### ONE_HALF

```solidity
int256 ONE_HALF
```

### SQRT_TWO

```solidity
int256 SQRT_TWO
```

### A1

```solidity
int256 A1
```

### A2

```solidity
int256 A2
```

### A3

```solidity
int256 A3
```

### A4

```solidity
int256 A4
```

### A5

```solidity
int256 A5
```

### P

```solidity
int256 P
```

### cdf

```solidity
function cdf(int256 x) public pure returns (int256)
```

### phi

```solidity
function phi(int256 x) public pure returns (int256)
```

### getScoresFromT

```solidity
function getScoresFromT(int256 t) public pure returns (int256)
```

## OptionsCompute

@title Library used for various helper functionality for the Liquidity Pool

### SCALE_DECIMALS

```solidity
uint8 SCALE_DECIMALS
```

### convertToDecimals

```solidity
function convertToDecimals(uint256 value, uint256 decimals) internal pure returns (uint256)
```

_assumes decimals are coming in as e18_

### convertFromDecimals

```solidity
function convertFromDecimals(uint256 value, uint256 decimals) internal pure returns (uint256)
```

_converts from specified decimals to e18_

### convertToCollateralDenominated

```solidity
function convertToCollateralDenominated(uint256 quote, uint256 underlyingPrice, struct Types.OptionSeries optionSeries) internal pure returns (uint256 convertedQuote)
```

### calculatePercentageChange

```solidity
function calculatePercentageChange(uint256 n, uint256 o) internal pure returns (uint256 pC)
```

_computes the percentage change between two integers_

| Name | Type | Description |
| ---- | ---- | ----------- |
| n | uint256 | new value in e18 |
| o | uint256 | old value in e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| pC | uint256 | uint256 the percentage change in e18 |

### validatePortfolioValues

```solidity
function validatePortfolioValues(uint256 spotPrice, struct Types.PortfolioValues portfolioValues, uint256 maxTimeDeviationThreshold, uint256 maxPriceDeviationThreshold) public view
```

get the latest oracle fed portfolio values and check when they were last updated and make sure this is within a reasonable window in
	   terms of price and time

### getUtilizationPrice

```solidity
function getUtilizationPrice(uint256 _utilizationBefore, uint256 _utilizationAfter, uint256 _totalOptionPrice, uint256 _utilizationFunctionThreshold, uint256 _belowThresholdGradient, uint256 _aboveThresholdGradient, uint256 _aboveThresholdYIntercept) internal pure returns (uint256 utilizationPrice)
```

calculates the utilization price of an option using the liquidity pool's utilisation skew algorithm

### quotePriceGreeks

```solidity
function quotePriceGreeks(struct Types.OptionSeries optionSeries, bool isBuying, uint256 bidAskIVSpread, uint256 riskFreeRate, uint256 iv, uint256 underlyingPrice) internal view returns (uint256 quote, int256 delta)
```

get the greeks of a quotePrice for a given optionSeries

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | Types.OptionSeries struct for describing the option to price greeks - strike in e18 |
| isBuying | bool |  |
| bidAskIVSpread | uint256 |  |
| riskFreeRate | uint256 |  |
| iv | uint256 |  |
| underlyingPrice | uint256 |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| quote | uint256 | Quote price of the option - in e18 |
| delta | int256 | delta of the option being priced - in e18 |

## OpynInteractions

@title Library used for standard interactions with the opyn-rysk gamma protocol
  @dev inherited by the options registry to complete base opyn-rysk gamma protocol interactions
       Interacts with the opyn-rysk gamma protocol in all functions

### SCALE_FROM

```solidity
uint256 SCALE_FROM
```

### NoShort

```solidity
error NoShort()
```

### getOrDeployOtoken

```solidity
function getOrDeployOtoken(address oTokenFactory, address collateral, address underlying, address strikeAsset, uint256 strike, uint256 expiration, bool isPut) external returns (address)
```

Either retrieves the option token if it already exists, or deploy it

| Name | Type | Description |
| ---- | ---- | ----------- |
| oTokenFactory | address | is the address of the opyn oTokenFactory |
| collateral | address | asset that is held as collateral against short/written options |
| underlying | address | is the address of the underlying asset of the option |
| strikeAsset | address | is the address of the collateral asset of the option |
| strike | uint256 | is the strike price of the option in 1e8 format |
| expiration | uint256 | is the expiry timestamp of the option |
| isPut | bool | the type of option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### getOtoken

```solidity
function getOtoken(address oTokenFactory, address collateral, address underlying, address strikeAsset, uint256 strike, uint256 expiration, bool isPut) external view returns (address otokenFromFactory)
```

Retrieves the option token if it already exists

| Name | Type | Description |
| ---- | ---- | ----------- |
| oTokenFactory | address | is the address of the opyn oTokenFactory |
| collateral | address | asset that is held as collateral against short/written options |
| underlying | address | is the address of the underlying asset of the option |
| strikeAsset | address | is the address of the collateral asset of the option |
| strike | uint256 | is the strike price of the option in 1e8 format |
| expiration | uint256 | is the expiry timestamp of the option |
| isPut | bool | the type of option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| otokenFromFactory | address | the address of the option |

### createShort

```solidity
function createShort(address gammaController, address marginPool, address oTokenAddress, uint256 depositAmount, uint256 vaultId, uint256 amount, uint256 vaultType) external returns (uint256)
```

Creates the actual Opyn short position by depositing collateral and minting otokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| marginPool | address | is the address of the opyn margin contract which holds the collateral |
| oTokenAddress | address | is the address of the otoken to mint |
| depositAmount | uint256 | is the amount of collateral to deposit |
| vaultId | uint256 | is the vault id to use for creating this short |
| amount | uint256 | is the mint amount in 1e18 format |
| vaultType | uint256 | is the type of vault to be created |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the otoken mint amount |

### depositCollat

```solidity
function depositCollat(address gammaController, address marginPool, address collateralAsset, uint256 depositAmount, uint256 vaultId) external
```

Deposits Collateral to a specific vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| marginPool | address | is the address of the opyn margin contract which holds the collateral |
| collateralAsset | address | is the address of the collateral asset to deposit |
| depositAmount | uint256 | is the amount of collateral to deposit |
| vaultId | uint256 | is the vault id to access |

### withdrawCollat

```solidity
function withdrawCollat(address gammaController, address collateralAsset, uint256 withdrawAmount, uint256 vaultId) external
```

Withdraws Collateral from a specific vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| collateralAsset | address | is the address of the collateral asset to withdraw |
| withdrawAmount | uint256 | is the amount of collateral to withdraw |
| vaultId | uint256 | is the vault id to access |

### burnShort

```solidity
function burnShort(address gammaController, address oTokenAddress, uint256 burnAmount, uint256 vaultId) external returns (uint256)
```

Burns an opyn short position and returns collateral back to OptionRegistry

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| oTokenAddress | address | is the address of the otoken to burn |
| burnAmount | uint256 | is the amount of options to burn |
| vaultId | uint256 | is the vault id used that holds the short |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the collateral returned amount |

### settle

```solidity
function settle(address gammaController, uint256 vaultId) external returns (uint256 collateralRedeemed, uint256 collateralLost, uint256 shortAmount)
```

Close the existing short otoken position.

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| vaultId | uint256 | is the id of the vault to be settled |

| Name | Type | Description |
| ---- | ---- | ----------- |
| collateralRedeemed | uint256 | collateral redeemed from the vault |
| collateralLost | uint256 | collateral left behind in vault used to pay ITM expired options |
| shortAmount | uint256 | number of options that were written |

### redeem

```solidity
function redeem(address gammaController, address marginPool, address series, uint256 amount) external returns (uint256)
```

Exercises an ITM option

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| marginPool | address | is the address of the opyn margin pool |
| series | address | is the address of the option to redeem |
| amount | uint256 | is the number of oTokens to redeem - passed in as e8 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of asset received by exercising the option |

## SABR

### eps

```solidity
int256 eps
```

### IntermediateVariables

```solidity
struct IntermediateVariables {
  int256 a;
  int256 b;
  int256 c;
  int256 d;
  int256 v;
  int256 w;
  int256 z;
  int256 k;
  int256 f;
  int256 t;
}
```

### lognormalVol

```solidity
function lognormalVol(int256 k, int256 f, int256 t, int256 alpha, int256 beta, int256 rho, int256 volvol) internal pure returns (int256 iv)
```

### _logfk

```solidity
function _logfk(int256 f, int256 k) internal pure returns (int256)
```

### _fkbeta

```solidity
function _fkbeta(int256 f, int256 k, int256 beta) internal pure returns (int256)
```

### _x

```solidity
function _x(int256 rho, int256 z) internal pure returns (int256)
```

## SafeTransferLib

Safe ETH and ERC20 transfer library that gracefully handles missing return values.

_Use with caution! Some functions in this library knowingly create dirty bits at the destination of the free memory pointer._

### safeTransferETH

```solidity
function safeTransferETH(address to, uint256 amount) internal
```

### safeTransferFrom

```solidity
function safeTransferFrom(address tokenAddress, address from, address to, uint256 amount) internal
```

### safeTransfer

```solidity
function safeTransfer(contract ERC20 token, address to, uint256 amount) internal
```

### safeApprove

```solidity
function safeApprove(contract ERC20 token, address to, uint256 amount) internal
```

### didLastOptionalReturnCallSucceed

```solidity
function didLastOptionalReturnCallSucceed(bool callStatus) private pure returns (bool success)
```

## Types

### OptionSeries

```solidity
struct OptionSeries {
  uint64 expiration;
  uint128 strike;
  bool isPut;
  address underlying;
  address strikeAsset;
  address collateral;
}
```

### PortfolioValues

```solidity
struct PortfolioValues {
  int256 delta;
  int256 gamma;
  int256 vega;
  int256 theta;
  int256 callPutsValue;
  uint256 timestamp;
  uint256 spotPrice;
}
```

### Order

```solidity
struct Order {
  struct Types.OptionSeries optionSeries;
  uint256 amount;
  uint256 price;
  uint256 orderExpiry;
  address buyer;
  address seriesAddress;
  uint128 lowerSpotMovementRange;
  uint128 upperSpotMovementRange;
  bool isBuyBack;
}
```

### OptionParams

```solidity
struct OptionParams {
  uint128 minCallStrikePrice;
  uint128 maxCallStrikePrice;
  uint128 minPutStrikePrice;
  uint128 maxPutStrikePrice;
  uint128 minExpiry;
  uint128 maxExpiry;
}
```

### UtilizationState

```solidity
struct UtilizationState {
  uint256 totalOptionPrice;
  int256 totalDelta;
  uint256 collateralToAllocate;
  uint256 utilizationBefore;
  uint256 utilizationAfter;
  uint256 utilizationPrice;
  bool isDecreased;
  uint256 deltaTiltAmount;
  uint256 underlyingPrice;
  uint256 iv;
}
```

## ERC20

Modern and gas efficient ERC20 + EIP-2612 implementation.

_Do not manually set balances without updating totalSupply, as the sum of all user balances must not exceed it._

### Transfer

```solidity
event Transfer(address from, address to, uint256 amount)
```

### Approval

```solidity
event Approval(address owner, address spender, uint256 amount)
```

### name

```solidity
string name
```

### symbol

```solidity
string symbol
```

### decimals

```solidity
uint8 decimals
```

### totalSupply

```solidity
uint256 totalSupply
```

### balanceOf

```solidity
mapping(address => uint256) balanceOf
```

### allowance

```solidity
mapping(address => mapping(address => uint256)) allowance
```

### INITIAL_CHAIN_ID

```solidity
uint256 INITIAL_CHAIN_ID
```

### INITIAL_DOMAIN_SEPARATOR

```solidity
bytes32 INITIAL_DOMAIN_SEPARATOR
```

### nonces

```solidity
mapping(address => uint256) nonces
```

### constructor

```solidity
constructor(string _name, string _symbol, uint8 _decimals) internal
```

### approve

```solidity
function approve(address spender, uint256 amount) public virtual returns (bool)
```

### transfer

```solidity
function transfer(address to, uint256 amount) public virtual returns (bool)
```

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) public virtual returns (bool)
```

### permit

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public virtual
```

### DOMAIN_SEPARATOR

```solidity
function DOMAIN_SEPARATOR() public view virtual returns (bytes32)
```

### computeDomainSeparator

```solidity
function computeDomainSeparator() internal view virtual returns (bytes32)
```

### _mint

```solidity
function _mint(address to, uint256 amount) internal virtual
```

### _burn

```solidity
function _burn(address from, uint256 amount) internal virtual
```

## LiquidityPoolAdjustCollateralTest

### optionRegistry

```solidity
address optionRegistry
```

### usd

```solidity
address usd
```

### collateralAllocated

```solidity
uint256 collateralAllocated
```

### constructor

```solidity
constructor(address _optionRegistry, address _usd) public
```

### issue

```solidity
function issue(address underlying, address strikeAsset, uint64 expiration, bool isPut, uint128 strike, address collateral) external returns (address)
```

Either retrieves the option token if it already exists, or deploy it

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | is the address of the underlying asset of the option |
| strikeAsset | address | is the address of the collateral asset of the option |
| expiration | uint64 | is the expiry timestamp of the option |
| isPut | bool | the type of option |
| strike | uint128 | is the strike price of the option - 1e18 format |
| collateral | address | is the address of the asset to collateralize the option with |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### open

```solidity
function open(address _series, uint256 amount, uint256 collateralAmount) external returns (bool, uint256)
```

Open an options contract using collateral from the liquidity pool

_only callable by the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be created |
| amount | uint256 | the amount of options to deploy |
| collateralAmount | uint256 | the collateral required for the option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 | the amount of collateral taken from the liquidityPool |

### close

```solidity
function close(address _series, uint256 amount) external returns (bool, uint256)
```

Close an options contract (oToken) before it has expired

_only callable by the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be burnt |
| amount | uint256 | the amount of options to burn |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 |  |

### settle

```solidity
function settle(address _series) external returns (bool, uint256, uint256, uint256)
```

### adjustCollateral

```solidity
function adjustCollateral(uint256 lpCollateralDifference, bool addToLpBalance) external
```

adjust the collateral held in a specific vault because of health
    @param lpCollateralDifference amount of collateral taken from or given to the liquidity pool
    @param addToLpBalance true if collateral is returned to liquidity pool, false if collateral is withdrawn from liquidity pool

### getBalance

```solidity
function getBalance(address collateralAsset) external view returns (uint256)
```

### setCollateralAllocated

```solidity
function setCollateralAllocated(uint256 amount) external
```

## ReentrancyGuard

_Contract module that helps prevent reentrant calls to a function.

Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
available, which can be applied to functions to make sure there are no nested
(reentrant) calls to them.

Note that because there is a single `nonReentrant` guard, functions marked as
`nonReentrant` may not call one another. This can be worked around by making
those functions `private`, and then adding `external` `nonReentrant` entry
points to them.

TIP: If you would like to learn more about reentrancy and alternative ways
to protect against it, check out our blog post
https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul]._

### _NOT_ENTERED

```solidity
uint256 _NOT_ENTERED
```

### _ENTERED

```solidity
uint256 _ENTERED
```

### _status

```solidity
uint256 _status
```

### constructor

```solidity
constructor() public
```

### nonReentrant

```solidity
modifier nonReentrant()
```

_Prevents a contract from calling itself, directly or indirectly.
Calling a `nonReentrant` function from another `nonReentrant`
function is not supported. It is possible to prevent this from happening
by making the `nonReentrant` function external, and make it call a
`private` function that does the actual work._

## ZeroXExchangeInterface

_ZeroX Exchange contract interface._

### LimitOrder

```solidity
struct LimitOrder {
  address makerToken;
  address takerToken;
  uint128 makerAmount;
  uint128 takerAmount;
  uint128 takerTokenFeeAmount;
  address maker;
  address taker;
  address sender;
  address feeRecipient;
  bytes32 pool;
  uint64 expiry;
  uint256 salt;
}
```

### Signature

```solidity
struct Signature {
  uint8 signatureType;
  uint8 v;
  bytes32 r;
  bytes32 s;
}
```

### batchFillLimitOrders

```solidity
function batchFillLimitOrders(struct ZeroXExchangeInterface.LimitOrder[] orders, struct ZeroXExchangeInterface.Signature[] signatures, uint128[] takerTokenFillAmounts, bool revertIfIncomplete) external payable returns (uint128[] takerTokenFilledAmounts, uint128[] makerTokenFilledAmounts)
```

_Executes multiple calls of fillLimitOrder._

| Name | Type | Description |
| ---- | ---- | ----------- |
| orders | struct ZeroXExchangeInterface.LimitOrder[] | Array of order specifications. |
| signatures | struct ZeroXExchangeInterface.Signature[] | Array of proofs that orders have been created by makers. |
| takerTokenFillAmounts | uint128[] | Array of desired amounts of takerToken to sell in orders. |
| revertIfIncomplete | bool |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| takerTokenFilledAmounts | uint128[] | Array of amount of takerToken(s) filled. |
| makerTokenFilledAmounts | uint128[] | Array of amount of makerToken(s) filled. |

## WETH

### balanceOf

```solidity
function balanceOf(address ady) external returns (uint256)
```

### deposit

```solidity
function deposit() external payable
```

### approve

```solidity
function approve(address, uint256) external
```

### withdraw

```solidity
function withdraw(uint256 wad) external
```

### transfer

```solidity
function transfer(address dst, uint256 wad) external returns (bool)
```

### transferFrom

```solidity
function transferFrom(address src, address dst, uint256 wad) external returns (bool)
```

### Deposit

```solidity
event Deposit(address dst, uint256 wad)
```

### Withdrawal

```solidity
event Withdrawal(address src, uint256 wad)
```

## ForceSend

### go

```solidity
function go(address payable victim) external payable
```

## WETH

### name

```solidity
string name
```

### symbol

```solidity
string symbol
```

### decimals

```solidity
uint8 decimals
```

### Approval

```solidity
event Approval(address src, address guy, uint256 wad)
```

### Transfer

```solidity
event Transfer(address src, address dst, uint256 wad)
```

### Deposit

```solidity
event Deposit(address dst, uint256 wad)
```

### Withdrawal

```solidity
event Withdrawal(address src, uint256 wad)
```

### balanceOf

```solidity
mapping(address => uint256) balanceOf
```

### allowance

```solidity
mapping(address => mapping(address => uint256)) allowance
```

### deposit

```solidity
function deposit() public payable
```

### withdraw

```solidity
function withdraw(uint256 wad) public
```

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

### approve

```solidity
function approve(address guy, uint256 wad) public returns (bool)
```

### transfer

```solidity
function transfer(address dst, uint256 wad) public returns (bool)
```

### transferFrom

```solidity
function transferFrom(address src, address dst, uint256 wad) public returns (bool)
```

## MintableERC20

Modern and gas efficient ERC20 + EIP-2612 implementation.

_Do not manually set balances without updating totalSupply, as the sum of all user balances must not exceed it._

### Transfer

```solidity
event Transfer(address from, address to, uint256 amount)
```

### Approval

```solidity
event Approval(address owner, address spender, uint256 amount)
```

### name

```solidity
string name
```

### symbol

```solidity
string symbol
```

### decimals

```solidity
uint8 decimals
```

### totalSupply

```solidity
uint256 totalSupply
```

### balanceOf

```solidity
mapping(address => uint256) balanceOf
```

### allowance

```solidity
mapping(address => mapping(address => uint256)) allowance
```

### INITIAL_CHAIN_ID

```solidity
uint256 INITIAL_CHAIN_ID
```

### INITIAL_DOMAIN_SEPARATOR

```solidity
bytes32 INITIAL_DOMAIN_SEPARATOR
```

### nonces

```solidity
mapping(address => uint256) nonces
```

### constructor

```solidity
constructor(string _name, string _symbol, uint8 _decimals) internal
```

### approve

```solidity
function approve(address spender, uint256 amount) public virtual returns (bool)
```

### transfer

```solidity
function transfer(address to, uint256 amount) public virtual returns (bool)
```

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) public virtual returns (bool)
```

### permit

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public virtual
```

### DOMAIN_SEPARATOR

```solidity
function DOMAIN_SEPARATOR() public view virtual returns (bytes32)
```

### computeDomainSeparator

```solidity
function computeDomainSeparator() internal view virtual returns (bytes32)
```

### mint

```solidity
function mint(address to, uint256 amount) external returns (bool)
```

### _mint

```solidity
function _mint(address to, uint256 amount) internal virtual
```

### _burn

```solidity
function _burn(address from, uint256 amount) internal virtual
```

## WETH9Interface

### deposit

```solidity
function deposit() external payable
```

### withdraw

```solidity
function withdraw(uint256 wad) external
```

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### approve

```solidity
function approve(address guy, uint256 wad) external returns (bool)
```

### transfer

```solidity
function transfer(address dst, uint256 wad) external returns (bool)
```

### transferFrom

```solidity
function transferFrom(address src, address dst, uint256 wad) external returns (bool)
```

## Migrations

### owner

```solidity
address owner
```

### last_completed_migration

```solidity
uint256 last_completed_migration
```

### constructor

```solidity
constructor() public
```

### restricted

```solidity
modifier restricted()
```

### setCompleted

```solidity
function setCompleted(uint256 completed) public
```

## Accounting

@title Modular contract used by the liquidity pool to conducting accounting logic

### liquidityPool

```solidity
contract ILiquidityPool liquidityPool
```

immutable variables ///

### strikeAsset

```solidity
address strikeAsset
```

### underlyingAsset

```solidity
address underlyingAsset
```

### collateralAsset

```solidity
address collateralAsset
```

### MAX_BPS

```solidity
uint256 MAX_BPS
```

### constructor

```solidity
constructor(address _liquidityPool, address _strikeAsset, address _underlyingAsset, address _collateralAsset) public
```

### calculateTokenPrice

```solidity
function calculateTokenPrice(uint256 totalSupply, uint256 assets, int256 liabilities) internal view returns (uint256 tokenPrice)
```

calculates the USDC value of the Liquidity pool's ERC20 vault share token denominated in e6

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalSupply | uint256 | the total supply of the liquidity pool's erc20 |
| assets | uint256 | the value of assets held by the pool |
| liabilities | int256 | the value of liabilities held by the pool |

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenPrice | uint256 | the value of the token in e6 terms |

### deposit

```solidity
function deposit(address depositor, uint256 _amount) external view returns (uint256 depositAmount, uint256 unredeemedShares)
```

logic for adding liquidity to the options liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositor | address | the address making the deposit |
| _amount | uint256 | amount of the collateral asset to deposit |

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositAmount | uint256 | the amount to deposit from the round |
| unredeemedShares | uint256 | number of shares held in the deposit receipt that havent been redeemed |

### redeem

```solidity
function redeem(address redeemer, uint256 shares) external view returns (uint256 toRedeem, struct IAccounting.DepositReceipt)
```

logic for allowing a user to redeem their shares from a previous epoch

| Name | Type | Description |
| ---- | ---- | ----------- |
| redeemer | address | the address making the deposit |
| shares | uint256 | amount of the collateral asset to deposit |

| Name | Type | Description |
| ---- | ---- | ----------- |
| toRedeem | uint256 | the amount to actually redeem |
| [1] | struct IAccounting.DepositReceipt | depositReceipt the updated deposit receipt after the redeem has completed |

### initiateWithdraw

```solidity
function initiateWithdraw(address withdrawer, uint256 shares) external view returns (struct IAccounting.WithdrawalReceipt withdrawalReceipt)
```

logic for accounting a user to initiate a withdraw request from the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawer | address | the address carrying out the withdrawal |
| shares | uint256 | the amount of shares to withdraw for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawalReceipt | struct IAccounting.WithdrawalReceipt | the new withdrawal receipt to pass to the liquidityPool |

### completeWithdraw

```solidity
function completeWithdraw(address withdrawer, uint256 shares) external view returns (uint256 withdrawalAmount, uint256 withdrawalShares, struct IAccounting.WithdrawalReceipt withdrawalReceipt)
```

logic for accounting a user to complete a withdrawal

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawer | address | the address carrying out the withdrawal |
| shares | uint256 | the amount of shares to withdraw for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawalAmount | uint256 | the amount of collateral to withdraw |
| withdrawalShares | uint256 | the number of shares to withdraw |
| withdrawalReceipt | struct IAccounting.WithdrawalReceipt | the new withdrawal receipt to pass to the liquidityPool |

### executeEpochCalculation

```solidity
function executeEpochCalculation(uint256 totalSupply, uint256 assets, int256 liabilities) external view returns (uint256 newPricePerShareDeposit, uint256 newPricePerShareWithdrawal, uint256 sharesToMint, uint256 totalWithdrawAmount, uint256 amountNeeded)
```

execute the next epoch

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalSupply | uint256 | the total number of share tokens |
| assets | uint256 | the amount of collateral assets |
| liabilities | int256 | the amount of liabilities of the pool |

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPricePerShareDeposit | uint256 | the price per share for deposits |
| newPricePerShareWithdrawal | uint256 | the price per share for withdrawals |
| sharesToMint | uint256 | the number of shares to mint this epoch |
| totalWithdrawAmount | uint256 | the amount of collateral to set aside for partitioning |
| amountNeeded | uint256 | the amount needed to reach the total withdraw amount if collateral balance of lp is insufficient |

### sharesForAmount

```solidity
function sharesForAmount(uint256 _amount, uint256 assetPerShare) public view returns (uint256 shares)
```

get the number of shares for a given amount

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | the amount to convert to shares - assumed in collateral decimals |
| assetPerShare | uint256 | the amount of assets received per share |

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | the number of shares based on the amount - assumed in e18 |

### amountForShares

```solidity
function amountForShares(uint256 _shares, uint256 _assetPerShare) public view returns (uint256 amount)
```

get the amount for a given number of shares

| Name | Type | Description |
| ---- | ---- | ----------- |
| _shares | uint256 | the shares to convert to amount in e18 |
| _assetPerShare | uint256 | the amount of assets received per share |

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | the number of amount based on shares in collateral decimals |

## Authority

@title Contract used as the source of truth for all protocol authority and access control, based off of OlympusDao Access Control

### governor

```solidity
address governor
```

### guardian

```solidity
mapping(address => bool) guardian
```

### manager

```solidity
address manager
```

### newGovernor

```solidity
address newGovernor
```

### newManager

```solidity
address newManager
```

### constructor

```solidity
constructor(address _governor, address _guardian, address _manager) public
```

### pushGovernor

```solidity
function pushGovernor(address _newGovernor, bool _effectiveImmediately) external
```

### pushGuardian

```solidity
function pushGuardian(address _newGuardian) external
```

### pushManager

```solidity
function pushManager(address _newManager, bool _effectiveImmediately) external
```

### pullGovernor

```solidity
function pullGovernor() external
```

### revokeGuardian

```solidity
function revokeGuardian(address _guardian) external
```

### pullManager

```solidity
function pullManager() external
```

## PortfolioValuesFeed

An external adapter Consumer contract that makes requests to obtain portfolio values for different pools

_Interacts with the chainlink external adaptor for tracking portfolio values and the liquidityPool for feeding these values._

### portfolioValues

```solidity
mapping(address => mapping(address => struct Types.PortfolioValues)) portfolioValues
```

oracle settable variables ///

### jobId

```solidity
bytes32 jobId
```

govern settable variables ///

### fee

```solidity
uint256 fee
```

### link

```solidity
address link
```

### oracle

```solidity
address oracle
```

### liquidityPool

```solidity
contract ILiquidityPool liquidityPool
```

### stringedAddresses

```solidity
mapping(address => string) stringedAddresses
```

### keeper

```solidity
mapping(address => bool) keeper
```

### DataFullfilled

```solidity
event DataFullfilled(address underlying, address strike, int256 delta, int256 gamma, int256 vega, int256 theta, int256 callPutsValue)
```

events ///

### SetJobId

```solidity
event SetJobId(bytes32 jobId)
```

### SetFee

```solidity
event SetFee(uint256 fee)
```

### SetOracle

```solidity
event SetOracle(address oracle)
```

### SetLiquidityPool

```solidity
event SetLiquidityPool(address liquidityPool)
```

### SetAddressStringMapping

```solidity
event SetAddressStringMapping(address asset, string stringVersion)
```

### constructor

```solidity
constructor(address _oracle, string _jobId, uint256 _fee, address _link, address _authority) public
```

Executes once when a contract is created to initialize state variables

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oracle | address | - address of the specific Chainlink node that a contract makes an API call from |
| _jobId | string | - specific job for :_oracle: to run; each job is unique and returns different types of data |
| _fee | uint256 | - node operator price per API call / data request |
| _link | address | - LINK token address on the corresponding network |
| _authority | address |  |

### setjobId

```solidity
function setjobId(string _jobId) external
```

setters ///

### setFee

```solidity
function setFee(uint256 _fee) external
```

### setOracle

```solidity
function setOracle(address _oracle) external
```

### setLiquidityPool

```solidity
function setLiquidityPool(address _liquidityPool) external
```

### setAddressStringMapping

```solidity
function setAddressStringMapping(address _asset, string _stringVersion) external
```

### setLink

```solidity
function setLink(address _link) external
```

### setKeeper

```solidity
function setKeeper(address _keeper, bool _auth) external
```

change the status of a keeper

### fulfill

```solidity
function fulfill(bytes32 _requestId, address _underlying, address _strike, int256 _delta, int256 _gamma, int256 _vega, int256 _theta, int256 _callPutsValue, uint256 _spotPrice) external
```

Receives the response

| Name | Type | Description |
| ---- | ---- | ----------- |
| _requestId | bytes32 | - id of the request |
| _underlying | address | - response; underlying address |
| _strike | address | - response; strike address |
| _delta | int256 | - response; portfolio delta |
| _gamma | int256 | - response; portfolio gamma |
| _vega | int256 | - response; portfolio vega |
| _theta | int256 | - response; portfolio theta |
| _callPutsValue | int256 | - response; combined value of calls and puts written |
| _spotPrice | uint256 | - response; spot price at the time of update |

### withdrawLink

```solidity
function withdrawLink(uint256 _amount, address _target) external
```

Witdraws LINK from the contract

_Implement a withdraw function to avoid locking your LINK in the contract_

### requestPortfolioData

```solidity
function requestPortfolioData(address _underlying, address _strike) external returns (bytes32 requestId)
```

Creates a Chainlink request to update portfolio values
data, then multiply by 1000000000000000000 (to remove decimal places from data).

| Name | Type | Description |
| ---- | ---- | ----------- |
| requestId | bytes32 | - id of the request |

### getPortfolioValues

```solidity
function getPortfolioValues(address underlying, address strike) external view returns (struct Types.PortfolioValues)
```

non-complex getters ///

### _isKeeper

```solidity
function _isKeeper() internal view
```

_keepers, managers or governors can access_

### stringToBytes32

```solidity
function stringToBytes32(string source) private pure returns (bytes32 result)
```

internal helpers //

## PriceFeed

@title Contract used for accessing exchange rates using chainlink price feeds
 @dev Interacts with chainlink price feeds and services all contracts in the system for price data.

### priceFeeds

```solidity
mapping(address => mapping(address => address)) priceFeeds
```

governance settable variables ///

### SCALE_DECIMALS

```solidity
uint8 SCALE_DECIMALS
```

constant variables ///

### constructor

```solidity
constructor(address _authority) public
```

### addPriceFeed

```solidity
function addPriceFeed(address underlying, address strike, address feed) public
```

setters ///

### getRate

```solidity
function getRate(address underlying, address strike) external view returns (uint256)
```

complex getters ///

### getNormalizedRate

```solidity
function getNormalizedRate(address underlying, address strike) external view returns (uint256)
```

_get the rate from chainlink and convert it to e18 decimals_

## Protocol

@title Contract used for storage of important contracts for the liquidity pool

### optionRegistry

```solidity
address optionRegistry
```

static variables ///

### volatilityFeed

```solidity
address volatilityFeed
```

governance settable variables ///

### portfolioValuesFeed

```solidity
address portfolioValuesFeed
```

### accounting

```solidity
address accounting
```

### priceFeed

```solidity
address priceFeed
```

### constructor

```solidity
constructor(address _optionRegistry, address _priceFeed, address _volatilityFeed, address _portfolioValuesFeed, address _authority) public
```

### changeVolatilityFeed

```solidity
function changeVolatilityFeed(address _volFeed) external
```

setters ///

### changePortfolioValuesFeed

```solidity
function changePortfolioValuesFeed(address _portfolioValuesFeed) external
```

### changeAccounting

```solidity
function changeAccounting(address _accounting) external
```

### changePriceFeed

```solidity
function changePriceFeed(address _priceFeed) external
```

## VolatilityFeed

@title Contract used as the Dynamic Hedging Vault for storing funds, issuing shares and processing options transactions
 @dev Interacts with liquidity pool to feed in volatility data.

### sabrParams

```solidity
mapping(uint256 => struct VolatilityFeed.SABRParams) sabrParams
```

settable variables ///

### keeper

```solidity
mapping(address => bool) keeper
```

### ONE_YEAR_SECONDS

```solidity
int256 ONE_YEAR_SECONDS
```

constant variables ///

### BIPS_SCALE

```solidity
int256 BIPS_SCALE
```

### BIPS

```solidity
int256 BIPS
```

### SABRParams

```solidity
struct SABRParams {
  int32 callAlpha;
  int32 callBeta;
  int32 callRho;
  int32 callVolvol;
  int32 putAlpha;
  int32 putBeta;
  int32 putRho;
  int32 putVolvol;
}
```

### constructor

```solidity
constructor(address _authority) public
```

### AlphaError

```solidity
error AlphaError()
```

setters ///

### BetaError

```solidity
error BetaError()
```

### RhoError

```solidity
error RhoError()
```

### VolvolError

```solidity
error VolvolError()
```

### setSabrParameters

```solidity
function setSabrParameters(struct VolatilityFeed.SABRParams _sabrParams, uint256 _expiry) external
```

set the sabr volatility params

_only keepers can call this function_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sabrParams | struct VolatilityFeed.SABRParams | set the SABR parameters |
| _expiry | uint256 | the expiry that the SABR parameters represent |

### setKeeper

```solidity
function setKeeper(address _keeper, bool _auth) external
```

update the keepers

### getImpliedVolatility

```solidity
function getImpliedVolatility(bool isPut, uint256 underlyingPrice, uint256 strikePrice, uint256 expiration) external view returns (uint256)
```

get the current implied volatility from the feed

| Name | Type | Description |
| ---- | ---- | ----------- |
| isPut | bool | Is the option a call or put? |
| underlyingPrice | uint256 | The underlying price |
| strikePrice | uint256 | The strike price of the option |
| expiration | uint256 | expiration timestamp of option as a PRBMath Float |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Implied volatility adjusted for volatility surface |

### _isKeeper

```solidity
function _isKeeper() internal view
```

_keepers, managers or governors can access_

## PerpHedgingReactor

@title A hedging reactor that will manage delta by opening or closing short or long perp positions using rage trade
 @dev interacts with LiquidityPool via hedgeDelta, getDelta, getPoolDenominatedValue and withdraw,
      interacts with Rage Trade and chainlink via the change position, update and sync

### parentLiquidityPool

```solidity
address parentLiquidityPool
```

address of the parent liquidity pool contract

### priceFeed

```solidity
address priceFeed
```

address of the price feed used for getting asset prices

### collateralAsset

```solidity
address collateralAsset
```

collateralAsset used for collateralising the pool

### wETH

```solidity
address wETH
```

address of the wETH contract

### clearingHouse

```solidity
contract IClearingHouse clearingHouse
```

instance of the clearing house interface

### collateralId

```solidity
uint32 collateralId
```

collateralId to be used in the perp pool

### poolId

```solidity
uint32 poolId
```

poolId to be used in the perp pool

### accountId

```solidity
uint256 accountId
```

accountId for the perp pool

### internalDelta

```solidity
int256 internalDelta
```

delta of the pool

### keeper

```solidity
mapping(address => bool) keeper
```

address of the keeper of this pool

### healthFactor

```solidity
uint256 healthFactor
```

desired healthFactor of the pool

### syncOnChange

```solidity
bool syncOnChange
```

should change position also sync state

### MAX_UINT

```solidity
uint256 MAX_UINT
```

used for unlimited token approval

### MAX_BIPS

```solidity
uint256 MAX_BIPS
```

max bips

### ValueFailure

```solidity
error ValueFailure()
```

errors ///

### IncorrectCollateral

```solidity
error IncorrectCollateral()
```

### IncorrectDeltaChange

```solidity
error IncorrectDeltaChange()
```

### InvalidTransactionNotEnoughMargin

```solidity
error InvalidTransactionNotEnoughMargin(int256 accountMarketValue, int256 totalRequiredMargin)
```

### constructor

```solidity
constructor(address _clearingHouse, address _collateralAsset, address _wethAddress, address _parentLiquidityPool, uint32 _poolId, uint32 _collateralId, address _priceFeed, address _authority) public
```

### setHealthFactor

```solidity
function setHealthFactor(uint256 _healthFactor) external
```

update the health factor parameter

### setKeeper

```solidity
function setKeeper(address _keeper, bool _auth) external
```

update the keepers

### setSyncOnChange

```solidity
function setSyncOnChange(bool _syncOnChange) external
```

set whether changing a position should trigger a sync before updating

### initialiseReactor

```solidity
function initialiseReactor() external
```

function to deposit 1 wei of USDC into the margin account so that a margin account is made, cannot be
        be called if an account already exists

### hedgeDelta

```solidity
function hedgeDelta(int256 _delta) external returns (int256 deltaChange)
```

Execute a strategy to hedge delta exposure

| Name | Type | Description |
| ---- | ---- | ----------- |
| _delta | int256 |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| deltaChange | int256 | deltaChange The difference in delta exposure as a result of strategy execution |

### withdraw

```solidity
function withdraw(uint256 _amount) external returns (uint256)
```

Withdraw a given asset from the hedging reactor to the calling liquidity pool.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the amount actually withdrawn from the reactor denominated in the liquidity pool asset |

### syncAndUpdate

```solidity
function syncAndUpdate() external
```

function to poke the margin account to update the profits of the vault and also manage
        the collateral to safe bounds.

_only callable by a keeper_

### sync

```solidity
function sync() public
```

function to poke the margin account to update the profits of the vault

_only callable by a keeper_

### update

```solidity
function update() public returns (uint256)
```

Handle events such as collateralisation rebalancing

### getDelta

```solidity
function getDelta() external view returns (int256 delta)
```

Returns the delta exposure of the reactor

### getPoolDenominatedValue

```solidity
function getPoolDenominatedValue() external view returns (uint256 value)
```

Returns the value of the reactor denominated in the liquidity pool asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | the value of the reactor in the liquidity pool asset |

### checkVaultHealth

```solidity
function checkVaultHealth() external view returns (bool isBelowMin, bool isAboveMax, uint256 health, uint256 collatToTransfer)
```

function to check the health of the margin account
 @return isBelowMin is the margin below the health factor
 @return isAboveMax is the margin above the health factor
 @return health     the health factor of the account currently
 @return collatToTransfer the amount of collateral required to return the margin account back to the health factor

### _changePosition

```solidity
function _changePosition(int256 _amount) internal returns (int256)
```

function to change the perp position
        @param _amount the amount of position to open or close
        @return deltaChange The resulting difference in delta exposure

### _isKeeper

```solidity
function _isKeeper() internal view
```

_keepers, managers or governors can access_

## UniswapV3HedgingReactor

@title A hedging reactor that will manage delta by swapping between ETH and stablecoin spot assets on uniswap v3.
  @dev interacts with LiquidityPool via hedgeDelta, getDelta, getPoolDenominatedValue and withdraw,
       interacts with Uniswap V3 and chainlink via the swap functions

### parentLiquidityPool

```solidity
address parentLiquidityPool
```

address of the parent liquidity pool contract

### priceFeed

```solidity
address priceFeed
```

address of the price feed used for getting asset prices

### collateralAsset

```solidity
address collateralAsset
```

generalised list of stablecoin addresses to trade against wETH

### wETH

```solidity
address wETH
```

address of the wETH contract

### swapRouter

```solidity
contract ISwapRouter swapRouter
```

instance of the uniswap V3 router interface

### internalDelta

```solidity
int256 internalDelta
```

delta exposure of this reactor

### minAmount

```solidity
uint256 minAmount
```

limit to ensure we arent doing inefficient computation for dust amounts

### poolFee

```solidity
uint24 poolFee
```

uniswap v3 pool fee expressed at 10e6

### buySlippage

```solidity
uint16 buySlippage
```

slippage for buys

### sellSlippage

```solidity
uint16 sellSlippage
```

slippage for sells

### MAX_UINT

```solidity
uint256 MAX_UINT
```

used for unlimited token approval

### MAX_BPS

```solidity
uint256 MAX_BPS
```

max bips, representative of 100%

### constructor

```solidity
constructor(contract ISwapRouter _swapRouter, address _collateralAsset, address _wethAddress, address _parentLiquidityPool, uint24 _poolFee, address _priceFeed, address _authority) public
```

### changePoolFee

```solidity
function changePoolFee(uint24 _poolFee) external
```

update the uniswap v3 pool fee

### setMinAmount

```solidity
function setMinAmount(uint256 _minAmount) external
```

update the minAmount parameter

### setSlippage

```solidity
function setSlippage(uint16 _buySlippage, uint16 _sellSlippage) external
```

set slippage used for swaps on uniswap, to make sure that the trades have a managed slippage for frontrunning resistance

### hedgeDelta

```solidity
function hedgeDelta(int256 _delta) external returns (int256)
```

Execute a strategy to hedge delta exposure

| Name | Type | Description |
| ---- | ---- | ----------- |
| _delta | int256 |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 | deltaChange The difference in delta exposure as a result of strategy execution |

### withdraw

```solidity
function withdraw(uint256 _amount) external returns (uint256)
```

Withdraw a given asset from the hedging reactor to the calling liquidity pool.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the amount actually withdrawn from the reactor denominated in the liquidity pool asset |

### update

```solidity
function update() external pure returns (uint256)
```

Handle events such as collateralisation rebalancing

### getDelta

```solidity
function getDelta() external view returns (int256 delta)
```

Returns the delta exposure of the reactor

### getPoolDenominatedValue

```solidity
function getPoolDenominatedValue() external view returns (uint256 value)
```

Returns the value of the reactor denominated in the liquidity pool asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | the value of the reactor in the liquidity pool asset |

### _swapExactOutputSingle

```solidity
function _swapExactOutputSingle(uint256 _amountOut, uint256 _amountInMaximum, address _sellToken) internal returns (int256, uint256)
```

function to sell stablecoins for exact amount of wETH to increase delta
 @param _amountOut the exact amount of wETH to buy
 @param _amountInMaximum the max amount of stablecoin willing to spend. Slippage limit.
 @param _sellToken the stablecoin to sell

### _swapExactInputSingle

```solidity
function _swapExactInputSingle(uint256 _amountIn, uint256 _amountOutMinimum, address _buyToken) internal returns (int256, uint256)
```

function to sell exact amount of wETH to decrease delta
 @param _amountIn the exact amount of wETH to sell
 @param _amountOutMinimum the min amount of stablecoin willing to receive. Slippage limit.
 @param _buyToken the stablecoin to buy
 @return deltaChange The resulting difference in delta exposure

### getUnderlyingPrice

```solidity
function getUnderlyingPrice(address underlying, address _strikeAsset) internal view returns (uint256)
```

get the underlying price with just the underlying asset and strike asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | the asset that is used as the reference asset |
| _strikeAsset | address | the asset that the underlying value is denominated in |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the underlying price |

## AggregatorV3Interface

### decimals

```solidity
function decimals() external view returns (uint8)
```

### description

```solidity
function description() external view returns (string)
```

### version

```solidity
function version() external view returns (uint256)
```

### getRoundData

```solidity
function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

### latestRoundData

```solidity
function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

## GammaTypes

### Vault

```solidity
struct Vault {
  address[] shortOtokens;
  address[] longOtokens;
  address[] collateralAssets;
  uint256[] shortAmounts;
  uint256[] longAmounts;
  uint256[] collateralAmounts;
}
```

### VaultLiquidationDetails

```solidity
struct VaultLiquidationDetails {
  address series;
  uint128 shortAmount;
  uint128 collateralAmount;
}
```

## IOtoken

### underlyingAsset

```solidity
function underlyingAsset() external view returns (address)
```

### strikeAsset

```solidity
function strikeAsset() external view returns (address)
```

### collateralAsset

```solidity
function collateralAsset() external view returns (address)
```

### strikePrice

```solidity
function strikePrice() external view returns (uint256)
```

### expiryTimestamp

```solidity
function expiryTimestamp() external view returns (uint256)
```

### isPut

```solidity
function isPut() external view returns (bool)
```

## IOtokenFactory

### getOtoken

```solidity
function getOtoken(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external view returns (address)
```

### createOtoken

```solidity
function createOtoken(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external returns (address)
```

### getTargetOtokenAddress

```solidity
function getTargetOtokenAddress(address _underlyingAsset, address _strikeAsset, address _collateralAsset, uint256 _strikePrice, uint256 _expiry, bool _isPut) external view returns (address)
```

### OtokenCreated

```solidity
event OtokenCreated(address tokenAddress, address creator, address underlying, address strike, address collateral, uint256 strikePrice, uint256 expiry, bool isPut)
```

## IController

### ActionType

```solidity
enum ActionType {
  OpenVault,
  MintShortOption,
  BurnShortOption,
  DepositLongOption,
  WithdrawLongOption,
  DepositCollateral,
  WithdrawCollateral,
  SettleVault,
  Redeem,
  Call,
  Liquidate
}
```

### ActionArgs

```solidity
struct ActionArgs {
  enum IController.ActionType actionType;
  address owner;
  address secondAddress;
  address asset;
  uint256 vaultId;
  uint256 amount;
  uint256 index;
  bytes data;
}
```

### RedeemArgs

```solidity
struct RedeemArgs {
  address receiver;
  address otoken;
  uint256 amount;
}
```

### getPayout

```solidity
function getPayout(address _otoken, uint256 _amount) external view returns (uint256)
```

### operate

```solidity
function operate(struct IController.ActionArgs[] _actions) external
```

### getAccountVaultCounter

```solidity
function getAccountVaultCounter(address owner) external view returns (uint256)
```

### oracle

```solidity
function oracle() external view returns (address)
```

### getVault

```solidity
function getVault(address _owner, uint256 _vaultId) external view returns (struct GammaTypes.Vault)
```

### getProceed

```solidity
function getProceed(address _owner, uint256 _vaultId) external view returns (uint256)
```

### isSettlementAllowed

```solidity
function isSettlementAllowed(address _underlying, address _strike, address _collateral, uint256 _expiry) external view returns (bool)
```

### clearVaultLiquidationDetails

```solidity
function clearVaultLiquidationDetails(uint256 _vaultId) external
```

### getVaultLiquidationDetails

```solidity
function getVaultLiquidationDetails(address _owner, uint256 _vaultId) external view returns (address, uint256, uint256)
```

## IAccounting

### DepositReceipt

```solidity
struct DepositReceipt {
  uint128 epoch;
  uint128 amount;
  uint256 unredeemedShares;
}
```

### WithdrawalReceipt

```solidity
struct WithdrawalReceipt {
  uint128 epoch;
  uint128 shares;
}
```

### deposit

```solidity
function deposit(address depositor, uint256 _amount) external returns (uint256 depositAmount, uint256 unredeemedShares)
```

logic for adding liquidity to the options liquidity pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositor | address | the address making the deposit |
| _amount | uint256 | amount of the collateral asset to deposit |

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositAmount | uint256 | the amount to deposit from the round |
| unredeemedShares | uint256 | number of shares held in the deposit receipt that havent been redeemed |

### redeem

```solidity
function redeem(address redeemer, uint256 shares) external returns (uint256 toRedeem, struct IAccounting.DepositReceipt depositReceipt)
```

logic for allowing a user to redeem their shares from a previous epoch

| Name | Type | Description |
| ---- | ---- | ----------- |
| redeemer | address | the address making the deposit |
| shares | uint256 | amount of the collateral asset to deposit |

| Name | Type | Description |
| ---- | ---- | ----------- |
| toRedeem | uint256 | the amount to actually redeem |
| depositReceipt | struct IAccounting.DepositReceipt | the updated deposit receipt after the redeem has completed |

### initiateWithdraw

```solidity
function initiateWithdraw(address withdrawer, uint256 shares) external returns (struct IAccounting.WithdrawalReceipt withdrawalReceipt)
```

logic for accounting a user to initiate a withdraw request from the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawer | address | the address carrying out the withdrawal |
| shares | uint256 | the amount of shares to withdraw for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawalReceipt | struct IAccounting.WithdrawalReceipt | the new withdrawal receipt to pass to the liquidityPool |

### completeWithdraw

```solidity
function completeWithdraw(address withdrawer, uint256 shares) external returns (uint256 withdrawalAmount, uint256 withdrawalShares, struct IAccounting.WithdrawalReceipt withdrawalReceipt)
```

logic for accounting a user to complete a withdrawal

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawer | address | the address carrying out the withdrawal |
| shares | uint256 | the amount of shares to withdraw for |

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawalAmount | uint256 | the amount of collateral to withdraw |
| withdrawalShares | uint256 | the number of shares to withdraw |
| withdrawalReceipt | struct IAccounting.WithdrawalReceipt | the new withdrawal receipt to pass to the liquidityPool |

### executeEpochCalculation

```solidity
function executeEpochCalculation(uint256 totalSupply, uint256 assets, int256 liabilities) external view returns (uint256 newPricePerShareDeposit, uint256 newPricePerShareWithdrawal, uint256 sharesToMint, uint256 totalWithdrawAmount, uint256 amountNeeded)
```

execute the next epoch

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalSupply | uint256 | the total number of share tokens |
| assets | uint256 | the amount of collateral assets |
| liabilities | int256 | the amount of liabilities of the pool |

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPricePerShareDeposit | uint256 | the price per share for deposits |
| newPricePerShareWithdrawal | uint256 | the price per share for withdrawals |
| sharesToMint | uint256 | the number of shares to mint this epoch |
| totalWithdrawAmount | uint256 | the amount of collateral to set aside for partitioning |
| amountNeeded | uint256 | the amount needed to reach the total withdraw amount if collateral balance of lp is insufficient |

### sharesForAmount

```solidity
function sharesForAmount(uint256 _amount, uint256 assetPerShare) external view returns (uint256 shares)
```

get the number of shares for a given amount

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | the amount to convert to shares - assumed in collateral decimals |
| assetPerShare | uint256 | the amount of assets received per share |

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | the number of shares based on the amount - assumed in e18 |

## IAuthority

### GovernorPushed

```solidity
event GovernorPushed(address from, address to, bool _effectiveImmediately)
```

### GuardianPushed

```solidity
event GuardianPushed(address to, bool _effectiveImmediately)
```

### ManagerPushed

```solidity
event ManagerPushed(address from, address to, bool _effectiveImmediately)
```

### GovernorPulled

```solidity
event GovernorPulled(address from, address to)
```

### GuardianPulled

```solidity
event GuardianPulled(address to)
```

### ManagerPulled

```solidity
event ManagerPulled(address from, address to)
```

### governor

```solidity
function governor() external view returns (address)
```

### guardian

```solidity
function guardian(address _target) external view returns (bool)
```

### manager

```solidity
function manager() external view returns (address)
```

## IHedgingReactor

### hedgeDelta

```solidity
function hedgeDelta(int256 delta) external returns (int256)
```

Execute a strategy to hedge delta exposure

| Name | Type | Description |
| ---- | ---- | ----------- |
| delta | int256 | The exposure of the liquidity pool that the reactor needs to hedge against |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 | deltaChange The difference in delta exposure as a result of strategy execution |

### getDelta

```solidity
function getDelta() external view returns (int256 delta)
```

Returns the delta exposure of the reactor

### getPoolDenominatedValue

```solidity
function getPoolDenominatedValue() external view returns (uint256 value)
```

Returns the value of the reactor denominated in the liquidity pool asset

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | the value of the reactor in the liquidity pool asset |

### withdraw

```solidity
function withdraw(uint256 amount) external returns (uint256)
```

Withdraw a given asset from the hedging reactor to the calling liquidity pool.

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to withdraw |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the amount actually withdrawn from the reactor denominated in the liquidity pool asset |

### update

```solidity
function update() external returns (uint256)
```

Handle events such as collateralisation rebalancing

## ILiquidityPool

### strikeAsset

```solidity
function strikeAsset() external view returns (address)
```

immutable variables ///

### underlyingAsset

```solidity
function underlyingAsset() external view returns (address)
```

### collateralAsset

```solidity
function collateralAsset() external view returns (address)
```

### collateralAllocated

```solidity
function collateralAllocated() external view returns (uint256)
```

dynamic variables ///

### ephemeralLiabilities

```solidity
function ephemeralLiabilities() external view returns (int256)
```

### ephemeralDelta

```solidity
function ephemeralDelta() external view returns (int256)
```

### depositEpoch

```solidity
function depositEpoch() external view returns (uint256)
```

### withdrawalEpoch

```solidity
function withdrawalEpoch() external view returns (uint256)
```

### depositEpochPricePerShare

```solidity
function depositEpochPricePerShare(uint256 epoch) external view returns (uint256 price)
```

### withdrawalEpochPricePerShare

```solidity
function withdrawalEpochPricePerShare(uint256 epoch) external view returns (uint256 price)
```

### depositReceipts

```solidity
function depositReceipts(address depositor) external view returns (struct IAccounting.DepositReceipt)
```

### withdrawalReceipts

```solidity
function withdrawalReceipts(address withdrawer) external view returns (struct IAccounting.WithdrawalReceipt)
```

### pendingDeposits

```solidity
function pendingDeposits() external view returns (uint256)
```

### pendingWithdrawals

```solidity
function pendingWithdrawals() external view returns (uint256)
```

### partitionedFunds

```solidity
function partitionedFunds() external view returns (uint256)
```

### bufferPercentage

```solidity
function bufferPercentage() external view returns (uint256)
```

governance settable variables ///

### collateralCap

```solidity
function collateralCap() external view returns (uint256)
```

### handlerIssue

```solidity
function handlerIssue(struct Types.OptionSeries optionSeries) external returns (address)
```

functions ///

### resetEphemeralValues

```solidity
function resetEphemeralValues() external
```

### getAssets

```solidity
function getAssets() external view returns (uint256)
```

### redeem

```solidity
function redeem(uint256) external returns (uint256)
```

### handlerWriteOption

```solidity
function handlerWriteOption(struct Types.OptionSeries optionSeries, address seriesAddress, uint256 amount, contract IOptionRegistry optionRegistry, uint256 premium, int256 delta, address recipient) external returns (uint256)
```

### handlerBuybackOption

```solidity
function handlerBuybackOption(struct Types.OptionSeries optionSeries, uint256 amount, contract IOptionRegistry optionRegistry, address seriesAddress, uint256 premium, int256 delta, address seller) external returns (uint256)
```

### handlerIssueAndWriteOption

```solidity
function handlerIssueAndWriteOption(struct Types.OptionSeries optionSeries, uint256 amount, uint256 premium, int256 delta, address recipient) external returns (uint256, address)
```

### getPortfolioDelta

```solidity
function getPortfolioDelta() external view returns (int256)
```

### quotePriceWithUtilizationGreeks

```solidity
function quotePriceWithUtilizationGreeks(struct Types.OptionSeries optionSeries, uint256 amount, bool toBuy) external view returns (uint256 quote, int256 delta)
```

### checkBuffer

```solidity
function checkBuffer() external view returns (uint256 bufferRemaining)
```

### getBalance

```solidity
function getBalance(address asset) external view returns (uint256)
```

## IOptionRegistry

### issue

```solidity
function issue(struct Types.OptionSeries optionSeries) external returns (address)
```

Either retrieves the option token if it already exists, or deploy it

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | option series to issue |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### open

```solidity
function open(address _series, uint256 amount, uint256 collateralAmount) external returns (bool, uint256)
```

Open an options contract using collateral from the liquidity pool

_only callable by the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be created |
| amount | uint256 | the amount of options to deploy |
| collateralAmount | uint256 | the collateral required for the option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 | the amount of collateral taken from the liquidityPool |

### close

```solidity
function close(address _series, uint256 amount) external returns (bool, uint256)
```

Close an options contract (oToken) before it has expired

_only callable by the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be burnt |
| amount | uint256 | the amount of options to burn |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | if the transaction succeeded |
| [1] | uint256 |  |

### settle

```solidity
function settle(address _series) external returns (bool success, uint256 collatReturned, uint256 collatLost, uint256 amountShort)
```

Settle an options vault

_callable by anyone but returns funds to the liquidityPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _series | address | the address of the option token to be burnt |

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool | if the transaction succeeded |
| collatReturned | uint256 | the amount of collateral returned from the vault |
| collatLost | uint256 | the amount of collateral used to pay ITM options on vault settle |
| amountShort | uint256 | number of oTokens that the vault was short |

### getCollateral

```solidity
function getCollateral(struct Types.OptionSeries series, uint256 amount) external view returns (uint256)
```

Send collateral funds for an option to be minted

_series.strike should be scaled by 1e8._

| Name | Type | Description |
| ---- | ---- | ----------- |
| series | struct Types.OptionSeries | details of the option series |
| amount | uint256 | amount of options to mint |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount transferred |

### getOtoken

```solidity
function getOtoken(address underlying, address strikeAsset, uint256 expiration, bool isPut, uint256 strike, address collateral) external view returns (address)
```

Retrieves the option token if it exists

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlying | address | is the address of the underlying asset of the option |
| strikeAsset | address | is the address of the collateral asset of the option |
| expiration | uint256 | is the expiry timestamp of the option |
| isPut | bool | the type of option |
| strike | uint256 | is the strike price of the option - 1e18 format |
| collateral | address | is the address of the asset to collateralize the option with |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### getSeriesInfo

```solidity
function getSeriesInfo(address series) external view returns (struct Types.OptionSeries)
```

non-complex getters ///

### vaultIds

```solidity
function vaultIds(address series) external view returns (uint256)
```

### gammaController

```solidity
function gammaController() external view returns (address)
```

## I_ERC20

_Interface of the ERC20 standard as defined in the EIP._

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

_Returns the amount of tokens in existence._

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

_Returns the amount of tokens owned by `account`._

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from the caller's account to `recipient`.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

_Returns the remaining number of tokens that `spender` will be
allowed to spend on behalf of `owner` through {transferFrom}. This is
zero by default.

This value changes when {approve} or {transferFrom} are called._

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

_Sets `amount` as the allowance of `spender` over the caller's tokens.

Returns a boolean value indicating whether the operation succeeded.

IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender's allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

Emits an {Approval} event._

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from `sender` to `recipient` using the
allowance mechanism. `amount` is then deducted from the caller's
allowance.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

_Emitted when `value` tokens are moved from one account (`from`) to
another (`to`).

Note that `value` may be zero._

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

_Emitted when the allowance of a `spender` for an `owner` is set by
a call to {approve}. `value` is the new allowance._

## UNAUTHORIZED

```solidity
error UNAUTHORIZED()
```

## AccessControl

@title Contract used for access control functionality, based off of OlympusDao Access Control

### AuthorityUpdated

```solidity
event AuthorityUpdated(contract IAuthority authority)
```

### authority

```solidity
contract IAuthority authority
```

### constructor

```solidity
constructor(contract IAuthority _authority) internal
```

### setAuthority

```solidity
function setAuthority(contract IAuthority _newAuthority) external
```

### _onlyGovernor

```solidity
function _onlyGovernor() internal view
```

### _onlyGuardian

```solidity
function _onlyGuardian() internal view
```

### _onlyManager

```solidity
function _onlyManager() internal view
```

## BlackScholes

@title Library used to calculate an option price using Black Scholes

### ONE_YEAR_SECONDS

```solidity
uint256 ONE_YEAR_SECONDS
```

### ONE

```solidity
uint256 ONE
```

### TWO

```solidity
uint256 TWO
```

### Intermediates

```solidity
struct Intermediates {
  uint256 d1Denominator;
  int256 d1;
  int256 eToNegRT;
}
```

### callOptionPrice

```solidity
function callOptionPrice(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) public pure returns (uint256)
```

### callOptionPriceGreeks

```solidity
function callOptionPriceGreeks(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) public pure returns (uint256 quote, int256 delta)
```

### putOptionPriceGreeks

```solidity
function putOptionPriceGreeks(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) public pure returns (uint256 quote, int256 delta)
```

### putOptionPrice

```solidity
function putOptionPrice(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) public pure returns (uint256)
```

### getTimeStamp

```solidity
function getTimeStamp() private view returns (uint256)
```

### getD1

```solidity
function getD1(uint256 price, uint256 strike, uint256 time, uint256 vol, uint256 rfr) private pure returns (int256 d1, uint256 d1Denominator)
```

### getIntermediates

```solidity
function getIntermediates(uint256 price, uint256 strike, uint256 time, uint256 vol, uint256 rfr) private pure returns (struct BlackScholes.Intermediates)
```

### blackScholesCalc

```solidity
function blackScholesCalc(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) public view returns (uint256)
```

### blackScholesCalcGreeks

```solidity
function blackScholesCalcGreeks(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) public view returns (uint256 quote, int256 delta)
```

### getDelta

```solidity
function getDelta(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) public view returns (int256)
```

## CustomErrors

### NotKeeper

```solidity
error NotKeeper()
```

### IVNotFound

```solidity
error IVNotFound()
```

### NotHandler

```solidity
error NotHandler()
```

### InvalidPrice

```solidity
error InvalidPrice()
```

### InvalidBuyer

```solidity
error InvalidBuyer()
```

### InvalidOrder

```solidity
error InvalidOrder()
```

### OrderExpired

```solidity
error OrderExpired()
```

### InvalidAmount

```solidity
error InvalidAmount()
```

### TradingPaused

```solidity
error TradingPaused()
```

### IssuanceFailed

```solidity
error IssuanceFailed()
```

### EpochNotClosed

```solidity
error EpochNotClosed()
```

### TradingNotPaused

```solidity
error TradingNotPaused()
```

### NotLiquidityPool

```solidity
error NotLiquidityPool()
```

### DeltaNotDecreased

```solidity
error DeltaNotDecreased()
```

### NonExistentOtoken

```solidity
error NonExistentOtoken()
```

### OrderExpiryTooLong

```solidity
error OrderExpiryTooLong()
```

### InvalidShareAmount

```solidity
error InvalidShareAmount()
```

### ExistingWithdrawal

```solidity
error ExistingWithdrawal()
```

### TotalSupplyReached

```solidity
error TotalSupplyReached()
```

### StrikeAssetInvalid

```solidity
error StrikeAssetInvalid()
```

### OptionStrikeInvalid

```solidity
error OptionStrikeInvalid()
```

### OptionExpiryInvalid

```solidity
error OptionExpiryInvalid()
```

### NoExistingWithdrawal

```solidity
error NoExistingWithdrawal()
```

### SpotMovedBeyondRange

```solidity
error SpotMovedBeyondRange()
```

### CollateralAssetInvalid

```solidity
error CollateralAssetInvalid()
```

### UnderlyingAssetInvalid

```solidity
error UnderlyingAssetInvalid()
```

### CollateralAmountInvalid

```solidity
error CollateralAmountInvalid()
```

### WithdrawExceedsLiquidity

```solidity
error WithdrawExceedsLiquidity()
```

### InsufficientShareBalance

```solidity
error InsufficientShareBalance()
```

### MaxLiquidityBufferReached

```solidity
error MaxLiquidityBufferReached()
```

### LiabilitiesGreaterThanAssets

```solidity
error LiabilitiesGreaterThanAssets()
```

### CustomOrderInsufficientPrice

```solidity
error CustomOrderInsufficientPrice()
```

### CustomOrderInvalidDeltaValue

```solidity
error CustomOrderInvalidDeltaValue()
```

### DeltaQuoteError

```solidity
error DeltaQuoteError(uint256 quote, int256 delta)
```

### TimeDeltaExceedsThreshold

```solidity
error TimeDeltaExceedsThreshold(uint256 timeDelta)
```

### PriceDeltaExceedsThreshold

```solidity
error PriceDeltaExceedsThreshold(uint256 priceDelta)
```

### StrikeAmountExceedsLiquidity

```solidity
error StrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeLiquidity)
```

### MinStrikeAmountExceedsLiquidity

```solidity
error MinStrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeAmountMin)
```

### UnderlyingAmountExceedsLiquidity

```solidity
error UnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingLiquidity)
```

### MinUnderlyingAmountExceedsLiquidity

```solidity
error MinUnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingAmountMin)
```

## EnumerableSet

_Library for managing
https://en.wikipedia.org/wiki/Set_(abstract_data_type)[sets] of primitive
types.

Sets have the following properties:

- Elements are added, removed, and checked for existence in constant time
(O(1)).
- Elements are enumerated in O(n). No guarantees are made on the ordering.

```
contract Example {
    // Add the library methods
    using EnumerableSet for EnumerableSet.AddressSet;

    // Declare a set state variable
    EnumerableSet.AddressSet private mySet;
}
```

As of v3.3.0, sets of type `bytes32` (`Bytes32Set`), `address` (`AddressSet`)
and `uint256` (`UintSet`) are supported.

[WARNING]
====
 Trying to delete such a structure from storage will likely result in data corruption, rendering the structure unusable.
 See https://github.com/ethereum/solidity/pull/11843[ethereum/solidity#11843] for more info.

 In order to clean an EnumerableSet, you can either remove all elements one by one or create a fresh instance using an array of EnumerableSet.
====_

### Set

```solidity
struct Set {
  bytes32[] _values;
  mapping(bytes32 => uint256) _indexes;
}
```

### _add

```solidity
function _add(struct EnumerableSet.Set set, bytes32 value) private returns (bool)
```

_Add a value to a set. O(1).

Returns true if the value was added to the set, that is if it was not
already present._

### _remove

```solidity
function _remove(struct EnumerableSet.Set set, bytes32 value) private returns (bool)
```

_Removes a value from a set. O(1).

Returns true if the value was removed from the set, that is if it was
present._

### _contains

```solidity
function _contains(struct EnumerableSet.Set set, bytes32 value) private view returns (bool)
```

_Returns true if the value is in the set. O(1)._

### _length

```solidity
function _length(struct EnumerableSet.Set set) private view returns (uint256)
```

_Returns the number of values on the set. O(1)._

### _at

```solidity
function _at(struct EnumerableSet.Set set, uint256 index) private view returns (bytes32)
```

_Returns the value stored at position `index` in the set. O(1).

Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.

Requirements:

- `index` must be strictly less than {length}._

### _values

```solidity
function _values(struct EnumerableSet.Set set) private view returns (bytes32[])
```

_Return the entire set in an array

WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
this function has an unbounded cost, and using it as part of a state-changing function may render the function
uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block._

### AddressSet

```solidity
struct AddressSet {
  struct EnumerableSet.Set _inner;
}
```

### add

```solidity
function add(struct EnumerableSet.AddressSet set, address value) internal returns (bool)
```

_Add a value to a set. O(1).

Returns true if the value was added to the set, that is if it was not
already present._

### remove

```solidity
function remove(struct EnumerableSet.AddressSet set, address value) internal returns (bool)
```

_Removes a value from a set. O(1).

Returns true if the value was removed from the set, that is if it was
present._

### contains

```solidity
function contains(struct EnumerableSet.AddressSet set, address value) internal view returns (bool)
```

_Returns true if the value is in the set. O(1)._

### length

```solidity
function length(struct EnumerableSet.AddressSet set) internal view returns (uint256)
```

_Returns the number of values in the set. O(1)._

### at

```solidity
function at(struct EnumerableSet.AddressSet set, uint256 index) internal view returns (address)
```

_Returns the value stored at position `index` in the set. O(1).

Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.

Requirements:

- `index` must be strictly less than {length}._

### values

```solidity
function values(struct EnumerableSet.AddressSet set) internal view returns (address[])
```

_Return the entire set in an array

WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
this function has an unbounded cost, and using it as part of a state-changing function may render the function
uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block._

## NormalDist

@title Library used for approximating a normal distribution

### ONE

```solidity
int256 ONE
```

### ONE_HALF

```solidity
int256 ONE_HALF
```

### SQRT_TWO

```solidity
int256 SQRT_TWO
```

### A1

```solidity
int256 A1
```

### A2

```solidity
int256 A2
```

### A3

```solidity
int256 A3
```

### A4

```solidity
int256 A4
```

### A5

```solidity
int256 A5
```

### P

```solidity
int256 P
```

### cdf

```solidity
function cdf(int256 x) public pure returns (int256)
```

### phi

```solidity
function phi(int256 x) public pure returns (int256)
```

### getScoresFromT

```solidity
function getScoresFromT(int256 t) public pure returns (int256)
```

## OptionsCompute

@title Library used for various helper functionality for the Liquidity Pool

### SCALE_DECIMALS

```solidity
uint8 SCALE_DECIMALS
```

### convertToDecimals

```solidity
function convertToDecimals(uint256 value, uint256 decimals) internal pure returns (uint256)
```

_assumes decimals are coming in as e18_

### convertFromDecimals

```solidity
function convertFromDecimals(uint256 value, uint256 decimals) internal pure returns (uint256)
```

_converts from specified decimals to e18_

### convertToCollateralDenominated

```solidity
function convertToCollateralDenominated(uint256 quote, uint256 underlyingPrice, struct Types.OptionSeries optionSeries) internal pure returns (uint256 convertedQuote)
```

### calculatePercentageChange

```solidity
function calculatePercentageChange(uint256 n, uint256 o) internal pure returns (uint256 pC)
```

_computes the percentage change between two integers_

| Name | Type | Description |
| ---- | ---- | ----------- |
| n | uint256 | new value in e18 |
| o | uint256 | old value in e18 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| pC | uint256 | uint256 the percentage change in e18 |

### validatePortfolioValues

```solidity
function validatePortfolioValues(uint256 spotPrice, struct Types.PortfolioValues portfolioValues, uint256 maxTimeDeviationThreshold, uint256 maxPriceDeviationThreshold) public view
```

get the latest oracle fed portfolio values and check when they were last updated and make sure this is within a reasonable window in
	   terms of price and time

### getUtilizationPrice

```solidity
function getUtilizationPrice(uint256 _utilizationBefore, uint256 _utilizationAfter, uint256 _totalOptionPrice, uint256 _utilizationFunctionThreshold, uint256 _belowThresholdGradient, uint256 _aboveThresholdGradient, uint256 _aboveThresholdYIntercept) internal pure returns (uint256 utilizationPrice)
```

calculates the utilization price of an option using the liquidity pool's utilisation skew algorithm

### quotePriceGreeks

```solidity
function quotePriceGreeks(struct Types.OptionSeries optionSeries, bool isBuying, uint256 bidAskIVSpread, uint256 riskFreeRate, uint256 iv, uint256 underlyingPrice) internal view returns (uint256 quote, int256 delta)
```

get the greeks of a quotePrice for a given optionSeries

| Name | Type | Description |
| ---- | ---- | ----------- |
| optionSeries | struct Types.OptionSeries | Types.OptionSeries struct for describing the option to price greeks - strike in e18 |
| isBuying | bool |  |
| bidAskIVSpread | uint256 |  |
| riskFreeRate | uint256 |  |
| iv | uint256 |  |
| underlyingPrice | uint256 |  |

| Name | Type | Description |
| ---- | ---- | ----------- |
| quote | uint256 | Quote price of the option - in e18 |
| delta | int256 | delta of the option being priced - in e18 |

## OpynInteractions

@title Library used for standard interactions with the opyn-rysk gamma protocol
  @dev inherited by the options registry to complete base opyn-rysk gamma protocol interactions
       Interacts with the opyn-rysk gamma protocol in all functions

### SCALE_FROM

```solidity
uint256 SCALE_FROM
```

### NoShort

```solidity
error NoShort()
```

### getOrDeployOtoken

```solidity
function getOrDeployOtoken(address oTokenFactory, address collateral, address underlying, address strikeAsset, uint256 strike, uint256 expiration, bool isPut) external returns (address)
```

Either retrieves the option token if it already exists, or deploy it

| Name | Type | Description |
| ---- | ---- | ----------- |
| oTokenFactory | address | is the address of the opyn oTokenFactory |
| collateral | address | asset that is held as collateral against short/written options |
| underlying | address | is the address of the underlying asset of the option |
| strikeAsset | address | is the address of the collateral asset of the option |
| strike | uint256 | is the strike price of the option in 1e8 format |
| expiration | uint256 | is the expiry timestamp of the option |
| isPut | bool | the type of option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | the address of the option |

### getOtoken

```solidity
function getOtoken(address oTokenFactory, address collateral, address underlying, address strikeAsset, uint256 strike, uint256 expiration, bool isPut) external view returns (address otokenFromFactory)
```

Retrieves the option token if it already exists

| Name | Type | Description |
| ---- | ---- | ----------- |
| oTokenFactory | address | is the address of the opyn oTokenFactory |
| collateral | address | asset that is held as collateral against short/written options |
| underlying | address | is the address of the underlying asset of the option |
| strikeAsset | address | is the address of the collateral asset of the option |
| strike | uint256 | is the strike price of the option in 1e8 format |
| expiration | uint256 | is the expiry timestamp of the option |
| isPut | bool | the type of option |

| Name | Type | Description |
| ---- | ---- | ----------- |
| otokenFromFactory | address | the address of the option |

### createShort

```solidity
function createShort(address gammaController, address marginPool, address oTokenAddress, uint256 depositAmount, uint256 vaultId, uint256 amount, uint256 vaultType) external returns (uint256)
```

Creates the actual Opyn short position by depositing collateral and minting otokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| marginPool | address | is the address of the opyn margin contract which holds the collateral |
| oTokenAddress | address | is the address of the otoken to mint |
| depositAmount | uint256 | is the amount of collateral to deposit |
| vaultId | uint256 | is the vault id to use for creating this short |
| amount | uint256 | is the mint amount in 1e18 format |
| vaultType | uint256 | is the type of vault to be created |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the otoken mint amount |

### depositCollat

```solidity
function depositCollat(address gammaController, address marginPool, address collateralAsset, uint256 depositAmount, uint256 vaultId) external
```

Deposits Collateral to a specific vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| marginPool | address | is the address of the opyn margin contract which holds the collateral |
| collateralAsset | address | is the address of the collateral asset to deposit |
| depositAmount | uint256 | is the amount of collateral to deposit |
| vaultId | uint256 | is the vault id to access |

### withdrawCollat

```solidity
function withdrawCollat(address gammaController, address collateralAsset, uint256 withdrawAmount, uint256 vaultId) external
```

Withdraws Collateral from a specific vault

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| collateralAsset | address | is the address of the collateral asset to withdraw |
| withdrawAmount | uint256 | is the amount of collateral to withdraw |
| vaultId | uint256 | is the vault id to access |

### burnShort

```solidity
function burnShort(address gammaController, address oTokenAddress, uint256 burnAmount, uint256 vaultId) external returns (uint256)
```

Burns an opyn short position and returns collateral back to OptionRegistry

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| oTokenAddress | address | is the address of the otoken to burn |
| burnAmount | uint256 | is the amount of options to burn |
| vaultId | uint256 | is the vault id used that holds the short |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the collateral returned amount |

### settle

```solidity
function settle(address gammaController, uint256 vaultId) external returns (uint256 collateralRedeemed, uint256 collateralLost, uint256 shortAmount)
```

Close the existing short otoken position.

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| vaultId | uint256 | is the id of the vault to be settled |

| Name | Type | Description |
| ---- | ---- | ----------- |
| collateralRedeemed | uint256 | collateral redeemed from the vault |
| collateralLost | uint256 | collateral left behind in vault used to pay ITM expired options |
| shortAmount | uint256 | number of options that were written |

### redeem

```solidity
function redeem(address gammaController, address marginPool, address series, uint256 amount) external returns (uint256)
```

Exercises an ITM option

| Name | Type | Description |
| ---- | ---- | ----------- |
| gammaController | address | is the address of the opyn controller contract |
| marginPool | address | is the address of the opyn margin pool |
| series | address | is the address of the option to redeem |
| amount | uint256 | is the number of oTokens to redeem - passed in as e8 |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of asset received by exercising the option |

## SABR

### eps

```solidity
int256 eps
```

### IntermediateVariables

```solidity
struct IntermediateVariables {
  int256 a;
  int256 b;
  int256 c;
  int256 d;
  int256 v;
  int256 w;
  int256 z;
  int256 k;
  int256 f;
  int256 t;
}
```

### lognormalVol

```solidity
function lognormalVol(int256 k, int256 f, int256 t, int256 alpha, int256 beta, int256 rho, int256 volvol) internal pure returns (int256 iv)
```

### _logfk

```solidity
function _logfk(int256 f, int256 k) internal pure returns (int256)
```

### _fkbeta

```solidity
function _fkbeta(int256 f, int256 k, int256 beta) internal pure returns (int256)
```

### _x

```solidity
function _x(int256 rho, int256 z) internal pure returns (int256)
```

## SafeTransferLib

Safe ETH and ERC20 transfer library that gracefully handles missing return values.

_Use with caution! Some functions in this library knowingly create dirty bits at the destination of the free memory pointer._

### safeTransferETH

```solidity
function safeTransferETH(address to, uint256 amount) internal
```

### safeTransferFrom

```solidity
function safeTransferFrom(address tokenAddress, address from, address to, uint256 amount) internal
```

### safeTransfer

```solidity
function safeTransfer(contract ERC20 token, address to, uint256 amount) internal
```

### safeApprove

```solidity
function safeApprove(contract ERC20 token, address to, uint256 amount) internal
```

### didLastOptionalReturnCallSucceed

```solidity
function didLastOptionalReturnCallSucceed(bool callStatus) private pure returns (bool success)
```

## Types

### OptionSeries

```solidity
struct OptionSeries {
  uint64 expiration;
  uint128 strike;
  bool isPut;
  address underlying;
  address strikeAsset;
  address collateral;
}
```

### PortfolioValues

```solidity
struct PortfolioValues {
  int256 delta;
  int256 gamma;
  int256 vega;
  int256 theta;
  int256 callPutsValue;
  uint256 timestamp;
  uint256 spotPrice;
}
```

### Order

```solidity
struct Order {
  struct Types.OptionSeries optionSeries;
  uint256 amount;
  uint256 price;
  uint256 orderExpiry;
  address buyer;
  address seriesAddress;
  uint128 lowerSpotMovementRange;
  uint128 upperSpotMovementRange;
  bool isBuyBack;
}
```

### OptionParams

```solidity
struct OptionParams {
  uint128 minCallStrikePrice;
  uint128 maxCallStrikePrice;
  uint128 minPutStrikePrice;
  uint128 maxPutStrikePrice;
  uint128 minExpiry;
  uint128 maxExpiry;
}
```

### UtilizationState

```solidity
struct UtilizationState {
  uint256 totalOptionPrice;
  int256 totalDelta;
  uint256 collateralToAllocate;
  uint256 utilizationBefore;
  uint256 utilizationAfter;
  uint256 utilizationPrice;
  bool isDecreased;
  uint256 deltaTiltAmount;
  uint256 underlyingPrice;
  uint256 iv;
}
```

## MockPortfolioValuesFeed

An external adapter Consumer contract that makes requests to obtain portfolio values for different pools
        SHOULD NOT BE USED IN PRODUCTION

### oracle

```solidity
address oracle
```

immutable variables ///

### jobId

```solidity
bytes32 jobId
```

### fee

```solidity
uint256 fee
```

### link

```solidity
address link
```

### portfolioValues

```solidity
mapping(address => mapping(address => struct Types.PortfolioValues)) portfolioValues
```

oracle settable variables ///

### liquidityPool

```solidity
contract ILiquidityPool liquidityPool
```

govern settable variables ///

### stringedAddresses

```solidity
mapping(address => string) stringedAddresses
```

### keeper

```solidity
mapping(address => bool) keeper
```

### DataFullfilled

```solidity
event DataFullfilled(address underlying, address strike, int256 delta, int256 gamma, int256 vega, int256 theta, int256 callPutsValue)
```

events ///

### constructor

```solidity
constructor(address _oracle, bytes32 _jobId, uint256 _fee, address _link, address _authority) public
```

Executes once when a contract is created to initialize state variables

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oracle | address | - address of the specific Chainlink node that a contract makes an API call from |
| _jobId | bytes32 | - specific job for :_oracle: to run; each job is unique and returns different types of data |
| _fee | uint256 | - node operator price per API call / data request |
| _link | address | - LINK token address on the corresponding network |
| _authority | address |  |

### setLiquidityPool

```solidity
function setLiquidityPool(address _liquidityPool) external
```

setters ///

### setAddressStringMapping

```solidity
function setAddressStringMapping(address _asset, string _stringVersion) external
```

### setKeeper

```solidity
function setKeeper(address _keeper, bool _auth) external
```

change the status of a keeper

### fulfill

```solidity
function fulfill(bytes32 _requestId, address _underlying, address _strike, int256 _delta, int256 _gamma, int256 _vega, int256 _theta, int256 _callPutsValue, uint256 _spotPrice) external
```

Receives the response

| Name | Type | Description |
| ---- | ---- | ----------- |
| _requestId | bytes32 | - id of the request |
| _underlying | address | - response; underlying address |
| _strike | address | - response; strike address |
| _delta | int256 | - response; portfolio delta |
| _gamma | int256 | - response; portfolio gamma |
| _vega | int256 | - response; portfolio vega |
| _theta | int256 | - response; portfolio theta |
| _callPutsValue | int256 | - response; combined value of calls and puts written |
| _spotPrice | uint256 | - response; spot price at the time of update |

### withdrawLink

```solidity
function withdrawLink(uint256 _amount, address _target) external
```

Witdraws LINK from the contract

_Implement a withdraw function to avoid locking your LINK in the contract_

### requestPortfolioData

```solidity
function requestPortfolioData(address _underlying, address _strike) external returns (bytes32 requestId)
```

Creates a Chainlink request to update portfolio values
data, then multiply by 1000000000000000000 (to remove decimal places from data).

| Name | Type | Description |
| ---- | ---- | ----------- |
| requestId | bytes32 | - id of the request |

### getPortfolioValues

```solidity
function getPortfolioValues(address underlying, address strike) external view returns (struct Types.PortfolioValues)
```

non-complex getters ///

### _isKeeper

```solidity
function _isKeeper() internal view
```

_keepers, managers or governors can access_

## ERC20

Modern and gas efficient ERC20 + EIP-2612 implementation.

_Do not manually set balances without updating totalSupply, as the sum of all user balances must not exceed it._

### Transfer

```solidity
event Transfer(address from, address to, uint256 amount)
```

### Approval

```solidity
event Approval(address owner, address spender, uint256 amount)
```

### name

```solidity
string name
```

### symbol

```solidity
string symbol
```

### decimals

```solidity
uint8 decimals
```

### totalSupply

```solidity
uint256 totalSupply
```

### balanceOf

```solidity
mapping(address => uint256) balanceOf
```

### allowance

```solidity
mapping(address => mapping(address => uint256)) allowance
```

### INITIAL_CHAIN_ID

```solidity
uint256 INITIAL_CHAIN_ID
```

### INITIAL_DOMAIN_SEPARATOR

```solidity
bytes32 INITIAL_DOMAIN_SEPARATOR
```

### nonces

```solidity
mapping(address => uint256) nonces
```

### constructor

```solidity
constructor(string _name, string _symbol, uint8 _decimals) internal
```

### approve

```solidity
function approve(address spender, uint256 amount) public virtual returns (bool)
```

### transfer

```solidity
function transfer(address to, uint256 amount) public virtual returns (bool)
```

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) public virtual returns (bool)
```

### permit

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public virtual
```

### DOMAIN_SEPARATOR

```solidity
function DOMAIN_SEPARATOR() public view virtual returns (bytes32)
```

### computeDomainSeparator

```solidity
function computeDomainSeparator() internal view virtual returns (bytes32)
```

### _mint

```solidity
function _mint(address to, uint256 amount) internal virtual
```

### _burn

```solidity
function _burn(address from, uint256 amount) internal virtual
```

## NormalDist

@title Library used for approximating a normal distribution

### ONE

```solidity
int256 ONE
```

### ONE_HALF

```solidity
int256 ONE_HALF
```

### SQRT_TWO

```solidity
int256 SQRT_TWO
```

### A1

```solidity
int256 A1
```

### A2

```solidity
int256 A2
```

### A3

```solidity
int256 A3
```

### A4

```solidity
int256 A4
```

### A5

```solidity
int256 A5
```

### P

```solidity
int256 P
```

### cdf

```solidity
function cdf(int256 x) internal pure returns (int256)
```

### phi

```solidity
function phi(int256 x) internal pure returns (int256)
```

### getScoresFromT

```solidity
function getScoresFromT(int256 t) internal pure returns (int256)
```

## BlackScholes

@title Library used to calculate an option price using Black Scholes

### ONE_YEAR_SECONDS

```solidity
uint256 ONE_YEAR_SECONDS
```

### ONE

```solidity
uint256 ONE
```

### TWO

```solidity
uint256 TWO
```

### Intermediates

```solidity
struct Intermediates {
  uint256 d1Denominator;
  int256 d1;
  int256 eToNegRT;
}
```

### callOptionPrice

```solidity
function callOptionPrice(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) internal pure returns (uint256)
```

### callOptionPriceGreeks

```solidity
function callOptionPriceGreeks(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) internal pure returns (uint256 quote, int256 delta)
```

### putOptionPriceGreeks

```solidity
function putOptionPriceGreeks(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) internal pure returns (uint256 quote, int256 delta)
```

### putOptionPrice

```solidity
function putOptionPrice(int256 d1, int256 d1Denominator, int256 price, int256 strike, int256 eToNegRT) internal pure returns (uint256)
```

### getTimeStamp

```solidity
function getTimeStamp() private view returns (uint256)
```

### getD1

```solidity
function getD1(uint256 price, uint256 strike, uint256 time, uint256 vol, uint256 rfr) private pure returns (int256 d1, uint256 d1Denominator)
```

### getIntermediates

```solidity
function getIntermediates(uint256 price, uint256 strike, uint256 time, uint256 vol, uint256 rfr) private pure returns (struct BlackScholes.Intermediates)
```

### blackScholesCalc

```solidity
function blackScholesCalc(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) internal view returns (uint256)
```

### blackScholesCalcGreeks

```solidity
function blackScholesCalcGreeks(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) internal view returns (uint256 quote, int256 delta)
```

### getDelta

```solidity
function getDelta(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) internal view returns (int256)
```

## BlackScholesTest

### retBlackScholesCalc

```solidity
function retBlackScholesCalc(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) public view returns (uint256)
```

### getDelta

```solidity
function getDelta(uint256 price, uint256 strike, uint256 expiration, uint256 vol, uint256 rfr, bool isPut) public view returns (int256)
```

## OracleMock

### priceX128

```solidity
uint256 priceX128
```

### constructor

```solidity
constructor() public
```

### getTwapPriceX128

```solidity
function getTwapPriceX128(uint32) external view returns (uint256)
```

### getTwapSqrtPriceX96

```solidity
function getTwapSqrtPriceX96(uint32) external view returns (uint160 sqrtPriceX96)
```

### setSqrtPriceX96

```solidity
function setSqrtPriceX96(uint160 _sqrtPriceX96) public
```

### setPriceX128

```solidity
function setPriceX128(uint256 _priceX128) public
```

## PerpHedgingTest

### perpHedgingReactor

```solidity
address perpHedgingReactor
```

### MAX_UINT

```solidity
uint256 MAX_UINT
```

### setHedgingReactorAddress

```solidity
function setHedgingReactorAddress(address _address) public
```

### hedgeDelta

```solidity
function hedgeDelta(int256 _delta) public returns (int256 deltaChange)
```

### getDelta

```solidity
function getDelta() public view returns (int256 delta)
```

### withdraw

```solidity
function withdraw(uint256 _amount) public returns (uint256)
```

### update

```solidity
function update() public returns (uint256)
```

### sync

```solidity
function sync() public
```

### syncAndUpdate

```solidity
function syncAndUpdate() public
```

### getBalance

```solidity
function getBalance(address collateralAsset) public view returns (uint256)
```

## RealTokenMock

### constructor

```solidity
constructor() public
```

## ReentrancyGuard

_Contract module that helps prevent reentrant calls to a function.

Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
available, which can be applied to functions to make sure there are no nested
(reentrant) calls to them.

Note that because there is a single `nonReentrant` guard, functions marked as
`nonReentrant` may not call one another. This can be worked around by making
those functions `private`, and then adding `external` `nonReentrant` entry
points to them.

TIP: If you would like to learn more about reentrancy and alternative ways
to protect against it, check out our blog post
https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul]._

### _NOT_ENTERED

```solidity
uint256 _NOT_ENTERED
```

### _ENTERED

```solidity
uint256 _ENTERED
```

### _status

```solidity
uint256 _status
```

### constructor

```solidity
constructor() public
```

### nonReentrant

```solidity
modifier nonReentrant()
```

_Prevents a contract from calling itself, directly or indirectly.
Calling a `nonReentrant` function from another `nonReentrant`
function is not supported. It is possible to prevent this from happening
by making the `nonReentrant` function external, and make it call a
`private` function that does the actual work._

## UniswapV3HedgingTest

### uniswapV3HedgingReactor

```solidity
address uniswapV3HedgingReactor
```

### MAX_UINT

```solidity
uint256 MAX_UINT
```

### setHedgingReactorAddress

```solidity
function setHedgingReactorAddress(address _address) public
```

### hedgeDelta

```solidity
function hedgeDelta(int256 _delta) public returns (int256 deltaChange)
```

### getDelta

```solidity
function getDelta() public view returns (int256 delta)
```

### withdraw

```solidity
function withdraw(uint256 _amount) public returns (uint256)
```

### update

```solidity
function update() public returns (uint256)
```

### getBalance

```solidity
function getBalance(address collateralAsset) public view returns (uint256)
```

## Volatility

### computeIVFromSkewInts

```solidity
function computeIVFromSkewInts(int256[7] coef, int256[2] points) public pure returns (int256)
```

### computeIVFromSkew

```solidity
function computeIVFromSkew(int256[7] coef, int256[2] points) internal pure returns (int256)
```

## IERC20

_Interface of the ERC20 standard as defined in the EIP._

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

_Returns the amount of tokens in existence._

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

_Returns the amount of tokens owned by `account`._

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from the caller's account to `recipient`.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

_Returns the remaining number of tokens that `spender` will be
allowed to spend on behalf of `owner` through {transferFrom}. This is
zero by default.

This value changes when {approve} or {transferFrom} are called._

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

_Sets `amount` as the allowance of `spender` over the caller's tokens.

Returns a boolean value indicating whether the operation succeeded.

IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender's allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

Emits an {Approval} event._

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

_Moves `amount` tokens from `sender` to `recipient` using the
allowance mechanism. `amount` is then deducted from the caller's
allowance.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

_Emitted when `value` tokens are moved from one account (`from`) to
another (`to`).

Note that `value` may be zero._

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

_Emitted when the allowance of a `spender` for an `owner` is set by
a call to {approve}. `value` is the new allowance._

## MockChainlinkAggregator

Chainlink oracle mock

### decimals

```solidity
uint256 decimals
```

### roundTimestamp

```solidity
mapping(uint256 => uint256) roundTimestamp
```

_mock for round timestmap_

### roundAnswer

```solidity
mapping(uint256 => int256) roundAnswer
```

_mock for round price_

### lastAnswer

```solidity
int256 lastAnswer
```

### getRoundData

```solidity
function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

### latestRoundData

```solidity
function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```

### setRoundTimestamp

```solidity
function setRoundTimestamp(uint256 _roundId) external
```

_function to mock setting round timestamp_

### setRoundAnswer

```solidity
function setRoundAnswer(uint256 _roundId, int256 _answer) external
```

_function to mock setting round timestamp_

### setLatestAnswer

```solidity
function setLatestAnswer(int256 _answer) external
```

