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
            uint256 delta;
            uint256 gamma;
            uint256 vega;
            uint256 theta;
            uint256 callPutsValue;
            uint256 timestamp;
            uint256 spotPrice;
        }

        struct Order {
            OptionSeries optionSeries;
            uint128 premiums;
            uint128 orderExpiry;
            address buyer;
        }
}
