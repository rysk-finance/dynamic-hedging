// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

interface IHedgingReactor {
    
    function hedgeDelta(int256 _delta) external;

    function getDelta(int256 _delta) view external;

    function withdraw(int256 _amount, address _token) external;

    function update() external;

}