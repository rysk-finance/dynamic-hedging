// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.9;

import { BlackScholes } from "../libraries/BlackScholes.sol";
import { Types } from "../libraries/Types.sol";

contract BlackScholesTest {
	function retBlackScholesCalc(
		uint256 price,
		uint256 strike,
		uint256 expiration,
		uint256 vol,
		uint256 rfr,
		bool isPut
	) public view returns (uint256) {
		return BlackScholes.blackScholesCalc(price, strike, expiration, vol, rfr, isPut);
	}

	function getDelta(
		uint256 price,
		uint256 strike,
		uint256 expiration,
		uint256 vol,
		uint256 rfr,
		bool isPut
	) public view returns (int256) {
		return BlackScholes.getDelta(price, strike, expiration, vol, rfr, isPut);
	}
}
