// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "../interfaces/IERC20.sol";
import {
    IOtokenFactory,
    IOtoken,
    IController,
    GammaTypes
} from "../interfaces/GammaInterface.sol";
import { Types } from "./Types.sol";
import {Constants} from "./Constants.sol";
import "./SafeTransferLib.sol";
import "hardhat/console.sol";

library OpynInteractionsV2 {

    uint256 private constant SCALE_FROM = 10**10;
    
    /**
     * @notice Either retrieves the option token if it already exists, or deploy it
     * @param oTokenFactory is the address of the opyn oTokenFactory
     * @param collateral asset that is held as collateral against short/written options
     * @param underlying is the address of the underlying asset of the option
     * @param strikeAsset is the address of the collateral asset of the option
     * @param strike is the strike price of the option in 1e8 format
     * @param expiration is the expiry timestamp of the option
     * @param flavor the type of option
     * @return the address of the option
     */
    function getOrDeployOtoken(
        address oTokenFactory,
        address collateral,
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
                strikeAsset,
                collateral,
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
                strikeAsset,
                collateral,
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
     * @param vaultId is the vault id to use for creating this short 
     * @param amount is the mint amount in 1e18 format
     * @param vaultType is the type of vault to be created
     * @return the otoken mint amount
     */
    function createShort(
        address gammaController,
        address marginPool,
        address oTokenAddress,
        uint256 depositAmount,
        uint256 vaultId,
        uint256 amount,
        uint256 vaultType
    ) external returns (uint256) {
        IController controller = IController(gammaController);

        // An otoken's collateralAsset is the vault's `asset`
        // So in the context of performing Opyn short operations we call them collateralAsset
        IOtoken oToken = IOtoken(oTokenAddress);
        address collateralAsset = oToken.collateralAsset();
        // TODO Consider if safemath division is needed here
        uint256 mintAmount = amount / SCALE_FROM;

        // double approve to fix non-compliant ERC20s
        ERC20 collateralToken = ERC20(collateralAsset);
        SafeTransferLib.safeApprove(collateralToken, marginPool, depositAmount);
        // initialise the controller args with 2 incase the vault already exists
        IController.ActionArgs[] memory actions =
                new IController.ActionArgs[](2);
        // check if a new vault needs to be created
        uint256 newVaultID =
            (controller.getAccountVaultCounter(address(this))) + 1;
        if (newVaultID == vaultId) {
            actions = new IController.ActionArgs[](3);

            actions[0] = IController.ActionArgs(
                IController.ActionType.OpenVault,
                address(this), // owner
                address(this), // receiver
                address(0), // asset, otoken
                vaultId, // vaultId
                0, // amount
                0, //index
                abi.encode(vaultType) //data
            );

            actions[1] = IController.ActionArgs(
                IController.ActionType.DepositCollateral,
                address(this), // owner
                address(this), // address to transfer from
                collateralAsset, // deposited asset
                vaultId, // vaultId
                depositAmount, // amount
                0, //index
                "" //data
            );

            actions[2] = IController.ActionArgs(
                IController.ActionType.MintShortOption,
                address(this), // owner
                address(this), // address to transfer to
                oTokenAddress, // option address
                vaultId, // vaultId
                mintAmount, // amount
                0, //index
                "" //data
            );
        } else {

            actions[0] = IController.ActionArgs(
                IController.ActionType.DepositCollateral,
                address(this), // owner
                address(this), // address to transfer from
                collateralAsset, // deposited asset
                vaultId, // vaultId
                depositAmount, // amount
                0, //index
                "" //data
            );

            actions[1] = IController.ActionArgs(
                IController.ActionType.MintShortOption,
                address(this), // owner
                address(this), // address to transfer to
                oTokenAddress, // option address
                vaultId, // vaultId
                mintAmount, // amount
                0, //index
                "" //data
            );

        }

        controller.operate(actions);

        return mintAmount;
    }

    /**
     * @notice Burns an opyn short position
     * @param gammaController is the address of the opyn controller contract
     * @param oTokenAddress is the address of the otoken to burn
     * @param burnAmount is the amount of options to burn
     * @param vaultId is the vault id used that holds the short
     * @return the otoken burn amount
     */
    function burnShort(
        address gammaController,
        address oTokenAddress,
        uint256 burnAmount,
        uint256 vaultId
    ) external returns (uint256) {
        IController controller = IController(gammaController);
        // An otoken's collateralAsset is the vault's `asset`
        // So in the context of performing Opyn short operations we call them collateralAsset
        IOtoken oToken = IOtoken(oTokenAddress);
        IERC20 collateralAsset = IERC20(oToken.collateralAsset());
        uint256 startCollatBalance = collateralAsset.balanceOf(address(this));
        GammaTypes.Vault memory vault =
            controller.getVault(address(this), vaultId);
        // initialise the controller args with 2 incase the vault already exists
        IController.ActionArgs[] memory actions =
                new IController.ActionArgs[](2);

        actions[0] = IController.ActionArgs(
            IController.ActionType.BurnShortOption,
            address(this), // owner
            address(this), // address to transfer from
            oTokenAddress,// oToken address
            vaultId,      // vaultId
            burnAmount,   // amount to burn
            0,             //index
            ""             //data
        );

        actions[1] = IController.ActionArgs(
            IController.ActionType.WithdrawCollateral,
            address(this), // owner
            address(this), // address to transfer to
            address(collateralAsset), // withdrawn asset
            vaultId, // vaultId
            vault.collateralAmounts[0] * burnAmount / vault.shortAmounts[0], // amount
            0, //index
            "" //data
        );

        controller.operate(actions);
        return collateralAsset.balanceOf(address(this)) - startCollatBalance;
    }

    /**
     * @notice Close the existing short otoken position.
     * @param gammaController is the address of the opyn controller contract
     * @param vaultId is the id of the vault to be settled
     * @return amount of collateral redeemed from the vault
     */
    function settle(address gammaController, uint256 vaultId) external returns (uint256) {
        IController controller = IController(gammaController);

        GammaTypes.Vault memory vault =
            controller.getVault(address(this), vaultId);

        require(vault.shortOtokens.length > 0, "No short");

        // An otoken's collateralAsset is the vault's `asset`
        // So in the context of performing Opyn short operations we call them collateralAsset
        IERC20 collateralToken = IERC20(vault.collateralAssets[0]);

        // The short position has been previously closed, or all the otokens have been burned.
        // So we return early.
        if (address(collateralToken) == address(0)) {
            return 0;
        }

        // This is equivalent to doing IERC20(vault.asset).balanceOf(address(this))
        uint256 startCollateralBalance =
            collateralToken.balanceOf(address(this));

        // If it is after expiry, we need to settle the short position using the normal way
        // Delete the vault and withdraw all remaining collateral from the vault
        IController.ActionArgs[] memory actions =
            new IController.ActionArgs[](1);

        actions[0] = IController.ActionArgs(
            IController.ActionType.SettleVault,
            address(this), // owner
            address(this), // address to transfer to
            address(0), // not used
            vaultId, // vaultId
            0, // not used
            0, // not used
            "" // not used
        );

        controller.operate(actions);

        uint256 endCollateralBalance = collateralToken.balanceOf(address(this));

        return endCollateralBalance - startCollateralBalance;
    }


    /**
     * @notice Exercises an ITM option
     * @param gammaController is the address of the opyn controller contract
     * @param marginPool is the address of the opyn margin pool
     * @param series is the address of the option to redeem
     * @param amount is the number of oTokens to redeem
     * @return amount of asset received by exercising the option
     */
    function redeem(
        address gammaController,
        address marginPool,
        address series,
        uint256 amount
    ) external returns (uint256) {
        IController controller = IController(gammaController);

        address asset = IOtoken(series).collateralAsset();
        uint256 startAssetBalance = IERC20(asset).balanceOf(msg.sender);

        // If it is after expiry, we need to redeem the profits
        IController.ActionArgs[] memory actions =
            new IController.ActionArgs[](1);

        actions[0] = IController.ActionArgs(
            IController.ActionType.Redeem,
            address(0), // not used
            msg.sender, // address to send profits to
            series, // address of otoken
            0, // not used
            amount, // otoken balance
            0, // not used
            "" // not used
        );
        SafeTransferLib.safeApprove(ERC20(series), marginPool, amount);
        controller.operate(actions);

        uint256 endAssetBalance = IERC20(asset).balanceOf(msg.sender);
        return endAssetBalance - startAssetBalance;
    }


}
