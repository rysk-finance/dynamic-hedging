pragma solidity >=0.8.9;

import "./tokens/UniversalERC20.sol";
import "./mocks/uniswap-v2/interfaces/IUniswapV2Pair.sol";
import "./mocks/uniswap-v2/interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./access/Ownable.sol";
import "./interfaces/AggregatorV3Interface.sol";
import "./interfaces/IERC20.sol";
import "./math/SafeMath.sol";
import "hardhat/console.sol";

contract PriceFeed is Ownable {

    mapping(address => mapping(address => address)) public priceFeeds;

    using UniversalERC20 for IERC20;
    using SafeMath for uint8;
    using SafeMath for uint;
    IUniswapV2Factory public uniswapV2Factory;
    IUniswapV2Router02 public uniswapRouter;

    constructor(
        address _uniswapV2Factory,
        address _uniswapRouter
    ) public {
      uniswapV2Factory = IUniswapV2Factory(_uniswapV2Factory);
      uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    function addPriceFeed(
        address underlying,
        address strike,
        address feed
    ) public onlyOwner {
        priceFeeds[underlying][strike] = feed;
    }

    function getRate(
        address underlying,
        address strike
    ) public view returns(uint) {
        address feedAddress = priceFeeds[underlying][strike];
        //TODO attempt path through ETH
        require(feedAddress != address(0), "Price feed does not exist");
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        (, int rate,,,) = feed.latestRoundData();
        return uint(rate);
    }

    function getNormalizedRate(
       address underlying,
       address strike
    ) external view returns(uint) {
        address feedAddress = priceFeeds[underlying][strike];
        IERC20 strikeToken = IERC20(strike);
        //TODO attempt path through ETH
        require(feedAddress != address(0), "Price feed does not exist");
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        uint8 feedDecimals = feed.decimals();
        uint8 strikeDecimals = strikeToken.decimals();
        (, int rate,,,) = feed.latestRoundData();
        uint exponent = strikeDecimals.sub(feedDecimals);
        uint normalized = uint(rate).mul(10**(exponent));
        return normalized;
    }

    function getV2PriceQuoteSlippage(
        address fromToken,
        address toToken,
        uint256 amount
    ) public view returns(uint256) {
        address pair = uniswapV2Factory.getPair(fromToken, toToken);
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        address token0 = IUniswapV2Pair(pair).token0();
        (uint112 reserveA, uint112 reserveB) = fromToken == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        return uniswapRouter.getAmountOut(amount, reserveA, reserveB);
    }

    function getV2PriceQuote(
        address fromToken,
        address toToken,
        uint256 amount
    ) public view returns(uint256) {
        address pair = uniswapV2Factory.getPair(fromToken, toToken);
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        address token0 = IUniswapV2Pair(pair).token0();
        (uint112 reserveA, uint112 reserveB) = fromToken == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        return uniswapRouter.quote(amount, reserveA, reserveB);
    }

    function getPriceQuote(
       address fromToken,
       address toToken,
       uint256 amount
    ) public view returns(uint256) {
      return calculateUniswapReturn(IERC20(fromToken), IERC20(toToken), amount);
    }

    // @author Anton Bukov - (1Split)
    function calculateUniswapReturn(
       IERC20 fromToken,
       IERC20 toToken,
       uint256 amount
    ) internal view returns(uint256) {
       uint256 returnAmount = amount;
       //TODO Implement TWAP
   }

    /* function getUniswapV2Return( */
    /*    UniswapV2ERC20 exchange, */
    /*    IERC20 fromToken, */
    /*    IERC20 destToken, */
    /*    uint amountIn */
    /* ) internal view returns (uint256 result, bool needSync, bool needSkim) { */
    /*     uint256 reserveIn = fromToken.universalBalanceOf(address(exchange)); */
    /*     uint256 reserveOut = destToken.universalBalanceOf(address(exchange)); */
    /*     (uint112 reserve0, uint112 reserve1,) = exchange.getReserves(); */
    /*     if (fromToken > destToken) { */
    /*         (reserve0, reserve1) = (reserve1, reserve0); */
    /*     } */
    /*     needSync = (reserveIn < reserve0 || reserveOut < reserve1); */
    /*     needSkim = !needSync && (reserveIn > reserve0 || reserveOut > reserve1); */

    /*     uint256 amountInWithFee = amountIn.mul(997); */
    /*     uint256 numerator = amountInWithFee.mul(Math.min(reserveOut, reserve1)); */
    /*     uint256 denominator = Math.min(reserveIn, reserve0).mul(1000).add(amountInWithFee); */
    /*     result = (denominator == 0) ? 0 : numerator.div(denominator); */
    /* } */
}
