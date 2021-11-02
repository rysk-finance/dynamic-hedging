pragma solidity >=0.8.9;


library Types {
    // We use "flavor" because type is a reserved word in many programming languages
    enum Flavor {
        Call,
        Put
    }

    struct OptionSeries {
        uint expiration;
        Flavor flavor;
        uint strike;
        address underlying;
        address strikeAsset;
    }

    function isCall(Flavor _flavor) internal pure returns (bool) {
        return _flavor == Flavor.Call;
    }
}
