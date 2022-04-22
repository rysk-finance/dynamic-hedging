
import "../OptionRegistry.sol";
import "../tokens/ERC20.sol";
import { SafeTransferLib } from "../libraries/SafeTransferLib.sol";


contract LiquidityPoolAdjustCollateralTest {

    address optionRegistry;
    address usd;

    // amount of strikeAsset allocated as collateral
    uint public collateralAllocated;

    constructor(address _optionRegistry, address _usd) {
        optionRegistry = _optionRegistry;
        usd = _usd;
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
}