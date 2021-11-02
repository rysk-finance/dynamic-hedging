// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;


interface WETH {
    function balanceOf(address ady) external returns (uint);
    function deposit() external payable;
    function withdraw(uint wad) external;
    function transfer(address dst, uint wad) external returns (bool);
    event Deposit(address indexed dst, uint wad);
    event Withdrawal(address indexed src, uint wad);
}
