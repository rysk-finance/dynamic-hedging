pragma solidity >=0.8.0;

import "./LiquidityPool.sol";
import "./OptionsProtocol.sol";

contract LiquidityPools {

  address public protocol;
  // maps a strikeAsset to a liquidity pool
  mapping(address => address) public strikeAssets;

  event LiquidityPoolCreated(address lp, address strikeAsset);

  function createLiquidityPool(address _strikeAsset, address _underlyingAsset, address _collateralAsset, uint rfr, int[7] memory callSkew, int[7] memory putSkew, string memory name, string memory symbol) public {
    address lp = strikeAssets[_strikeAsset];
    lp = address(new LiquidityPool(
       protocol,
       _strikeAsset,
       _underlyingAsset,
       _collateralAsset,
       rfr,
       callSkew,
       putSkew,
       name,
       symbol
    ));
    strikeAssets[_strikeAsset] = lp;
    LiquidityPool(lp).transferOwnership(payable(msg.sender));
    emit LiquidityPoolCreated(lp, _strikeAsset);
  }

  function supplyLiquidity(address _strikeAsset, uint amount) public {
    address lp = strikeAssets[_strikeAsset];
    require(lp != address(0), "Liquidity pool does not exist");
    LiquidityPool liquidityPool = LiquidityPool(lp);
  }

  function setup(address _protocol) public {
    require(address(protocol) == address(0), "protocol already set");
    protocol = _protocol;
  }

}
