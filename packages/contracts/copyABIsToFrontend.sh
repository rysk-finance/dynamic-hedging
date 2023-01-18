# Clean out the types directory.
rm -rf ../front-end/src/types/*

# Copy only the required types.
cp \
./types/common.ts \
./types/ERC20.ts \
./types/LiquidityPool.ts \
./types/OptionRegistry.ts \
./types/PortfolioValuesFeed.ts \
./types/PriceFeed.ts \
../front-end/src/types/