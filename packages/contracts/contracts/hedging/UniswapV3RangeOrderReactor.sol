// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { IUniswapV3MintCallback } from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import { PoolAddress } from "../vendor/uniswap/PoolAddress.sol";
import { LiquidityAmounts, FullMath } from "../vendor/uniswap/LiquidityAmounts.sol";
import "../vendor/uniswap/TickMath.sol";
import "../interfaces/IHedgingReactor.sol";
import "../interfaces/ILiquidityPool.sol";
import "../libraries/AccessControl.sol";
import "../libraries/OptionsCompute.sol";
import "../libraries/SafeTransferLib.sol";
import "../libraries/CustomErrors.sol";
import "../PriceFeed.sol";

contract UniswapV3RangeOrderReactor is IUniswapV3MintCallback, IHedgingReactor, AccessControl {

    using PRBMathUD60x18 for uint256;
    using TickMath for int24;
    using SafeTransferLib for ERC20;
    ///////////////////////////
    /// immutable variables ///
    ///////////////////////////

    /// @notice address of the parent liquidity pool contract
    address public immutable parentLiquidityPool;
    /// @notice address of the price feed used for getting asset prices
    address public immutable priceFeed;
    /// @notice generalised list of stablecoin addresses to trade against wETH
    address public immutable collateralAsset;
    /// @notice address of the wETH contract
    address public immutable wETH;
    /// @notice smaller address token using uniswap pool convention
    ERC20 public immutable token0;
    /// @notice larger address token using uniswap pool convention
    ERC20 public immutable token1;
    /// @notice address of the uniswap V3 factory
    address public immutable factory;


    /////////////////////////////////////
    /// governance settable variables ///
    /////////////////////////////////////

    /// @notice uniswap v3 pool fee expressed at 10e6
    uint24 public poolFee;
    /// @notice instance of the uniswap V3 pool
    IUniswapV3Pool public pool;
    /// @notice limit to ensure we arent doing inefficient computation for dust amounts
    uint256 public minAmount = 1e16;
    /// @notice only authorized can fulfill range orders when set to true
    bool public onlyAuthorizedFulfill = false;

    /////////////////////////
    /// dynamic variables ///
    /////////////////////////

    /// @notice current range order position
    Position public currentPosition;

    ////////////////////////
    //      structs       //
    ////////////////////////

    struct Position {
        int24 activeLowerTick; // uniswap v3 pool lower tick spacing - set to 0 if no active range order
        int24 activeUpperTick; // uniswap v3 pool upper tick spacing - set to 0 if no active range order
        bool activeRangeAboveTick; // set to true if target is above tick at time of init position
    }

    struct RangeOrderParams {
        int24 lowerTick;
        int24 upperTick;
        uint160 sqrtPriceX96;
        uint256 meanPrice;
        RangeOrderDirection direction;
    }

    /// @notice enum to indicate the direction of the range order
    enum RangeOrderDirection{ ABOVE, BELOW }

    /////////////////////////
    ///       events      ///
    /////////////////////////

    event SetAuthorizedFulfill(
        bool onlyAuthorizedFulfill,
        address caller
    );

    event SetPoolFee(
        uint24 poolFee,
        address caller
    );

    constructor(
    address _factory,
    address _collateralAsset,
    address _wethAddress,
    address _parentLiquidityPool,
    uint24 _poolFee,
    address _priceFeed,
    address _authority
  ) AccessControl(IAuthority(_authority)) {
        collateralAsset = _collateralAsset;
        wETH = _wethAddress;
        factory = _factory;
        address _token0 = _collateralAsset < _wethAddress ? _collateralAsset : _wethAddress;
        address _token1 = _collateralAsset < _wethAddress ? _wethAddress : _collateralAsset;
        pool =  IUniswapV3Pool(PoolAddress.getPoolAddress(factory, _token0, _token1, _poolFee));
    token1 = ERC20(_token1);
    token0 = ERC20(_token0);
    parentLiquidityPool = _parentLiquidityPool;
    poolFee = _poolFee;
    priceFeed = _priceFeed;
  }

    ///////////////
    /// setters ///
    ///////////////

    /// @notice set if orders can be fulfilled by anyone or only authorized
    function setAuthorizedFulfill(bool _onlyAuthorizedFulfill) external {
        _onlyGovernor();
        onlyAuthorizedFulfill = _onlyAuthorizedFulfill;
        emit SetAuthorizedFulfill(_onlyAuthorizedFulfill, msg.sender);
    }

    /// @notice set the poolFee
    function setPoolFee(uint24 _poolFee) external {
        if (_inActivePosition()) {
            revert CustomErrors.InActivePosition();
        }
        _onlyGovernor();
        poolFee = _poolFee;
        pool = IUniswapV3Pool(PoolAddress.getPoolAddress(factory, address(token0), address(token1), _poolFee));
        emit SetPoolFee(_poolFee, msg.sender);
    }

    /// @notice Uniswap V3 callback fn, called back on pool.mint
    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata /*_data*/
    ) external override {
        require(msg.sender == address(pool), "callback caller");

        if (amount0Owed > 0) token0.safeTransfer(msg.sender, amount0Owed);
        if (amount1Owed > 0) token1.safeTransfer(msg.sender, amount1Owed);
    }

    /// @notice returns the current price of the underlying asset and the inverse symbol price
    /// ie: USDC/WETH and WETH/USDC
    /// @return price token0/token1 in 1e18 format
    /// @return inversed token1/token0 in 1e18 format
    function getPoolPrice() public view returns (uint256 price, uint256 inversed){
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        uint256 p = sqrtPriceX96 / (2 ** 96);
        price = p ** 2;
        bool token1DecimalsGTE = token1.decimals() >= token0.decimals();
        if (token1DecimalsGTE){
            inversed = (1e18 / price) * (10 ** (token1.decimals() - token0.decimals()));
        } else {
            inversed = (10 ** token1.decimals()) / price;
        }
        // 1e18 format
        price = price * (10 ** token0.decimals());
    }

    /// @notice allows the manager to create a range order of custom tick width
    function createUniswapRangeOrder(
        RangeOrderParams calldata params,
        uint256 amountDesired
    ) external {
        require(!_inActivePosition(), "RangeOrder: active position");
        _onlyManager();
        bool inversed = collateralAsset == address(token0);
        _createUniswapRangeOrder(params, amountDesired, inversed);
    }

    /// @notice allows the manager to exit an active range order
    function exitActiveRangeOrder() external {
        _onlyManager();
        // check if in active range
        if (!_inActivePosition()) {
            revert CustomErrors.NoActivePosition();
        }
        (uint128 liquidity, , , ,) = pool.positions(_getPositionID());
        _withdraw(currentPosition.activeLowerTick, currentPosition.activeUpperTick, liquidity);
    }

    /// @notice Permissionlessly when flag disabled withdraws liquidity from an active range if it's 100% in the position target
    function fulfillActiveRangeOrder() external {
        if (onlyAuthorizedFulfill && msg.sender != authority.manager()) {
            revert CustomErrors.UnauthorizedFulfill();
        }
        (, int24 tick, , , , , ) = pool.slot0();
        (uint128 liquidity, , , ,) = pool.positions(_getPositionID());
        if (currentPosition.activeRangeAboveTick) {
            // check if the current price is above the upper tick
            if (tick > currentPosition.activeUpperTick) {
                _withdraw(currentPosition.activeLowerTick, currentPosition.activeUpperTick, liquidity);
            } else {
                revert CustomErrors.RangeOrderNotFilled();
            }
        } else {
            // active range target is below the current price
            // if the current price is below the lower tick
            if (tick < currentPosition.activeLowerTick) {
                _withdraw(currentPosition.activeLowerTick, currentPosition.activeUpperTick, liquidity);
            } else {
                revert CustomErrors.RangeOrderNotFilled();
            }
        }
    }

    /// @notice compute total underlying holdings of the vault token supply
    /// includes current liquidity invested in uniswap position, current fees earned,
    /// and tokens held in vault
    /// @return amount0Current current total underlying balance of token0
    /// @return amount1Current current total underlying balance of token1
    function getUnderlyingBalances()
        public
        view
        returns (uint256 amount0Current, uint256 amount1Current)
    {
        (uint160 sqrtRatioX96, int24 tick, , , , , ) = pool.slot0();
        return _getUnderlyingBalances(sqrtRatioX96, tick);
    }

    function getPositionID() external view returns (bytes32) {
        return _getPositionID();
    }

    //////////////////////////////////////////////////////
    /// access-controlled state changing functionality ///
    //////////////////////////////////////////////////////

    /// @inheritdoc IHedgingReactor
    function hedgeDelta(int256 _delta) external returns (int256) {
        require(msg.sender == parentLiquidityPool, "!vault");
        // check for existing range order first amd yank if it exists
        if (_inActivePosition()) _yankRangeOrderLiquidity();

        bool inversed = collateralAsset == address(token0);
        uint256 underlyingPrice = _getUnderlyingPrice(wETH, collateralAsset);
        (uint256 amount0Current, uint256 amount1Current) = getUnderlyingBalances();
        (uint256 poolPrice, uint256 inversedPrice) = getPoolPrice();
        uint256 quotePrice = inversed ? inversedPrice : poolPrice;
        if (_delta < 0) {
            // buy wETH
            // lowest price is best price when buying
            uint256 priceToUse = quotePrice < underlyingPrice ? quotePrice : underlyingPrice;
            RangeOrderDirection direction = inversed ? RangeOrderDirection.ABOVE : RangeOrderDirection.BELOW;
            RangeOrderParams memory rangeOrder = _getTicksAndMeanPriceFromWei(priceToUse, direction);
            uint256 amountCollateralInToken1 = uint256(-_delta).mul(rangeOrder.meanPrice);
            uint256 amountDesiredInCollateralToken = OptionsCompute.convertToDecimals(
                                                                                      amountCollateralInToken1,
                                                                                      ERC20(collateralAsset).decimals()
            );
            _createUniswapRangeOrder(rangeOrder, amountDesiredInCollateralToken, inversed);
        } else {
            // sell wETH
            uint256 wethBalance = inversed ? amount1Current : amount0Current;
            if (wethBalance < minAmount) return 0;
            // highest price is best price when selling
            uint256 priceToUse = quotePrice < underlyingPrice ? underlyingPrice : quotePrice;
            RangeOrderDirection direction = inversed ? RangeOrderDirection.BELOW : RangeOrderDirection.ABOVE;
            RangeOrderParams memory rangeOrder = _getTicksAndMeanPriceFromWei(priceToUse, direction);
            uint256 deltaToUse = _delta > int256(wethBalance) ? wethBalance : uint256(_delta);
            _createUniswapRangeOrder(rangeOrder, deltaToUse, inversed);
        }
        // satisfy interface, delta only changes when range order is filled
        return 0;
    }

    /// @inheritdoc IHedgingReactor
    function withdraw(uint256 _amount) external returns (uint256) {
        require(msg.sender == parentLiquidityPool, "!vault");
        // check the holdings if enough then transfer it
        // assume amount is passed in as collateral decimals
        uint256 balance = ERC20(collateralAsset).balanceOf(address(this));
        if (balance == 0) {
            return 0;
        }
        if (_amount <= balance) {
            SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, _amount);
            // return in collateral format
            return _amount;
        } else {
            SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, balance);
            // return in collateral format
            return balance;
        }
    }

    /**
     * @notice use to recover any ERC20 token that is held
     * @param tokenAddress address of the token to recover
     * @param receiver address of the receiver of the token
     * @param tokenAmount amount of the token to recover
     */
    function recoverERC20(address tokenAddress, address receiver, uint256 tokenAmount) external {
        _onlyGovernor();
        _recoverERC20(tokenAddress, receiver, tokenAmount);
    }

    /**
     * @notice use to recover any ETH that is held in this contract
     * @param receiver address of the receiver of the ETH
     * @param amount amount of ETH to recover
     */
    function recoverETH(address payable receiver, uint256 amount) external {
        _onlyGovernor();
        SafeTransferLib.safeTransferETH(receiver, amount);
    }


    /////////////////////////////////////////////
    /// external state changing functionality ///
    /////////////////////////////////////////////

    /// @inheritdoc IHedgingReactor
    function update() external pure returns (uint256) {
        // Remove range order if possible
        return 0;
    }



    ///////////////////////
    /// complex getters ///
    ///////////////////////

    /// @inheritdoc IHedgingReactor
    function getDelta()
        external
        view
        returns (int256 delta)
    {
        (uint256 amount0Current, uint256 amount1Current) = getUnderlyingBalances();
        delta = wETH == address(token0) ? int256(amount0Current) : int256(amount1Current);
    }

    /// @inheritdoc IHedgingReactor
    function getPoolDenominatedValue() external view returns (uint256 value) {
        (uint256 amount0Current, uint256 amount1Current) = getUnderlyingBalances();
        uint256 collateral = wETH == address(token0) ? amount1Current : amount0Current;
        uint256 wethBalance = wETH == address(token0) ? amount0Current : amount1Current;
        uint256 collateralValue = OptionsCompute.convertFromDecimals(collateral, ERC20(collateralAsset).decimals());
        uint256 wethValue = PriceFeed(priceFeed).getNormalizedRate(wETH, collateralAsset) * wethBalance;
        value = collateralValue + wethValue;
    }

    //////////////////////////
    /// internal utilities ///
    //////////////////////////

    /// credit: https://github.com/ArrakisFinance/vault-v1-core/blob/main/contracts/ArrakisVaultV1.sol#L721
    /// @notice Computes the fees earned by the position
    function _computeFeesEarned(
        bool isZero,
        uint256 feeGrowthInsideLast,
        int24 tick,
        uint128 liquidity
    ) private view returns (uint256 fee) {
        uint256 feeGrowthOutsideLower;
        uint256 feeGrowthOutsideUpper;
        uint256 feeGrowthGlobal;
        if (isZero) {
            feeGrowthGlobal = pool.feeGrowthGlobal0X128();
            (, , feeGrowthOutsideLower, , , , , ) = pool.ticks(currentPosition.activeLowerTick);
            (, , feeGrowthOutsideUpper, , , , , ) = pool.ticks(currentPosition.activeUpperTick);
        } else {
            feeGrowthGlobal = pool.feeGrowthGlobal1X128();
            (, , , feeGrowthOutsideLower, , , , ) = pool.ticks(currentPosition.activeLowerTick);
            (, , , feeGrowthOutsideUpper, , , , ) = pool.ticks(currentPosition.activeUpperTick);
        }

        unchecked {
            // calculate fee growth below
            uint256 feeGrowthBelow;
            if (tick >= currentPosition.activeLowerTick) {
                feeGrowthBelow = feeGrowthOutsideLower;
            } else {
                feeGrowthBelow = feeGrowthGlobal - feeGrowthOutsideLower;
            }

            // calculate fee growth above
            uint256 feeGrowthAbove;
            if (tick < currentPosition.activeUpperTick) {
                feeGrowthAbove = feeGrowthOutsideUpper;
            } else {
                feeGrowthAbove = feeGrowthGlobal - feeGrowthOutsideUpper;
            }

            uint256 feeGrowthInside =
                feeGrowthGlobal - feeGrowthBelow - feeGrowthAbove;
            fee = FullMath.mulDiv(
                liquidity,
                feeGrowthInside - feeGrowthInsideLast,
                0x100000000000000000000000000000000
            );
        }
    }

    /**
     * @dev create a uniswap range order
     * @param params the range order params
     * @param amountDesired the amount of liquidity to supply in token to be sold / 100% allocation above range
     * @param inversed true if collateral token is token0
     */
    function _createUniswapRangeOrder(
        RangeOrderParams memory params,
        uint256 amountDesired,
        bool inversed
    ) private {
        uint256 amount0Desired;
        uint256 amount1Desired;
        // compute the liquidity amount
        uint160 sqrtRatioAX96 = params.lowerTick.getSqrtRatioAtTick();
        uint160 sqrtRatioBX96 = params.upperTick.getSqrtRatioAtTick();

        if (params.direction == RangeOrderDirection.ABOVE) {
            amount0Desired = amountDesired;
            uint256 balance = token0.balanceOf(address(this));
            // Only transfer in when collateral token is token0
            if (inversed && balance < amountDesired) {
                uint256 transferAmount = amountDesired - balance;
                uint256 parentPoolBalance = ILiquidityPool(parentLiquidityPool).getBalance(address(token0));
                if (parentPoolBalance < transferAmount) { revert CustomErrors.WithdrawExceedsLiquidity(); }
                SafeTransferLib.safeTransferFrom(address(token0), msg.sender, address(this), transferAmount);
            }
        } else {
            amount1Desired = amountDesired;
            uint256 balance = token1.balanceOf(address(this));
            if (!inversed && balance < amountDesired) {
                uint256 transferAmount = amountDesired - balance;
                uint256 parentPoolBalance = ILiquidityPool(parentLiquidityPool).getBalance(address(token1));
                if (parentPoolBalance < transferAmount) { revert CustomErrors.WithdrawExceedsLiquidity(); }
                SafeTransferLib.safeTransferFrom(address(token1), msg.sender, address(this), transferAmount);
            }
        }

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            params.sqrtPriceX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            amount0Desired, // amount of token0 being sent in
            amount1Desired// amount of token1 being sent in
        );
        pool.mint(address(this), params.lowerTick, params.upperTick, liquidity, "");
        // store the active range for later access
        currentPosition.activeLowerTick = params.lowerTick;
        currentPosition.activeUpperTick = params.upperTick;
        currentPosition.activeRangeAboveTick = params.direction == RangeOrderDirection.ABOVE ? true : false;
        // state transition can be reconstructed from uniswap events emitted
    }

    /// @notice take a price quote in token1/token0 format and convert to sqrtPriceX96 token0/token1 format
    function _sqrtPriceFromWei(uint256 weiPrice) private view returns (uint160 sqrtPriceX96){
        uint256 inverse = uint256(1e18).div(weiPrice);
        sqrtPriceX96 = uint160(PRBMathUD60x18.sqrt(inverse).mul(2 ** 96)) * uint160(10 ** token0.decimals());
    }

    /**
     * @dev returns the price of sqrtX96(token0) as token0 in token1 decimals
     * @param sqrtPriceX96 the sqrt price of token0/token1
     */
    function _sqrtPriceX96ToUint(uint160 sqrtPriceX96)
        private
        pure
        returns (uint256)
    {
        uint256 numerator1 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        return FullMath.mulDiv(numerator1, 1, 1 << 192);
    }

    /**
     * @dev returns sqrtPriceX96 as a tick
     * @param sqrtPriceX96 the sqrtx96 price
     * @param tickSpacing the tick spacing of the pool
     */
    function _sqrtPriceX96ToNearestTick(uint160 sqrtPriceX96, int24 tickSpacing) private pure returns (int24 nearestActiveTick){
        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        nearestActiveTick = tick / tickSpacing * tickSpacing;
    }

    /**
     * @dev takes the price of token0/token1 as a tick token1/token0
     * @param tick price expressed as a tick
     * @return price token0/token1 in token1/token0 in token1 decimals
     */
    function _tickToToken0PriceInverted(int24 tick) private view returns (uint256){
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick);
        uint256 price = _sqrtPriceX96ToUint(sqrtPriceX96);
        uint256 inWei = OptionsCompute.convertFromDecimals(price, token0.decimals());
        uint256 intermediate = inWei.div(10**(token1.decimals() - token0.decimals()));
        uint256 inversed = uint256(1e18).div(intermediate);
        return inversed;
    }

    /**
     * @param price the price of token0/token1 in token1/token0 in token1 decimals
     * @param direction the direction of the range order
     * @return params the parameters needed to mint a range order with average price when filled
     */
    function _getTicksAndMeanPriceFromWei(uint256 price, RangeOrderDirection direction)
        private
        view
        returns (RangeOrderParams memory) {
        uint160 sqrtPriceX96 = _sqrtPriceFromWei(price);
        int24 tickSpacing = pool.tickSpacing();
        int24 nearestTick = _sqrtPriceX96ToNearestTick(sqrtPriceX96, tickSpacing);
        int24 lowerTick = direction == RangeOrderDirection.ABOVE ? nearestTick + tickSpacing : nearestTick - (2 * tickSpacing);
        int24 tickUpper = direction ==RangeOrderDirection.ABOVE ? lowerTick + tickSpacing : nearestTick - tickSpacing;
        int24 meanTick = (lowerTick + tickUpper) / 2;
        // average price paid on the range order in token1/token0 in token0 decimals format
        uint256 meanPrice = _tickToToken0PriceInverted(meanTick);
        // convert to token1 format
        meanPrice = OptionsCompute.convertFromDecimals(meanPrice, token0.decimals(), token1.decimals());
        return RangeOrderParams({
            lowerTick: lowerTick,
            upperTick: tickUpper,
            meanPrice: meanPrice,
            sqrtPriceX96: sqrtPriceX96,
            direction: direction
        });
    }

    /// @notice get the uniswap position id of the current position
    function _getPositionID() private view returns (bytes32 positionID) {
        return keccak256(abi.encodePacked(address(this), currentPosition.activeLowerTick, currentPosition.activeUpperTick));
    }

    /**
     * @dev Used to receover any ERC20 tokens held by the contract
     * @param tokenAddress The token contract address
     * @param receiver Address that will receive the tokens
     * @param tokenAmount Number of tokens to be sent
     */
    function _recoverERC20(address tokenAddress, address receiver, uint256 tokenAmount) private {
        SafeTransferLib.safeTransfer(ERC20(tokenAddress), receiver, tokenAmount);
    }

    /**
     * @dev Gets all assets owned by the vault in a range order and held directly in the vault
     * @param sqrtRatioX96 the current sqrt price of the pool
     * @param tick the current tick of the pool
     * @return amount0Current the amount of token0 held in the vault and range order
     * @return amount1Current the amount of token1 held in the vault and range order
     */
    function _getUnderlyingBalances(uint160 sqrtRatioX96, int24 tick)
        private
        view
        returns (uint256 amount0Current, uint256 amount1Current)
    {
        (
            uint128 liquidity,
            uint256 feeGrowthInside0Last,
            uint256 feeGrowthInside1Last,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = pool.positions(_getPositionID());

        // compute current holdings from liquidity
        (amount0Current, amount1Current) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtRatioX96,
            currentPosition.activeLowerTick.getSqrtRatioAtTick(),
            currentPosition.activeUpperTick.getSqrtRatioAtTick(),
            liquidity
        );

        // compute current fees earned
        uint256 fee0 =
            _computeFeesEarned(true, feeGrowthInside0Last, tick, liquidity) +
                uint256(tokensOwed0);
        uint256 fee1 =
            _computeFeesEarned(false, feeGrowthInside1Last, tick, liquidity) +
                uint256(tokensOwed1);

        // add any leftover in contract to current holdings
        amount0Current +=
            fee0 +
            token0.balanceOf(address(this));
        amount1Current +=
            fee1 +
            token1.balanceOf(address(this));
    }

    /**
     * @notice get the underlying price with just the underlying asset and strike asset
     * @param underlying   the asset that is used as the reference asset
     * @param _strikeAsset the asset that the underlying value is denominated in
     * @return the underlying price
     */
    function _getUnderlyingPrice(address underlying, address _strikeAsset)
        private
        view
        returns (uint256)
    {
        return PriceFeed(priceFeed).getNormalizedRate(underlying, _strikeAsset);
    }

    /**
     * @notice determine if the pool is in an range order
     * @return true if the pool is in a range order
     */
    function _inActivePosition() private view returns (bool) {
        return currentPosition.activeLowerTick != currentPosition.activeUpperTick;
    }

    /**
     * @dev withdraws liquidity from the uniswap pool
     * @param lowerTick_ the lower tick of the range order
     * @param upperTick_ the upper tick of the range order
     * @param liquidity the amount of liquidity to withdraw
     * @return burn0 the amount of token0 withdrawn from the pool
     * @return burn1 the amount of token1 withdrawn from the pool
     * @return fee0 the amount of token0 fees collected from the pool
     * @return fee1 the amount of token1 fees collected from the pool
     */
    function _withdraw(
        int24 lowerTick_,
        int24 upperTick_,
        uint128 liquidity
    )
        private
        returns (
            uint256 burn0,
            uint256 burn1,
            uint256 fee0,
            uint256 fee1
        )
    {
        // returns amount of token0 and token1 sent to this vault
        // emits Burn event in the uniswap pool
        (burn0, burn1) = pool.burn(lowerTick_, upperTick_, liquidity);

        // collect accumulated fees
        // emits collect event in the uniswap pool
        // returns amount burned + fees collected
       (uint256 collect0, uint256 collect1) = pool.collect(
            address(this),
            lowerTick_,
            upperTick_,
            type(uint128).max,
            type(uint128).max
        );

        fee0 = collect0 - burn0;
        fee1 = collect1 - burn1;
        // mark no current position
        delete currentPosition;
    }

    /// @notice Withdraws all liquidity from a range order and collection outstanding fees
    function _yankRangeOrderLiquidity() private {
        // struct definition: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol#L13
        (uint128 liquidity, , , ,) = pool.positions(_getPositionID());
        _withdraw(currentPosition.activeLowerTick, currentPosition.activeUpperTick, liquidity);
    }
}
