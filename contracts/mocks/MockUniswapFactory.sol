pragma solidity >=0.8.9;

contract MockUniswapFactory {

  mapping(address => address) public token_to_exchange;
  mapping(address => address) public exchange_to_token;

  function getExchange(address token)
    external
    view
    returns (address)
  {
    return token_to_exchange[token];
  }

}
