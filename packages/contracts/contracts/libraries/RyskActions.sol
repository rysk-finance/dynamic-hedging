/**
 * SPDX-License-Identifier: UNLICENSED
 */
pragma solidity >=0.8.4;

import "./Types.sol";

/**
 * @title Actions
 * @author Rysk Team
 * @notice A library that provides a ActionArgs struct, sub types of Action structs, and functions to parse ActionArgs into specific Actions.
 * errorCode
 * A1 can only parse arguments for create otoken actions
 * A2 can only parse arguments for issue actions
 * A3 can only parse arguments for buy option actions
 * A4 can only parse arguments for sell option actions
 */
library RyskActions {
    // possible actions that can be performed
    enum ActionType {
        Issue,
        BuyOption,
        SellOption
    }

    struct ActionArgs {
        // type of action that is being performed on the system
        ActionType actionType;
        // address which we move assets from or to (depending on the action type)
        address secondAddress;
        // asset that is to be transfered
        address asset;
        // index of the vault that is to be modified (if any)
        uint256 vaultId;
        // amount of asset that is to be transfered
        uint256 amount;
        // option series (if any)
        Types.OptionSeries optionSeries;
        // any other data that needs to be passed in for arbitrary function calls
        bytes data;
    }

    struct IssueArgs {
        // option series 
        Types.OptionSeries optionSeries;
    }

    struct BuyOptionArgs {
        // option series
        Types.OptionSeries optionSeries;
        // series address
        address seriesAddress;
        // amount of options to buy, always in e18
        uint256 amount;
        // recipient of the options
        address recipient;
    }

    struct SellOptionArgs {
        // option series
        Types.OptionSeries optionSeries;
        // series address
        address seriesAddress;
        // vault id
        uint256 vaultId;
        // amount of options to sell, always in e18
        uint256 amount;
        // recipient of premium
        address recipient;
    }

    /**
     * @notice parses the passed in action arguments to get the arguments for an issue action
     * @param _args general action arguments structure
     * @return arguments for an issue action
     */
    function _parseIssueArgs(ActionArgs memory _args) internal pure returns (IssueArgs memory) {
        require(_args.actionType == ActionType.Issue, "A2");
        return IssueArgs({optionSeries: _args.optionSeries});
    }

    /**
     * @notice parses the passed in action arguments to get the arguments for a buy option action
     * @param _args general action arguments structure
     * @return arguments for a buy option action
     */
    function _parseBuyOptionArgs(ActionArgs memory _args) internal pure returns (BuyOptionArgs memory) {
        require(_args.actionType == ActionType.BuyOption, "A3");
        
        return
            BuyOptionArgs({
                optionSeries: _args.optionSeries,
                seriesAddress: _args.asset,
                amount: _args.amount,
                recipient: _args.secondAddress
            });
    }


    /**
     * @notice parses the passed in action arguments to get the arguments for a sell option action
     * @param _args general action arguments structure
     * @return arguments for a sell option action
     */
    function _parseSellOptionArgs(ActionArgs memory _args) internal pure returns (SellOptionArgs memory) {
        require(_args.actionType == ActionType.SellOption, "A4");

        return
            SellOptionArgs({
                optionSeries: _args.optionSeries,
                seriesAddress: _args.asset,
                vaultId: _args.vaultId,
                amount: _args.amount,
                recipient: _args.secondAddress
            });
    }

}
