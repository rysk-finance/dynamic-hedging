pragma solidity >=0.8.9;

import "./interfaces/IERC20.sol";
import "./tokens/OptionToken.sol";
import "./tokens/UniversalERC20.sol";
import { Types } from "./Types.sol";
import { Constants } from "./libraries/Constants.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import {OpynInteractions} from "./libraries/OpynInteractions.sol";

contract OpynOptionRegistry {

    using UniversalERC20 for IERC20;
    string public constant VERSION = "1.0";
    address internal usd;
    address internal oTokenFactory;
    address internal gammaController;
    address internal marginPool;

    mapping(address => uint) public openInterest;
    mapping(address => uint) public earlyExercised;
    mapping(address => uint) public totalInterest;
    mapping(address => mapping(address => uint)) public writers;
    mapping(address => Types.OptionSeries) public seriesInfo;
    mapping(address => uint) public holdersSettlement;
    mapping(bytes32 => address) seriesAddress;

    event OptionTokenCreated(address token);
    event SeriesRedeemed(address series, uint underlyingAmount, uint strikeAmount);

    constructor(address usdToken, address _oTokenFactory, address _gammaController, address _marginPool) public {
      usd = usdToken;
      oTokenFactory = _oTokenFactory;
      gammaController = _gammaController;
      marginPool = _marginPool;
    }

    /**
     * @notice Either retrieves the option token if it already exists, or deploy it
     * @param  underlying is the address of the underlying asset of the option
     * @param  strikeAsset is the address of the collateral asset of the option
     * @param  expiration is the expiry timestamp of the option
     * @param  flavor the type of option
     * @param  strike is the strike price of the option
     * @return the address of the option
     */
    function issue(address underlying, address strikeAsset, uint expiration, Types.Flavor flavor, uint strike) public returns (address) {
        // deploy an oToken contract address
        require(expiration > block.timestamp, "Already expired");
        require(strike > 1 ether, "Strike is not greater than 1");
        bytes32 issuanceHash = getIssuanceHash(underlying, strikeAsset, expiration, flavor, strike);
        // check for an opyn oToken if it doesn't exist deploy it
        address series = OpynInteractions.getOrDeployOtoken(oTokenFactory, usd, underlying, strikeAsset, strike, expiration, flavor);
        // store the option data as a hash
        seriesInfo[series] = Types.OptionSeries(expiration, flavor, strike, u, s);
        seriesAddress[issuanceHash] = series;
        emit OptionTokenCreated(series);
        return series;
    }

    /**
     * @notice Open an options contract using collateral from the liquidity pool
     * @param  _series the address of the option token to be created
     * @param  amount the amount of options to deploy
     * @return if the transaction succeeded
     */
    function open(address _series, uint amount) public payable returns (bool) {
        // make sure the options are ok to open
        Types.OptionSeries memory series = seriesInfo[_series];
        require(block.timestamp < series.expiration, "Options can not be opened after expiration");
        uint256 collateralAmount;
        // transfer collateral to this contract, collateral will depend on the flavor
        if (series.flavor == Types.Flavor.Call) {
          collateralAmount = openCall(series.underlying, amount);
        } else {
          collateralAmount = openPut(series.strikeAsset, amount, series.strike);
        }
        // mint the option token following the opyn interface
        uint256 mintAmount = OpynInteractions.createShort(gammaController, marginPool, _series, collateralAmount);
        // transfer the option to the liquidity pool
        IERC20(_series).safeTransfer(msg.sender, mintAmount);
        openInterest[_series] += amount;
        totalInterest[_series] += amount;
        writers[_series][msg.sender] += amount;

        return true;
    }

    function close(address _series, uint amount) public returns (bool) {
        // withdraw and burn
        Types.OptionSeries memory series = seriesInfo[_series];

        require(block.timestamp < series.expiration);
        require(openInterest[_series] >= amount);
        OptionToken(_series).burnFrom(msg.sender, amount);

        require(writers[_series][msg.sender] >= amount, "Caller did not write sufficient amount");
        writers[_series][msg.sender] -= amount;
        openInterest[_series] -= amount;
        totalInterest[_series] -= amount;

        if (series.flavor == Types.Flavor.Call) {
          transferOutUnderlying(series, amount);
        } else {
          IERC20(series.strikeAsset).universalTransfer(msg.sender, amount * series.strike / 1 ether);
        }
        return true;
    }

    function exercise(address _series, uint amount) public payable {
        // settle the vault
        Types.OptionSeries memory series = seriesInfo[_series];

        require(block.timestamp < series.expiration, "Series already expired");
        require(openInterest[_series] >= amount, " Amount greater than open interest");
        OptionToken(_series).burnFrom(msg.sender, amount);

        uint exerciseAmount = amount * series.strike;
        require(exerciseAmount / amount == series.strike, "Exercise amount does not balance");
        exerciseAmount /= 1 ether;

        openInterest[_series] -= amount;
        earlyExercised[_series] += amount;

        if (series.flavor == Types.Flavor.Call) {
          exerciseCall(series, amount, exerciseAmount);
        } else {
          exercisePut(series, amount, exerciseAmount);
        }
    }


    function redeem(address _series) external returns (uint underlying, uint strikeAsset) {
        return redeemWriter(_series, msg.sender);
    }

    function redeemWriter(address _series, address writer) public returns (uint underlying, uint strikeAsset) {
        Types.OptionSeries memory series = seriesInfo[_series];

        require(block.timestamp > series.expiration, "Series did not expire");

        (underlying, strikeAsset) = calculateWriterSettlement(writers[_series][writer], _series);

        if (underlying > 0) {
            transferOutUnderlying(series, underlying);
        }

        if (strikeAsset > 0) {
            transferOutStrike(series, strikeAsset);
        }

        emit SeriesRedeemed(_series, underlying, strikeAsset);
        return (underlying, strikeAsset);
    }

    function calculateWriterSettlement(
        uint written,
        address _series
    ) public view returns (uint underlying, uint strikeAsset) {
        Types.OptionSeries memory series = seriesInfo[_series];
        uint unsettledPercent = openInterest[_series] * 1 ether / totalInterest[_series];
        uint exercisedPercent = (totalInterest[_series] - openInterest[_series]) * 1 ether / totalInterest[_series];

        if (series.flavor == Types.Flavor.Call) {
            underlying = written * unsettledPercent / 1 ether;
            strikeAsset = written * exercisedPercent / 1 ether;
            strikeAsset = strikeAsset * series.strike / 1 ether;
            return (underlying, strikeAsset);
        } else {
            strikeAsset = written * unsettledPercent / 1 ether;
            strikeAsset = strikeAsset * series.strike / 1 ether;
            underlying = written * exercisedPercent / 1 ether;
            return (underlying, strikeAsset);
        }
    }

    function settle(address _series) public returns (uint strikeAmount) {
        Types.OptionSeries memory series = seriesInfo[_series];
        require(block.timestamp > series.expiration);

        uint bal = IERC20(_series).balanceOf(msg.sender);
        OptionToken(_series).burnFrom(msg.sender, bal);

        uint percent = bal * 1 ether / (totalInterest[_series] - earlyExercised[_series]);
        strikeAmount = holdersSettlement[_series] * percent / 1 ether;
        IERC20(series.strikeAsset).universalTransfer(msg.sender, strikeAmount);
        return strikeAmount;
    }

    function openCall(address underlying, uint amount) internal returns (uint256) {
      IERC20(underlying).universalTransferFrom(msg.sender, address(this), amount);
      return amount;
    }

    function openPut(address strikeAsset, uint amount, uint strike) internal returns (uint256) {
        uint escrow = OptionsCompute.computeEscrow(amount, strike);
        IERC20(strikeAsset).universalTransferFrom(msg.sender, address(this), escrow);
        return escrow;
    }

    function exerciseCall(Types.OptionSeries memory _series, uint amount, uint exerciseAmount) internal {
      IERC20(_series.underlying).universalTransfer(msg.sender, amount);
      IERC20(_series.strikeAsset).universalTransferFrom(msg.sender, address(this), exerciseAmount);
    }

    function exercisePut(Types.OptionSeries memory _series, uint amount, uint exerciseAmount) internal {
      IERC20(_series.underlying).universalTransferFrom(msg.sender, address(this), amount);
      IERC20(_series.strikeAsset).universalTransfer(msg.sender, exerciseAmount);
    }

   function transferOutUnderlying(Types.OptionSeries memory _series, uint amount) internal {
     IERC20(_series.underlying).universalTransfer(msg.sender, amount);
    }

   function transferOutStrike(Types.OptionSeries memory _series, uint amount) internal {
     IERC20(_series.strikeAsset).universalTransfer(msg.sender, amount);
   }

  /*********
    GETTERS
   *********/

   function getSeriesAddress(bytes32 issuanceHash) public view returns (address) {
     return seriesAddress[issuanceHash];
   }

   function getSeriesInfo(address series)
     public
     view
     returns (Types.OptionSeries memory) {
     return seriesInfo[series];
   }

   function getIssuanceHash(Types.OptionSeries memory _series) public pure returns (bytes32) {
     return getIssuanceHash(_series.underlying, _series.strikeAsset, _series.expiration, _series.flavor, _series.strike);
   }

    /**
     * Helper function for computing the hash of a given issuance.
     */
    function getIssuanceHash(address underlying, address strikeAsset, uint expiration, Types.Flavor flavor, uint strike)
      internal
      pure
      returns(bytes32)
    {
      return keccak256(
         abi.encodePacked(underlying, strikeAsset, expiration, flavor, strike)
      );
    }

}
