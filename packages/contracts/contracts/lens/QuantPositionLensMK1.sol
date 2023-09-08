// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../Protocol.sol";
import "../interfaces/GammaInterface.sol";
import "../AlphaPortfolioValuesFeed.sol";
import "hardhat/console.sol";
/**
 *  @title Lens contract to get dhv positions for the quants
 */
contract QuantPositionLensMK1 {

    // protocol
    Protocol public protocol;

	///////////////
	/// structs ///
	///////////////

    struct DHVPosStruct {
        InstrumentDrill[] instruments; 
    }

	struct InstrumentDrill {
        address seriesAddress;
		string name;
		string symbol;
        uint64 expiration;
        bool isPut;
        uint128 strike; // e18
        address collateralAsset;
        int256 virtualNetDhvExposure; // e18
        int256 shortExposure; // e18
        int256 longExposure; // e18
        bytes32 optionHash;
	}

	constructor(address _protocol) {
        protocol = Protocol(_protocol);
	}

    function DHVPosDrill() external view returns (DHVPosStruct memory) {
        AlphaPortfolioValuesFeed pv = AlphaPortfolioValuesFeed(protocol.portfolioValuesFeed());
        // get the length of the address set here to save gas on the for loop
        address[] memory seriesAddresses = pv.getAddressSet();
		uint256 lengthAddy = seriesAddresses.length;
        console.log(lengthAddy);
        InstrumentDrill[] memory instrumentDrills = new InstrumentDrill[](lengthAddy);
		for (uint256 i = 0; i < lengthAddy; i++) {
            address seriesAddress = seriesAddresses[i];
			// get series
			(Types.OptionSeries memory optionSeries, int256 shortExposure, int256 longExposure) = pv.storesForAddress(seriesAddress);
            bytes32 oHash = 
            keccak256(
                abi.encodePacked(
                    optionSeries.expiration, 
                    optionSeries.strike, 
                    optionSeries.isPut
                    )
                    );
            int256 virtualNetDhvExposure = AlphaPortfolioValuesFeed(protocol.portfolioValuesFeed()).netDhvExposure(oHash);
            IOtoken otoken = IOtoken(seriesAddress);

            instrumentDrills[i] = InstrumentDrill(
                seriesAddress,
                otoken.name(),
                otoken.symbol(),
                optionSeries.expiration, 
                optionSeries.isPut,
                optionSeries.strike, 
                optionSeries.collateral,
                virtualNetDhvExposure,
                shortExposure,
                longExposure,
                oHash
            );
        }
        return DHVPosStruct(instrumentDrills);
    }
}