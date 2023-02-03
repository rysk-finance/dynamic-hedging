# To run this script you will need jq installed.
# https://stedolan.github.io/jq/download/

### TYPE ###

# Clean out the types directory.
rm -rf ../front-end/src/types/*

# Copy only the required types.
cp \
./types/common.ts \
./types/ERC20.ts \
./types/LiquidityPool.ts \
./types/OptionRegistry.ts \
./types/AlphaPortfolioValuesFeed.ts \
./types/PriceFeed.ts \
./types/OptionExchange.ts \
./types/OptionCatalogue.ts \
./types/BeyondPricer.ts \
../front-end/src/types/

# Clean out the ABIs directory.
rm -rf ../front-end/src/abis/*

### ABI ###

# Copy only the required ABIs from artifacts dir.
for FILE_NAME in 'LiquidityPool' 'AlphaOptionHandler' 'OptionRegistry' 'AlphaPortfolioValuesFeed' 'PriceFeed' 'OptionExchange' 'OptionCatalogue' 'BeyondPricer'
do
    jq --indent 4 --tab '.abi' \
    ./artifacts/contracts/$FILE_NAME.sol/$FILE_NAME.json \
    > ../front-end/src/abis/$FILE_NAME.json
done

# Copy package ABIs from artifacts dir.
jq --indent 4 --tab '.abi' \
./artifacts/contracts/packages/opyn/new/NewController.sol/NewController.json \
> ../front-end/src/abis/OpynController.json

# Copy ABIs from abis dir.
for FILE_NAME in 'erc20'
do
    jq --indent 4 --tab '.' \
    ./abis/$FILE_NAME.json \
    > ../front-end/src/abis/$FILE_NAME.json
done
