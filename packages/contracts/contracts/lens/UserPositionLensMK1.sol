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
		address otoken;
	}

	constructor(address _addressbook) {
		addressbook = AddressBookInterface(_addressbook);
	}

	function getVaultsForUser(address user) external view returns (VaultDrill[] memory) {
		return _loopVaults(user);
	}

	function getVaultsForUserAndOtoken(address user, address otoken) external view returns (uint256) {
		return _searchVaults(user, otoken);
	}

	function _loopVaults(address user) internal view returns (VaultDrill[] memory) {
		IController controller = IController(addressbook.getController());
		uint256 vaultCount = controller.getAccountVaultCounter(user);
		VaultDrill[] memory vaultDrill = new VaultDrill[](vaultCount);
		for (uint i; i < vaultCount; i++) {
			address[] memory otokenarr = controller.getVault(user, i + 1).shortOtokens;
			if (otokenarr.length > 0) {
				vaultDrill[i] = VaultDrill(i + 1, otokenarr[0]);
			} else {
				vaultDrill[i] = VaultDrill(i + 1, address(0));
			}
		}
		return vaultDrill;
	}

	function _searchVaults(address user, address otoken) internal view returns (uint256) {
		IController controller = IController(addressbook.getController());
		uint256 vaultCount = controller.getAccountVaultCounter(user);
		for (uint i; i < vaultCount; i++) {
			VaultDrill memory vault;
			address[] memory otokenarr = controller.getVault(user, i + 1).shortOtokens;
			if (otokenarr.length > 0) {
				if (otokenarr[0] == otoken) {
					return i + 1;
				}
			} else {
				continue;
			}
		}
		return vaultCount+1;
	}
}