pragma solidity >=0.8.9;

import { IHedgingReactor } from "../interfaces/IHedgingReactor.sol";
import {ERC20} from '../tokens/ERC20.sol';
import "../libraries/SafeTransferLib.sol";


contract PerpHedgingTest {

    address public perpHedgingReactor;
    uint256 private constant MAX_UINT = 2**256 - 1;


    function setHedgingReactorAddress(address _address) public {
        perpHedgingReactor= _address;
        SafeTransferLib.safeApprove(ERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48), _address, MAX_UINT);

    }

    function hedgeDelta(int256 _delta) public returns(int deltaChange) {
        return IHedgingReactor(perpHedgingReactor).hedgeDelta(_delta);
    }

    function getDelta() public view returns(int256 delta) { 
        return IHedgingReactor(perpHedgingReactor).getDelta();
    }

    function withdraw(uint256 _amount, address _token) public returns (uint256){
        return IHedgingReactor(perpHedgingReactor).withdraw(_amount, _token);
    }

    function update() public returns(uint256){
        return IHedgingReactor(perpHedgingReactor).update();
    }

}
