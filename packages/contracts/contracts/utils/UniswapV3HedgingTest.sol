// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.9;

import { IHedgingReactor } from "../interfaces/IHedgingReactor.sol";
import { ERC20 } from "../tokens/ERC20.sol";
import "../libraries/SafeTransferLib.sol";

contract UniswapV3HedgingTest {
	address public uniswapV3HedgingReactor;
	uint256 private constant MAX_UINT = 2**256 - 1;

	function setHedgingReactorAddress(address _address) public {
		uniswapV3HedgingReactor = _address;
		SafeTransferLib.safeApprove(
			ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48),
			_address,
			MAX_UINT
		);
	}

	function setHedgingReactorAddressAndToken(address _address, address _tokenAddress) public {
		uniswapV3HedgingReactor = _address;
		SafeTransferLib.safeApprove(
			ERC20(_tokenAddress),
			_address,
			MAX_UINT
		);
	}

	function hedgeDelta(int256 _delta) public returns (int256 deltaChange) {
		return IHedgingReactor(uniswapV3HedgingReactor).hedgeDelta(_delta);
	}

	function getDelta() public view returns (int256 delta) {
		return IHedgingReactor(uniswapV3HedgingReactor).getDelta();
	}

	function withdraw(uint256 _amount) public returns (uint256) {
		return IHedgingReactor(uniswapV3HedgingReactor).withdraw(_amount);
	}

	function update() public returns (uint256) {
		return IHedgingReactor(uniswapV3HedgingReactor).update();
	}

	function getBalance(address collateralAsset) public view returns (uint256) {
		return ERC20(collateralAsset).balanceOf(address(this));
	}
}
