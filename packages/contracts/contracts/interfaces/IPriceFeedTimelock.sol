// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

interface IPriceFeedTimelock {
	function admin() external view returns (address);

	function setIsSecondaryPriceEnabled(address _priceFeed, bool _isEnabled) external;

	function signalPriceFeedSetTokenConfig(
		address _vaultPriceFeed,
		address _token,
		address _priceFeed,
		uint256 _priceDecimals,
		bool _isStrictStable
	) external;

	function priceFeedSetTokenConfig(
		address _vaultPriceFeed,
		address _token,
		address _priceFeed,
		uint256 _priceDecimals,
		bool _isStrictStable
	) external;
}
