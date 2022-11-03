// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

interface IWhitelist {
    /* View functions */

    function addressBook() external view returns (address);

    function isWhitelistedProduct(
        address _underlying,
        address _strike,
        address _collateral,
        bool _isPut
    ) external view returns (bool);

    function isWhitelistedCollateral(address _collateral) external view returns (bool);

    function isCoveredWhitelistedCollateral(
        address _collateral,
        address _underlying,
        bool _isPut
    ) external view returns (bool);

    function isNakedWhitelistedCollateral(
        address _collateral,
        address _underlying,
        bool _isPut
    ) external view returns (bool);

    function isWhitelistedOtoken(address _otoken) external view returns (bool);

}
