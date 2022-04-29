pragma solidity >=0.8.9;


library Types {
        struct OptionSeries {
            uint expiration;
            bool isPut;
            uint strike;
            address underlying;
            address strikeAsset;
            address collateral;
        }

        struct PortfolioValues {
            int256 delta;
            int256 gamma;
            int256 vega;
            int256 theta;
            uint256 callPutsValue;
            uint256 timestamp;
            uint256 spotPrice;
        }

        struct Order {
            OptionSeries optionSeries;
            uint256 amount;
            uint256 price;
            uint256 orderExpiry;
            address buyer;
            address seriesAddress;
        }
        // delta and price boundaries for custom orders
        struct CustomOrderBounds {
            uint128 callMinDelta;     // call delta will always be between 0 and 1 (e18)
            uint128 callMaxDelta;     // call delta will always be between 0 and 1 (e18)
            int128 putMinDelta;       // put delta will always be between 0 and -1 (e18)
            int128 putMaxDelta;       // put delta will always be between 0 and -1 (e18)
            // maxPriceRange is the maximum percentage below the LP calculated price,
            // measured in BPS, that the order may be sold for. 10% would mean maxPriceRange = 1000
            uint32 maxPriceRange;
        }
        // strike and expiry date range for options
        struct OptionParams {
            uint128 minCallStrikePrice;
            uint128 maxCallStrikePrice;
            uint128 minPutStrikePrice;
            uint128 maxPutStrikePrice;
            uint128 minExpiry;
            uint128 maxExpiry;
        }
        struct UtilizationState {
            uint optionPrice;
            uint utilizationPrice;
            bool isDecreased;
            uint deltaTiltFactor;
        }
        struct WeightedOptionValues {
            uint totalAmountCall;
            uint totalAmountPut;
            uint weightedStrikeCall;
            uint weightedStrikePut;
            uint weightedTimeCall;
            uint weightedTimePut;
        }

}
