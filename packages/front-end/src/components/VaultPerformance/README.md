# Vault performance chart component

The vault performance chart is made up of a series of subcomponents with a single graph query at the top. This query accesses the `pricePerShares` graph data, skipping the first two entries. This is because the first two epochs were used for testing and pre-public launch.

An effect in the main `VaultPerformance` component handles adjusting each of the epoch nodes by deducting the growth percentage at the third epoch from each subsequent epoch. This allows us to display chart data from the public launch, corrected as if the third epoch were zero percent.
