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

        struct Order {
            OptionSeries optionSeries;
            uint256 amount;
            uint256 price;
            uint256 orderExpiry;
            address buyer;
            address seriesAddress;
        }
}
