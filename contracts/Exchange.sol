pragma solidity >=0.5.0 <0.7.0;

import "./interfaces/IERC20.sol";
import "./tokens/SafeERC20.sol";

contract Exchange {

  using SafeMath for uint;
  using SafeERC20 for IERC20;

  bool private depositingTokenFlag; // True when Token.transferFrom is being called from depositToken
  address public feeAccount = address(this); // the account that will receive fees
  uint public feeTake = 3000000000000000; // percentage times (1 ether)

  mapping (address => mapping (address => uint)) public tokens; // mapping of token addresses to mapping of account balances (token=0 means Ether)
  mapping (address => mapping (bytes32 => bool)) public orders; // mapping of user accounts to mapping of order hashes to booleans (true = submitted by user, equivalent to offchain signature)
  mapping (address => mapping (bytes32 => uint)) public orderFills; // mapping of user accounts to mapping of order hashes to uints (amount of order that has been filled)

  event Order(address tokenGet, uint amountGet, address tokenGive, uint amountGive, uint expires, uint nonce, address user);
  event Deposit(address token, address user, uint amount, uint balance);
  event Trade(address tokenGet, uint amountGet, address tokenGive, uint amountGive, address get, address give);
  event Withdraw(address token, address user, uint amount, uint balance);

  /**
   * This function handles deposits of ERC20 based tokens to the contract.
   * Does not allow Ether.
   * If token transfer fails, transaction is reverted and remaining gas is refunded.
   * Emits a Deposit event.
   * Note: Remember to call Token(address).approve(this, amount) or this contract will not be able to do the transfer on your behalf.
   * @param token Ethereum contract address of the token or 0 for Ether
   * @param amount uint of the amount of the token the user wishes to deposit
   * @author forkdelta
   */
  function depositToken(address token, uint amount) public {
    require(token != address(0));
    depositingTokenFlag = true;
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    depositingTokenFlag = false;
    tokens[token][msg.sender] = tokens[token][msg.sender].add(amount);
    emit Deposit(token, msg.sender, amount, tokens[token][msg.sender]);
  }

  /**
   * This function handles withdrawals of ERC20 based tokens from the contract.
   * Does not allow Ether.
   * If token transfer fails, transaction is reverted and remaining gas is refunded.
   * Emits a Withdraw event.
   * @param token Ethereum contract address of the token or 0 for Ether
   * @param amount uint of the amount of the token the user wishes to withdraw
   */
  function withdrawToken(address token, uint amount) public {
    require(token != address(0));
    require(tokens[token][msg.sender] >= amount);
    tokens[token][msg.sender] = tokens[token][msg.sender].sub(amount);
    IERC20(token).safeTransfer(msg.sender, amount);
    emit Withdraw(token, msg.sender, amount, tokens[token][msg.sender]);
  }

  /**
   * Retrieves the balance of a token based on a user address and token address.
   * @param token Ethereum contract address of the token or 0 for Ether
   * @param user Ethereum address of the user
   * @return the amount of tokens on the exchange for a given user address
   */
  function balanceOf(address token, address user) public view returns (uint) {
    return tokens[token][user];
  }

  /**
   * Stores the active order inside of the contract.
   * Emits an Order event.
   * Note: tokenGet & tokenGive can be the Ethereum contract address.
   * @param tokenGet Ethereum contract address of the token to receive
   * @param amountGet uint amount of tokens being received
   * @param tokenGive Ethereum contract address of the token to give
   * @param amountGive uint amount of tokens being given
   * @param expires uint of block number when this order should expire
   * @param nonce arbitrary random number
   */
  function createOrder(address tokenGet, uint amountGet, address tokenGive, uint amountGive, uint expires, uint nonce) public {
    bytes32 hash = keccak256(abi.encodePacked(address(this), tokenGet, amountGet, tokenGive, amountGive, expires, nonce));
    orders[msg.sender][hash] = true;
    emit Order(tokenGet, amountGet, tokenGive, amountGive, expires, nonce, msg.sender);
  }

 /**
  * Facilitates a trade from one user to another.
  * Requires that the transaction is signed properly, the trade isn't past its expiration, and all funds are present to fill the trade.
  * Calls tradeBalances().
  * Updates orderFills with the amount traded.
  * Emits a Trade event.
  * Note: tokenGet & tokenGive can be the Ethereum contract address.
  * Note: amount is in amountGet / tokenGet terms.
  * @param tokenGet Ethereum contract address of the token to receive
  * @param amountGet uint amount of tokens being received
  * @param tokenGive Ethereum contract address of the token to give
  * @param amountGive uint amount of tokens being given
  * @param expires uint of block number when this order should expire
  * @param nonce arbitrary random number
  * @param user Ethereum address of the user who placed the order
  * @param amount uint amount in terms of tokenGet that will be "buy" in the trade
  */
  function trade(address tokenGet, uint amountGet, address tokenGive, uint amountGive, uint expires, uint nonce, address user, uint amount) public {
    bytes32 hash = keccak256(abi.encodePacked(address(this), tokenGet, amountGet, tokenGive, amountGive, expires, nonce));
    require((
      orders[user][hash] &&
      now <= expires &&
      orderFills[user][hash].add(amount) <= amountGet
    ));
    tradeBalances(tokenGet, amountGet, tokenGive, amountGive, user, amount);
    orderFills[user][hash] = orderFills[user][hash].add(amount);
    emit Trade(tokenGet, amount, tokenGive, amountGive.mul(amount) / amountGet, user, msg.sender);
  }

  /**
  * This is a private function and is only being called from trade().
  * Handles the movement of funds when a trade occurs.
  * Takes fees.
  * Updates token balances for both buyer and seller.
  * Note: tokenGet & tokenGive can be the Ethereum contract address.
  * Note: amount is in amountGet / tokenGet terms.
  * @param tokenGet Ethereum contract address of the token to receive
  * @param amountGet uint amount of tokens being received
  * @param tokenGive Ethereum contract address of the token to give
  * @param amountGive uint amount of tokens being given
  * @param user Ethereum address of the user who placed the order
  * @param amount uint amount in terms of tokenGet that will be "buy" in the trade
  */
  function tradeBalances(address tokenGet, uint amountGet, address tokenGive, uint amountGive, address user, uint amount) internal {

    uint feeTakeXfer = 0;
    feeTakeXfer = amount.mul(feeTake).div(1 ether);
    tokens[tokenGet][msg.sender] = tokens[tokenGet][msg.sender].sub(amount.add(feeTakeXfer));
    tokens[tokenGet][user] = tokens[tokenGet][user].add(amount);
    tokens[tokenGet][feeAccount] = tokens[tokenGet][feeAccount].add(feeTakeXfer);
    tokens[tokenGive][user] = tokens[tokenGive][user].sub(amountGive.mul(amount).div(amountGet));
    tokens[tokenGive][msg.sender] = tokens[tokenGive][msg.sender].add(amountGive.mul(amount).div(amountGet));
  }

}
