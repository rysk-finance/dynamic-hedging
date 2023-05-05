// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../Protocol.sol";
import "../PriceFeed.sol";
import "../BeyondPricer.sol";
import "../VolatilityFeed.sol";
import "../OptionCatalogue.sol";
import "../libraries/Types.sol";
import "../interfaces/IOptionRegistry.sol";
import "../interfaces/IAlphaPortfolioValuesFeed.sol";
import "../interfaces/AddressBookInterface";
import "../interfaces/GammaInterface";

contract Artemis {
	// Protocol contracts
	Protocol public protocol;
	OptionCatalogue public catalogue;
	BeyondPricer public pricer;
	AddressBookInterface public addressBook;
	// asset that denominates the strike price
	address public strikeAsset;
	// asset that is used as the reference asset
	address public underlyingAsset;
	// collateral asset
	// asset that is used for collateral asset
	address public collateralAsset;

	// BIPS
	uint256 private constant MAX_BPS = 10_000;

	///////////////
	/// structs ///
	///////////////


	constructor(
		address _protocol,
		address _catalogue,
		address _pricer,
		address _collateralAsset,
		address _underlyingAsset,
		address _strikeAsset,
		address _keeper,
		address _addressBook
	) {
		protocol = Protocol(_protocol);
		collateralAsset = _collateralAsset;
		underlyingAsset = _underlyingAsset;
		strikeAsset = _strikeAsset;
		catalogue = OptionCatalogue(_catalogue);
		pricer = BeyondPricer(_pricer);
		keeper[_keeper] = true;
		addressBook = AddressBookInterface(_addressBook);
	}

	// keeper mapping
	mapping(address => bool) public keeper;
	
	/// @notice update the keepers
	function setKeeper(address _keeper, bool _auth) external {
		_isKeeper();
		keeper[_keeper] = _auth;
	}

    function execute(uint256 vaultId, address owner) external returns (bool){
        // make sure its a legit caller
        _isKeeper();
		// get vault details
		GammaTypes.Vault memory vault = addressBook.getController().getVault(owner, vaultId);
        // look at the otoken and get its series details
        Types.OptionSeries memory series = _getOptionRegistry.getSeriesInfo(vault.shortOtokens[0]);
        // get the net dhv exposure of this option
		bytes32 optionHash = keccak256(abi.encodePacked(series.expiration, series.strike * 10 ** 10, series.isPut));
		int256 netDhvExposure = getPortfolioValuesFeed().netDhvExposure(optionHash);
        // try catch for the pricer, if it fails we're just going to take over the vault without offloading it
        try
			pricer.quoteOptionPrice(
				Types.OptionSeries(
					series.expiration,
					series.strike * 10 ** 10,
					series.isPut,
					underlyingAsset,
					strikeAsset,
					collateralAsset
				),
				vault.shortAmounts[0] * 10 ** 10,
				false,
				netDhvExposure
			)
		returns (uint256 _premium, int256 _delta, uint256 _fee) {
			uint256 premium = _premium
		} catch {
			// compute the collateral needed for the vault assuming that you will liquidate it
			uint256 collateral = vault.collateralAmounts[0] * 12000 / 10000
			// construct and execute the liquidation transaction to just take over the vault
			actions = new IController.ActionArgs[](4);
			uint256 newVaultID = (controller.getAccountVaultCounter(address(this))) + 1;
			actions[0] = IController.ActionArgs(
				IController.ActionType.OpenVault,
				address(this), // owner
				address(this), // receiver
				address(0), // asset, otoken
				newVaultID, // vaultId
				0, // amount
				0, //index
				abi.encode(1) //data
			);
			actions[1] = IController.ActionArgs(
				IController.ActionType.DepositCollateral,
				address(this), // owner
				address(this), // address to transfer from
				collateralAsset, // deposited asset
				newVaultId, // vaultId
				collateral, // amount
				0, //index
				"" //data
			);
			actions[2] = IController.ActionArgs(
				IController.ActionType.MintShortOption,
				address(this), // owner
				address(this), // address to transfer to
				vault.shortOtokens[0], // option address
				newVaultId, // vaultId
				vault.shortAmounts[0], // amount
				0, //index
				"" //data
			);
			actions[3] = IController.ActionArgs(
				IController.ActionType.Liquidate,
				owner, // owner
				address(this), // address to transfer to
				vault.shortOtokens[0], // option address
				vaultId, // vaultId
				vault.shortAmounts[0], // amount
				0, //index
				"" //data
			);
		}
        // construct the liquidation transaction to liquidate the vault
        // do a try catch for offloading the option to the dhv and withdrawing collateral, make sure we have sufficient capital 
        // to cover any collateralisation we need to do
        // if the offloading would fail then we need to collateralise the vault instead after liquidating so compute the right amount
    }

	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (
			!keeper[msg.sender] && msg.sender != authority.governor() && msg.sender != authority.manager()
		) {
			revert CustomErrors.NotKeeper();
		}
	}

	///////////////////////////
	/// non-complex getters ///
	///////////////////////////

	/**
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function _getPortfolioValuesFeed() internal view returns (IAlphaPortfolioValuesFeed) {
		return IAlphaPortfolioValuesFeed(protocol.portfolioValuesFeed());
	}

    /**
	 * @notice get the option registry used by the liquidity pool
	 * @return the option registry contract
	 */
	function _getOptionRegistry() internal view returns (IOptionRegistry) {
		return IOptionRegistry(protocol.optionRegistry());
	}
}
