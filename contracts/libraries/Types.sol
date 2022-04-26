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
}
