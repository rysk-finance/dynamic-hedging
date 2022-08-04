# Rysk Alpha Technical Primer

Rysk alpha is a simplified version of the full Rysk DHV AMM, it is intended as a stepping stone towards the fully automated version. 

It simplifies the protocol in two primary ways: 
- Removal of automated options purchases and instead focuses on OTC options purchases (meaning no need for on demand portfolio valuation, more manageable risk management, more predictable flow and more manageable pricing)
- Removal of the oracle as the method for valuation of the book instead opting for a "for loop" approach, this is possible because the options owned by the pool is no longer potentially unbounded.

For full details see: 

## `AlphaOptionHandler.sol` - this will describe major changes from `OptionHandler.sol`

- `issueAndWriteOption`, `issue`, `writeOption` and `buybackOption` all removed.
- In `executeOrder` all checks on the price and delta against the pool's pricing model are removed, instead a spot price check is added.
- In `executeOrder` the details of the option minted are pushed to the `AlphaPortfolioValuesFeed` in order to make sure that the option purchase is recorded.

### ```executeOrder(orderId) external ``` ***Direct NonTrustedAccessible***

This function gets a custom order using a orderId, this will revert if the sender is not the authorised buyer of the order. First the spot price will be checked against the customOrderBounds to make sure there hasnt been a big spot price move. If the order falls outside any of the allowed bounds then the transaction will revert. If all conditions are met then the option will be minted to the buyer. At the end of the transaction the order is invalidated.

### ```executeBuyBackOrder(orderId) external ``` ***Direct NonTrustedAccessible***

This function gets a custom order using a orderId, this will revert if the sender is not the authorised buyer of the order. First the spot price will be checked against the customOrderBounds to make sure there hasnt been a big spot price move. If the order falls outside any of the allowed bounds then the transaction will revert. If all conditions are met then the option will be burned and usdc will be returned to the buyer. At the end of the transaction the order is invalidated.

### ```executeStrangle(orderId1, orderId2) external ``` ***Direct NonTrustedAccessible***

This function executes two order executions and is intended for use with a strangle.

### ``` createOrder() external onlyRole```

This function creates a custom option order receipt which contains the option series, the amount, the price at which the order is settled at, the time after which the custom order expires and the authorised buyer of the custom order. This is managed by a manager and governance and is used for large market orders with participants such as market makers. This returns an orderId which is used by the market participant to access their custom order in executeOrder. Create order also requires passing in whether the order is a buyback or not.

### ``` createStrangle() external onlyRole```

This function creates two custom orders, one put order and one call order. This is so delta neutral positions can be sold to certain market participants.
### e

## Use of `LiquidityPool.sol`

- Pricing functions are not used in rysk alpha. These are however left in the protocol so that they may be used in the future.

## `AlphaPortfolioValuesFeed.sol`

### `fulfill(address underlying, address strikeAsset) external` *No Access Control*

This function is responsible for doing the calculation for determining the portfolio delta and portfolio valuation. It achieves this by storing all the addresses of series held by the liquidityPool in an addressSet where each address is a key to a mapping that contains details on the option position [option series (with strike in e18) and amount in e18], then looping over all of these and computing the delta and value of each one, then finally summing those to form the portfolio delta and value. The amount incremented is the netExposure (shortExposure - longExposure)


It works by looping through the `addressSet` then searching the `storesForAddress` mapping using the address of the loop. It first checks that the series being calculated has expired, if it has expired the fulfill will revert (the revert will also provide the address and index that it reverted at), what this indicates is that the oToken vault needs to be settled or redeemed and then removed from the loop via `syncLooper` or `cleanLooperManually`. This is done to prevent any miscalculated values of the pool due to expired options, since valuations are done manually and infrequently, this is reasonable to do. After that the volatility is determined from the `VolatilityFeed` and the black scholes delta and value of the option of the loop is determined. These values then increment the portfolioValues. Once the loop is complete, the delta and `portfolioValues` are pushed to storage.


### `updateStores(Types.OptionSeries _optionSeries, int256 shortExposure, int256 longExposure, address _seriesAddress)` *Only Accessible by handlers*

Update stores is the function that tells the Portfolio values feed any new positions that the liquidity pool has taken on. Then the `addressSet` is checked for `_seriesAddress`, if it already exists then just increment the stores of that series by the signedAmount, otherwise add it to the `addressSet` and store the option details in `storesForAddress[_seriesAddress]`.

An EnumerableSet.AddressSet by OpenZeppelin is used as it is easier to clean and much easier to search through.

Update stores can theoretically be pushed to by any set of contracts, meaning that a buyside products could also be used and could share the same liquidityPool liquidity and be represented by the same portfolio. Long exposure and short exposure are updated seperately and they are ints so that reducing positions is easily done via `updateStores`.

### `syncLooper() external` *Only Accessible by keeper or above*

This function is used to clean out the addressSet of expired options, the purpose being to keep the addressSet at the optimal size and to remove any expired options that might disrupt the valuation calculations.

It loops through the addressSet, if it finds any options that have expired then it adds it to another list, after looping through the addressSet. This new list is then looped through and each option is deleted from the addressSet and has its stores cleaned.

**WARNING: A current danger of this function is that options that have not been settled but are settlable could be removed from the loop, this could result in incorrect counting of the option values. *Thinking through ideas of how to fix this and open to ideas***

### `cleanLooperManually() external` *Only Accessible by keeper or above*

This function is used to clean out the addressSet of expired options, the purpose being to keep the addressSet at the optimal size and to remove any expired options that might disrupt the valuation calculations.

This is a more manual process, it takes an address and an index. It checks the addressSet at that index. It compares it to the address given, if they are the same then it checks if the option has expired, if it has then it removes the option.

**WARNING: A current danger of this function is that options that have not been settled but are settlable could be removed from the loop, this could result in incorrect counting of the option values. *Thinking through ideas of how to fix this and open to ideas***

### `accountLiquidatedSeries(addressseries) external` *Only Accessible by keeper or above*

This function is used to fix accounting in the stores if a series gets liquidated. This is mostly here to deal with the edge case that a vault does get liquidated. It first checks that the series exists in the stores then it checks that the stores have short exposure, if it does then it will check for the vault id in the option registry, if it exists then we know the liquidity pool had this position. Then in order to match the records of that vault we set the stores to the e18 version of the short amount in that opyn vault, the reason we do not set it to 0 is because partial liquidations are possible. This function would NEED to be called when a liquidation has occured so should be managed by a bot, however it is likely that guardian protocols would have kicked in if a liquidation has occured (protocol has paused).

### `migrate(_migrateContract) external` *Only Accessible by Governance*

This function is used to migrate all stored options data in one PortfolioValuesFeed to a new contract that has the IPortfolioValuesFeed interface. This is done if an update needs to be made to the PortfolioValuesFeed. (We as a team are not comfortable with using proxy solutions that achieve the same outcome)

Clear migration instructions are provided here:

	////////////////////////////////////////////////////////////////////////////////////////////
	/**  MIGRATION PROCESS - FOR ALPHA
	  *	  1/ On the migrate contract set this contract as a handler via Governance
	  *   2/ Make sure the storage of options in this contract is up to date and clean/synced
	  *   3/ Call migrate here via Governance 
	  *   3i/ If the migration gas gets too big then
	  *   4/ Make sure the storage was correctly transferred to the new contract
	  *   5/ Properly configure the handlers on the new contract via Governance
	  *   6/ Properly configure the keepers on the new contract via Governance
	  *   7/ Set the liquidity pool on the new contract via Governance
	  *   8/ Change the PortfolioValuesFeed in the Protocol contract via Governance
      */ 
	////////////////////////////////////////////////////////////////////////////////////////////