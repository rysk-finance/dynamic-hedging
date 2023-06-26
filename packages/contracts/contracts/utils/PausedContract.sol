// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;
import "@openzeppelin/contracts/security/Pausable.sol";

contract PausedContract is Pausable {
	constructor() {
		_pause();
	}
}
