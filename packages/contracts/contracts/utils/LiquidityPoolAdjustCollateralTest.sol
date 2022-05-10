// SPDX-License-Identifier: UNLICENSED

import "../OptionRegistry.sol";
import "../tokens/ERC20.sol";
import { Types } from "../libraries/Types.sol";
import { SafeTransferLib } from "../libraries/SafeTransferLib.sol";


contract LiquidityPoolAdjustCollateralTest {

    address optionRegistry;
    address usd;

    // amount of strikeAsset allocated as collateral
    uint public collateralAllocated;

    constructor(address _optionRegistry, address _usd) {
        optionRegistry = _optionRegistry;
        usd = _usd;
        SafeTransferLib.safeApprove(ERC20(usd), optionRegistry, 2**256 - 1);
    }

    //////////////////////////////////////////////////////
    /// access-controlled state changing functionality ///
    //////////////////////////////////////////////////////
    /**
     * @notice Either retrieves the option token if it already exists, or deploy it
     * @param  underlying is the address of the underlying asset of the option
     * @param  strikeAsset is the address of the collateral asset of the option
     * @param  expiration is the expiry timestamp of the option
     * @param  isPut the type of option
     * @param  strike is the strike price of the option - 1e18 format
     * @param collateral is the address of the asset to collateralize the option with
     * @return the address of the option
     */
    function issue(address underlying, address strikeAsset, uint64 expiration, bool isPut, uint128 strike, address collateral) external returns (address) {
        return OptionRegistry(optionRegistry).issue(Types.OptionSeries(expiration, strike, isPut, underlying, strikeAsset, collateral));
    }

    /**
     * @notice Open an options contract using collateral from the liquidity pool
     * @param  _series the address of the option token to be created
     * @param  amount the amount of options to deploy
     * @param  collateralAmount the collateral required for the option
     * @dev only callable by the liquidityPool
     * @return if the transaction succeeded
     * @return the amount of collateral taken from the liquidityPool
     */
    function open(address _series, uint256 amount, uint256 collateralAmount) external returns (bool, uint256) {
        return OptionRegistry(optionRegistry).open(_series, amount, collateralAmount);
    }

    /**
     * @notice Close an options contract (oToken) before it has expired
     * @param  _series the address of the option token to be burnt
     * @param  amount the amount of options to burn
     * @dev only callable by the liquidityPool
     * @return if the transaction succeeded
     */
    function close(address _series, uint amount) external returns (bool, uint256) {
        return OptionRegistry(optionRegistry).close(_series, amount);
    }

    function settle(address _series) external returns (bool, uint256, uint256, uint256) {
        return OptionRegistry(optionRegistry).settle(_series);
    }
    /**
    @notice adjust the collateral held in a specific vault because of health
    @param lpCollateralDifference amount of collateral taken from or given to the liquidity pool
    @param addToLpBalance true if collateral is returned to liquidity pool, false if collateral is withdrawn from liquidity pool
    */
    function adjustCollateral(uint256 lpCollateralDifference, bool addToLpBalance) external  {
      
        if(addToLpBalance){
            collateralAllocated -= lpCollateralDifference;
        } else {
            SafeTransferLib.safeApprove(ERC20(usd), optionRegistry, lpCollateralDifference);
            collateralAllocated += lpCollateralDifference;
        }
    }

    function setCollateralAllocated(uint256 amount) external {
        collateralAllocated = amount;
    }
}