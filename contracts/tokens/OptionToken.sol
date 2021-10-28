pragma solidity >=0.6.0 <0.7.0;

import "./ERC20.sol";
import "../access/Ownable.sol";

contract OptionToken is
    ERC20,
    Ownable
{
    bytes32 public issuanceHash;

    /**
     * @dev Sets the values for `name`, `symbol`, and `issuanceHash`. All three of
     * these values are immutable: they can only be set once during
     * construction.
     */
    constructor (bytes32 _issuanceHash, string memory name, string memory symbol) public ERC20(name, symbol) {
        issuanceHash = _issuanceHash;
    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    /**
     * @dev See {ERC20-_burnFrom}.
     */
    function burnFrom(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
    }

    function destroy() public onlyOwner {
        selfdestruct(owner());
    }
}
