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
 * A1 can only parse arguments for open vault actions
 * A2 cannot open vault for an invalid account
 * A3 cannot open vault with an invalid type
 * A4 can only parse arguments for mint actions
 * A5 cannot mint from an invalid account
 * A6 can only parse arguments for burn actions
 * A7 cannot burn from an invalid account
 * A8 can only parse arguments for deposit actions
 * A9 cannot deposit to an invalid account
 * A10 can only parse arguments for withdraw actions
 * A11 cannot withdraw from an invalid account
 * A12 cannot withdraw to an invalid account
 * A13 can only parse arguments for redeem actions
 * A14 cannot redeem to an invalid account
 * A15 can only parse arguments for settle vault actions
 * A16 cannot settle vault for an invalid account
 * A17 cannot withdraw payout to an invalid account
 * A18 can only parse arguments for liquidate action
 * A19 cannot liquidate vault for an invalid account owner
 * A20 cannot send collateral to an invalid account
 * A21 cannot parse liquidate action with no round id
 * A22 can only parse arguments for call actions
 * A23 target address cannot be address(0)
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
        // amount of options to buy
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
        // amount of options to sell
        uint256 amount;
        // recipient of premium
        address recipient;
    }

    /**
     * @notice parses the passed in action arguments to get the arguments for an issue action
     * @param _args general action arguments structure
     * @return arguments for a open vault action
     */
    function _parseIssueArgs(ActionArgs memory _args) internal pure returns (IssueArgs memory) {
        require(_args.actionType == ActionType.Issue, "A1");
        return IssueArgs({optionSeries: _args.optionSeries});
    }

    /**
     * @notice parses the passed in action arguments to get the arguments for a buy option action
     * @param _args general action arguments structure
     * @return arguments for a buy option action
     */
    function _parseBuyOptionArgs(ActionArgs memory _args) internal pure returns (BuyOptionArgs memory) {
        require(_args.actionType == ActionType.BuyOption, "A2");
        
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
     * @return arguments for a buy option action
     */
    function _parseSellOptionArgs(ActionArgs memory _args) internal pure returns (SellOptionArgs memory) {
        require(_args.actionType == ActionType.SellOption, "A3");

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
