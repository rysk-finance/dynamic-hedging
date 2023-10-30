// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../Protocol.sol";
import "../OptionCatalogue.sol";
import "../interfaces/GammaInterface.sol";
import "../AlphaPortfolioValuesFeed.sol";

/**
 *  @title Lens contract to get dhv positions for the quants
 */
contract QuantPositionLensMK1 {

    // protocol
    Protocol public immutable protocol;
    OptionCatalogue public immutable catalogue;
    address public immutable usdc;
    address public immutable weth;
	///////////////
	/// structs ///
	///////////////

    struct DHVPosStruct {
        InstrumentDrill[] instruments; 
    }

	struct InstrumentDrill {
        address seriesAddress;
        uint64 expiration;
        bool isPut;
        uint128 strike; // e18
        address collateralAsset;
        int256 virtualNetDhvExposure; // e18
        int256 shortExposure; // e18
        int256 longExposure; // e18
        bytes32 optionHash;
        bool isBuyable;
        bool isSellable;
	}

	constructor(address _protocol, address _catalogue, address _usdc, address _weth) {
        protocol = Protocol(_protocol);
        catalogue = OptionCatalogue(_catalogue);
        usdc = _usdc;
        weth = _weth;
	}

    function DHVPosDrill() external view returns (DHVPosStruct memory) {
        // get the list of strikes and expiries from the catalogue
        uint64[] memory expirations = getExpirations();
        // multiply by 2 to account for both collateral types
        uint256 count = getCount(expirations) * 2;
        uint64 iter;
        InstrumentDrill[] memory instrumentDrills = new InstrumentDrill[](count);
        for (uint i=0; i < expirations.length; i++) {
            uint128[] memory callStrikes = catalogue.getOptionDetails(expirations[i], false);
		    uint128[] memory putStrikes = catalogue.getOptionDetails(expirations[i], true);
            for (uint j=0; j < callStrikes.length; j++) {
                instrumentDrills[iter] = instrumentDrillConstructor(expirations[i], callStrikes[j], false, usdc);
                iter++;
                instrumentDrills[iter] = instrumentDrillConstructor(expirations[i], callStrikes[j], false, weth);
                iter++;
            }
            for (uint j=0; j < putStrikes.length; j++) {
                instrumentDrills[iter] = instrumentDrillConstructor(expirations[i], putStrikes[j], true, usdc);
                iter++;
                instrumentDrills[iter] = instrumentDrillConstructor(expirations[i], putStrikes[j], true, weth);
                iter++;
            }
        }
        return DHVPosStruct(instrumentDrills);
    }

    function instrumentDrillConstructor(uint64 expiration, uint128 strike, bool isPut, address collateral) public view returns (InstrumentDrill memory) {
			// get series address
            IOptionRegistry optionRegistry = getOptionRegistry();
            AlphaPortfolioValuesFeed pv = getPortfolioValuesFeed();
		    address seriesAddress = optionRegistry.getOtoken(
                weth,
                usdc,
                expiration,
                isPut,
                strike,
                collateral
		    );
			(, int256 shortExposure, int256 longExposure) = pv.storesForAddress(seriesAddress);
            bytes32 oHash = 
            keccak256(
                abi.encodePacked(
                    expiration, 
                    strike, 
                    isPut
                    )
                    );
            int256 virtualNetDhvExposure = AlphaPortfolioValuesFeed(protocol.portfolioValuesFeed()).netDhvExposure(oHash);
            OptionCatalogue.OptionStores memory stores = catalogue.getOptionStores(oHash);
            return InstrumentDrill(
                seriesAddress,
                expiration, 
                isPut,
                strike, 
                collateral,
                virtualNetDhvExposure,
                shortExposure,
                longExposure,
                oHash,
                stores.isBuyable,
                stores.isSellable
            );
    }

	function getExpirations() public view returns (uint64[] memory) {
		uint64[] memory allExpirations = catalogue.getExpirations();
		bool[] memory expirationMask = new bool[](allExpirations.length);
		uint8 validCount;
		for (uint i; i < allExpirations.length; i++) {
			if (allExpirations[i] < block.timestamp) {
				continue;
			}
			expirationMask[i] = true;
			validCount++;
		}
		uint64[] memory expirations = new uint64[](validCount);
		uint8 c;
		for (uint i; i < expirationMask.length; i++) {
			if (expirationMask[i]) {
				expirations[c] = allExpirations[i];
				c++;
			}
		}
		return expirations;
	}
    function getCount(uint64[] memory expirations) internal view returns (uint256 count) {
        for (uint i=0; i < expirations.length; i++) {
		    uint128[] memory callStrikes = catalogue.getOptionDetails(expirations[i], false);
		    uint128[] memory putStrikes = catalogue.getOptionDetails(expirations[i], true);
            count += callStrikes.length;
            count += putStrikes.length;
        }
    }

    /**
	 * @notice get the option registry used by the liquidity pool
	 * @return the option registrt contract
	 */
	function getOptionRegistry() internal view returns (IOptionRegistry) {
		return IOptionRegistry(protocol.optionRegistry());
	}

    /**
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function getPortfolioValuesFeed() internal view returns (AlphaPortfolioValuesFeed) {
		return AlphaPortfolioValuesFeed(protocol.portfolioValuesFeed());
	}
}