// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

interface ISpotHedge {
    
    function hedgeDelta(int256 _delta) external;

    function getDelta(int256 _delta) view external;



}