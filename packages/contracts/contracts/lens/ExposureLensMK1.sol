// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../Protocol.sol";
import "../interfaces/GammaInterface.sol";
import "../interfaces/IAlphaPortfolioValuesFeed.sol";

/**
 *  @title Lens contract to get user vault positions
 */
contract ExposureLensMK1 {

    // protocol
    Protocol public protocol;

	///////////////
	/// structs ///
	///////////////

	struct SeriesAddressDrill {
		string name;
		string symbol;
        int256 netDhvExposure; // e18
        uint64 expiration;
        bool isPut;
        uint128 strike; // e18
        address collateralAsset;
        bytes32 optionHash;
	}

	constructor(address _protocol) {
        protocol = Protocol(_protocol);
	}

	function getSeriesAddressDetails(address seriesAddress) external view returns (SeriesAddressDrill memory) {
		IOtoken otoken = IOtoken(seriesAddress);
        uint64 expiry = uint64(otoken.expiryTimestamp());
        bool isPut = otoken.isPut();
        uint128 strike = uint128(otoken.strikePrice() * 1e10);
        bytes32 oHash = keccak256(
			abi.encodePacked(expiry, strike, isPut)
		);
		int256 netDhvExposure = IAlphaPortfolioValuesFeed(protocol.portfolioValuesFeed()).netDhvExposure(oHash);
        SeriesAddressDrill memory seriesAddressDrill = SeriesAddressDrill(
            otoken.name(),
            otoken.symbol(),
            netDhvExposure,
            expiry,
            isPut,
            strike,
            otoken.collateralAsset(),
            oHash
            );

        return seriesAddressDrill;
	}
}