#!/bin/bash

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
./types/DHVLensMK1.ts \
../front-end/src/types/

# Clean out the ABIs directory.
rm -rf ../front-end/src/abis/*

### ABI ###

# Copy only the required ABIs from artifacts dir.
# Copy them as JSON and as TS variables.
for FILE_NAME in 'LiquidityPool' 'AlphaOptionHandler' 'OptionRegistry' 'AlphaPortfolioValuesFeed' 'PriceFeed' 'OptionExchange' 'OptionCatalogue' 'BeyondPricer'
do
    ABI=$(jq --indent 4 --tab '.abi' ./artifacts/contracts/$FILE_NAME.sol/$FILE_NAME.json)

    echo "$ABI" > ../front-end/src/abis/$FILE_NAME.json

    echo "export const ${FILE_NAME}ABI = $ABI as const;" \
    > ../front-end/src/abis/${FILE_NAME}_ABI.ts
done

# Copy lens contract ABIs.
for FILE_NAME in 'DHVLensMK1'
do
    ABI=$(jq --indent 4 --tab '.abi' ./artifacts/contracts/lens/$FILE_NAME.sol/$FILE_NAME.json)

    echo "$ABI" > ../front-end/src/abis/$FILE_NAME.json

    echo "export const ${FILE_NAME}ABI = $ABI as const;" \
    > ../front-end/src/abis/${FILE_NAME}_ABI.ts
done

# Copy ABIs from abis dir.
for FILE_NAME in 'erc20'
do
    ABI=$(jq --indent 4 --tab '.' ./abis/$FILE_NAME.json)

    echo "$ABI" > ../front-end/src/abis/$FILE_NAME.json

    echo "export const ${FILE_NAME}ABI = $ABI as const;" \
    > ../front-end/src/abis/${FILE_NAME}_ABI.ts
done

# Copy Opyn package ABIs from artifacts dir.
for ABI_PATH in 'new/NewController/NewController' 'core/Oracle/Oracle' 'new/NewCalculator/NewMarginCalculator'
do
    IFS='/'

    read -a ABI_PATH_ARR <<< "$ABI_PATH"

    ABI=$(jq --indent 4 --tab '.abi' ./artifacts/contracts/packages/opyn/${ABI_PATH_ARR[0]}/${ABI_PATH_ARR[1]}.sol/${ABI_PATH_ARR[2]}.json)

    echo "$ABI" > ../front-end/src/abis/${ABI_PATH_ARR[2]}.json

    echo "export const ${ABI_PATH_ARR[2]}ABI = $ABI as const;" \
    > ../front-end/src/abis/${ABI_PATH_ARR[2]}_ABI.ts
done
