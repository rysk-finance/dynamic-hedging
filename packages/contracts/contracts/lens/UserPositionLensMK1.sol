// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../interfaces/GammaInterface.sol";
import "../interfaces/AddressBookInterface.sol";

/**
 *  @title Lens contract to get user vault positions
 */
contract UserPositionLensMK1 {
	// opyn address book
	AddressBookInterface public addressbook;

	///////////////
	/// structs ///
	///////////////

	struct VaultDrill {
		uint256 vaultId;
		address shortOtoken;
		bool hasLongOtoken;
		address longOtoken;
		address collateralAsset;
	}

	constructor(address _addressbook) {
		addressbook = AddressBookInterface(_addressbook);
	}

	function getVaultsForUser(address user) external view returns (VaultDrill[] memory) {
		return _loopVaults(user);
	}

	function getVaultsForUserAndOtoken(address user, address shortOtoken, address longOtoken, address collateralAsset) external view returns (uint256) {
		return _searchVaults(user, shortOtoken, longOtoken, collateralAsset);
	}

	function _loopVaults(address user) internal view returns (VaultDrill[] memory) {
		IController controller = IController(addressbook.getController());
		uint256 vaultCount = controller.getAccountVaultCounter(user);
		VaultDrill[] memory vaultDrill = new VaultDrill[](vaultCount);
		for (uint i; i < vaultCount; i++) {
			address shortOtoken;
			bool hasLongOtoken;
			address longOtoken;
			address collateralAsset;
			GammaTypes.Vault memory otokenVault = controller.getVault(user, i + 1);
			if (otokenVault.shortOtokens.length > 0) {
				shortOtoken = otokenVault.shortOtokens[0];
				collateralAsset = otokenVault.collateralAssets[0];
			} 
			if (otokenVault.longOtokens.length > 0) {
				longOtoken = otokenVault.longOtokens[0];
				hasLongOtoken = true;
			}
			vaultDrill[i] = VaultDrill(i + 1, shortOtoken, hasLongOtoken, longOtoken, collateralAsset);
		}
		return vaultDrill;
	}

	function _searchVaults(address user, address shortOtoken, address longOtoken, address collateralAsset) internal view returns (uint256) {
		IController controller = IController(addressbook.getController());
		uint256 vaultCount = controller.getAccountVaultCounter(user);
		for (uint i; i < vaultCount; i++) {
			GammaTypes.Vault memory otokenVault = controller.getVault(user, i + 1);
			if (otokenVault.shortOtokens.length > 0) {
				if (otokenVault.shortOtokens[0] == shortOtoken){
					if (IOtoken(shortOtoken).collateralAsset() == collateralAsset) {
						if (otokenVault.longOtokens.length > 0) {
							if (otokenVault.longOtokens[0] == longOtoken) {
								return i + 1;
							} else {
								continue;
							}
						} else {
							if (longOtoken == address(0)) {
								return i + 1;
							} else {
								continue;
							}
						}
					} else {
						continue;
					}
				} else {
					continue;
				}
			} else {
				continue;
			}
		}
		return vaultCount + 1;
	}
}