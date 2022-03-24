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
            uint128 amount;
            uint128 price;
            uint128 orderExpiry;
            address buyer;
        }
}
