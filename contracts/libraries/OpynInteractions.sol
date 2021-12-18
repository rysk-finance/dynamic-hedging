// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "../interfaces/IERC20.sol";
import "../interfaces/IERC20Detailed.sol";
import {
    IOtokenFactory,
    IOtoken,
    IController,
    GammaTypes
} from "../interfaces/GammaInterface.sol";
import { Types } from "../Types.sol";
import {Constants} from "./Constants.sol";
import {SafeERC20} from "../tokens/SafeERC20.sol";

library OpynInteractions {
    using SafeERC20 for IERC20;
    /**
     * @notice Either retrieves the option token if it already exists, or deploy it
     * @param oTokenFactory is the address of the opyn oTokenFactory
     * @param usdc is the address of the usd to use
     * @param underlying is the address of the underlying asset of the option
     * @param strikeAsset is the address of the collateral asset of the option
     * @param strike is the strike price of the option
     * @param expiration is the expiry timestamp of the option
     * @param flavor the type of option
     * @return the address of the option
     */
    function getOrDeployOtoken(
        address oTokenFactory,
        address usdc,
        address underlying,
        address strikeAsset,
        uint256 strike,
        uint256 expiration,
        Types.Flavor flavor
    ) external returns (address) {
        IOtokenFactory factory = IOtokenFactory(oTokenFactory);

        address otokenFromFactory =
            factory.getOtoken(
                underlying,
                usdc,
                strikeAsset,
                strike,
                expiration,
                Types.isPut(flavor)
            );

        if (otokenFromFactory != address(0)) {
            return otokenFromFactory;
        }

        address otoken =
            factory.createOtoken(
                underlying,
                usdc,
                strikeAsset,
                strike,
                expiration,
                Types.isPut(flavor)
            );

        return otoken;
    }

    /**
     * @notice Creates the actual Opyn short position by depositing collateral and minting otokens
     * @param gammaController is the address of the opyn controller contract
     * @param marginPool is the address of the opyn margin contract which holds the collateral
     * @param oTokenAddress is the address of the otoken to mint
     * @param depositAmount is the amount of collateral to deposit
     * @return the otoken mint amount
     */
    function createShort(
        address gammaController,
        address marginPool,
        address oTokenAddress,
        uint256 depositAmount
    ) external returns (uint256) {
        IController controller = IController(gammaController);
        uint256 newVaultID =
            (controller.getAccountVaultCounter(address(this))) + 1;

        // An otoken's collateralAsset is the vault's `asset`
        // So in the context of performing Opyn short operations we call them collateralAsset
        IOtoken oToken = IOtoken(oTokenAddress);
        address collateralAsset = oToken.collateralAsset();

        uint256 collateralDecimals =
            uint256(IERC20Detailed(collateralAsset).decimals());
        uint256 mintAmount;

        if (oToken.isPut()) {
            // For minting puts, there will be instances where the full depositAmount will not be used for minting.
            // This is because of an issue with precision.
            //
            // For ETH put options, we are calculating the mintAmount (10**8 decimals) using
            // the depositAmount (10**18 decimals), which will result in truncation of decimals when scaling down.
            // As a result, there will be tiny amounts of dust left behind in the Opyn vault when minting put otokens.
            //
            // For simplicity's sake, we do not refund the dust back to the address(this) on minting otokens.
            // We retain the dust in the vault so the calling contract can withdraw the
            // actual locked amount + dust at settlement.
            //
            // To test this behavior, we can console.log
            // MarginCalculatorInterface(0x7A48d10f372b3D7c60f6c9770B91398e4ccfd3C7).getExcessCollateral(vault)
            // to see how much dust (or excess collateral) is left behind.
            mintAmount = depositAmount
                * 10**Constants.OTOKEN_DECIMALS
                * 10**18 // we use 10**18 to give extra precision
                / oToken.strikePrice() * 10**(10 + collateralDecimals);
        } else {
            mintAmount = depositAmount;

            if (collateralDecimals > 8) {
                uint256 scaleBy = 10**(collateralDecimals - 8); // oTokens have 8 decimals
                if (mintAmount > scaleBy) {
                    mintAmount = depositAmount/ scaleBy; // scale down from 10**18 to 10**8
                }
            }
        }

        // double approve to fix non-compliant ERC20s
        IERC20 collateralToken = IERC20(collateralAsset);
        collateralToken.safeApprove(marginPool, depositAmount);

        IController.ActionArgs[] memory actions =
            new IController.ActionArgs[](3);

        actions[0] = IController.ActionArgs(
            IController.ActionType.OpenVault,
            address(this), // owner
            address(this), // receiver
            address(0), // asset, otoken
            newVaultID, // vaultId
            0, // amount
            0, //index
            "" //data
        );

        actions[1] = IController.ActionArgs(
            IController.ActionType.DepositCollateral,
            address(this), // owner
            address(this), // address to transfer from
            collateralAsset, // deposited asset
            newVaultID, // vaultId
            depositAmount, // amount
            0, //index
            "" //data
        );

        actions[2] = IController.ActionArgs(
            IController.ActionType.MintShortOption,
            address(this), // owner
            address(this), // address to transfer to
            oTokenAddress, // option address
            newVaultID, // vaultId
            mintAmount, // amount
            0, //index
            "" //data
        );

        controller.operate(actions);

        return mintAmount;
    }

}