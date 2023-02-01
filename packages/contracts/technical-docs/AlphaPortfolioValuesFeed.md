## `AlphaPortfolioValuesFeed.sol`

### `fulfill(address underlying, address strikeAsset) external` *No Access Control*

This function is responsible for doing the calculation for determining the portfolio delta and portfolio valuation. It achieves this by storing all the addresses of series held by the liquidityPool in an addressSet where each address is a key to a mapping that contains details on the option position [option series (with strike in e18) and amount in e18], then looping over all of these and computing the delta and value of each one, then finally summing those to form the portfolio delta and value. The amount incremented is the netExposure (shortExposure - longExposure).


It works by looping through the `addressSet` then searching the `storesForAddress` mapping using the address of the loop. It first checks that the series being calculated has expired, if it has expired the fulfill will revert (the revert will also provide the address and index that it reverted at), what this indicates is that the oToken vault needs to be settled or redeemed and then removed from the loop via `syncLooper` or `cleanLooperManually`. This is done to prevent any miscalculated values of the pool due to expired options, since valuations are done manually and infrequently, this is reasonable to do. After that the volatility is determined from the `VolatilityFeed` and the black scholes delta and value of the option of the loop is determined. These values then increment the portfolioValues. Once the loop is complete, the delta and `portfolioValues` are pushed to storage.


### `updateStores(Types.OptionSeries _optionSeries, int256 shortExposure, int256 longExposure, address _seriesAddress)` *Only Accessible by handlers*

Update stores is the function that tells the Portfolio values feed any new positions that the liquidity pool has taken on. Then the `addressSet` is checked for `_seriesAddress`, if it already exists then just increment the stores of that series by the signedAmount, otherwise add it to the `addressSet` and store the option details in `storesForAddress[_seriesAddress]`.

An EnumerableSet.AddressSet by OpenZeppelin is used as it is easier to clean and much easier to search through.

Update stores can theoretically be pushed to by any set of contracts, meaning that a buyside products could also be used and could share the same liquidityPool liquidity and be represented by the same portfolio. Long exposure and short exposure are updated seperately and they are ints so that reducing positions is easily done via `updateStores`.

The netdhvexposure is also stored this represents a running count of the exposure of a given option (collateral is not used as part of the option hash (same option hash as OptionCatalogue) as unlike the stores, we want to know exposure of an option regardless of collateral, whereas stores cares about the collateral of the option series). The netdhvexposure including the change cannot exceed the maxNetDhvExposure which is a governance settable limit.

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