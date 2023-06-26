// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;
import "@openzeppelin/contracts/security/Pausable.sol";

contract PausedContract {
    OptionExchangePaused optionExchange;
	constructor() {
		optionExchange = new OptionExchangePaused();
	}

}
contract OptionExchangePaused is Pausable {
    constructor() {
		_pause();
	}
}
