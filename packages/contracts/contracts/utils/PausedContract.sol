// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

contract PausedContract {
    OptionExchangePaused public optionExchange;
	constructor() {
		optionExchange = new OptionExchangePaused();
	}

}
contract OptionExchangePaused {
    bool public paused = true;
}
