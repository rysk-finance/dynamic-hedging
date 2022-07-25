// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./libraries/OptionsCompute.sol";
import "./tokens/ERC20.sol";

/**
 *  @title Modular contract used by the liquidity pool to calculate the value of its ERC20 ault token
 *  @dev Has a main external function, calculateTokenPrice() which will be called by the liquidity pool
 *  each time the token value is needed.
 */
contract DhvTokenCalculations {
	// asset that denominates the strike price
	address public immutable strikeAsset;
	// asset that is used as the reference asset
	address public immutable underlyingAsset;
	// asset that is used for collateral asset
	address public immutable collateralAsset;

	constructor(
		address _strikeAsset,
		address _underlyingAsset,
		address _collateralAsset
	) {
		strikeAsset = _strikeAsset;
		underlyingAsset = _underlyingAsset;
		collateralAsset = _collateralAsset;
	}

	/*
	 * @notice calculates the USDC value of the Liquidity pool's ERC20 vault share token denominated in e6
	 */
	function calculateTokenPrice(
		uint256 totalSupply,
		uint256 NAV,
		uint256 pendingDeposits
	) external view returns (uint256 tokenPrice) {
		uint256 newPricePerShare = totalSupply > 0
			? (1e18 *
				(NAV -
					OptionsCompute.convertFromDecimals(pendingDeposits, ERC20(collateralAsset).decimals()))) /
				totalSupply
			: 1e18;
	}
}
