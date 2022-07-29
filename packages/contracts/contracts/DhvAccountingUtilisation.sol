// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";

import "./libraries/OptionsCompute.sol";
import "./tokens/ERC20.sol";
import "hardhat/console.sol";

/**
 *  @title Modular contract used by the liquidity pool to calculate the value of its ERC20 ault token
 *  @dev Has a main external function, calculateTokenPrice() which will be called by the liquidity pool
 *  each time the token value is needed.
 */
contract DhvAccountingUtilisation {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;

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
		uint256 assets,
		uint256 liabilities,
		uint256 collateralAllocated,
		uint256 pendingDeposits
	) external returns (uint256 tokenPrice) {
		uint256 tokenPriceInitial = totalSupply > 0
			? (1e18 *
				((assets - liabilities) -
					OptionsCompute.convertFromDecimals(pendingDeposits, ERC20(collateralAsset).decimals()))) /
				totalSupply
			: 1e18;
		// collateralAllocated needs to be converted to e18
		tokenPrice = _utilizationPremium(tokenPriceInitial, (10**12 * collateralAllocated).div(assets));
		console.log(tokenPriceInitial, tokenPrice, (10**12 * collateralAllocated).div(assets));
	}

	function _utilizationPremium(uint256 tokenPrice, uint256 utilization)
		internal
		returns (
			// pure
			uint256 utilizationTokenPrice
		)
	{
		console.log("tokenPrice:", tokenPrice, "utilization:", utilization);
		return tokenPrice.mul(1e18 - (utilization.powu(8)).mul(1e18 / 8));
	}
}
