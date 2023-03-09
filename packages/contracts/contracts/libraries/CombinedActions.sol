/**
 * SPDX-License-Identifier: UNLICENSED
 */
pragma solidity >=0.8.4;

import "./Types.sol";
import "./RyskActions.sol";
import { IController } from "../interfaces/GammaInterface.sol";

library CombinedActions {

	enum OperationType {
		OPYN,
		RYSK
	}

	struct OperationProcedures {
		OperationType operation;
		CombinedActions.ActionArgs[] operationQueue;
	}

    struct ActionArgs {
        // type of action that is being performed on the system
        uint256 actionType;
        // address of the account owner
        address owner;
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
        // each vault can hold multiple short / long / collateral assets but we are restricting the scope to only 1 of each in this version
        // OR for rysk actions it is the acceptable premium (if option is being sold to the dhv then the actual premium should be more than this number (i.e. max price),
        // if option is being bought from the dhv then the actual premium should be less than this number (i.e. max price))
        uint256 index;
        // any other data that needs to be passed in for arbitrary function calls
        bytes data;
    }

    /**
     * @notice parses the passed in action arguments to get the arguments for an opyn action
     * @param _args general action arguments structure
     * @return arguments for an opyn action
     */
    function _parseOpynArgs(ActionArgs memory _args) internal pure returns (IController.ActionArgs memory) {
        return IController.ActionArgs({
            actionType: IController.ActionType(_args.actionType),
            owner: _args.owner,
            secondAddress: _args.secondAddress,
            asset: _args.asset,
            vaultId: _args.vaultId,
            amount: _args.amount,
            index: _args.index,
            data: _args.data
        });
    }

    /**
     * @notice parses the passed in action arguments to get the arguments for an opyn action
     * @param _args general action arguments structure
     * @return arguments for an opyn action
     */
    function _parseRyskArgs(ActionArgs memory _args) internal pure returns (RyskActions.ActionArgs memory) {
        return RyskActions.ActionArgs({
            actionType: RyskActions.ActionType(_args.actionType),
            secondAddress: _args.secondAddress,
            asset: _args.asset,
            vaultId: _args.vaultId,
            amount: _args.amount,
            optionSeries: _args.optionSeries,
            acceptablePremium: _args.index,
            data: _args.data
        });
    }

}
