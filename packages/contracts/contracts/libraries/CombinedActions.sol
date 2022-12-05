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
		uint256 action;
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
		// in future versions this would be the index of the short / long / collateral asset that needs to be modified
		uint256 index;
		// any other data that needs to be passed in for arbitrary function calls
		bytes data;
	}

	/**
	 * @notice parses the passed in action arguments to get the arguments for an opyn action
	 * @param _args general action arguments structure
	 * @return arguments for an opyn action
	 */
	function _parseOpynArgs(ActionArgs[] memory _args)
		internal
		pure
		returns (IController.ActionArgs[] memory)
	{
		uint256 arr = _args.length;
		IController.ActionArgs[] memory _opynArgs = new IController.ActionArgs[](arr);
		for (uint256 i = 0; i < arr; i++) {
			_opynArgs[i] = (
				IController.ActionArgs({
					actionType: IController.ActionType(_args[i].action),
					owner: _args[i].owner,
					secondAddress: _args[i].secondAddress,
					asset: _args[i].asset,
					vaultId: _args[i].vaultId,
					amount: _args[i].amount,
					index: _args[i].index,
					data: _args[i].data
				})
			);
		}
		return _opynArgs;
	}

	/**
	 * @notice parses the passed in action arguments to get the arguments for a rysk action
	 * @param _args general action arguments structure
	 * @return arguments for a rysk action
	 */
	function _parseRyskArgs(ActionArgs[] memory _args)
		internal
		pure
		returns (RyskActions.ActionArgs[] memory)
	{
		uint256 arr = _args.length;
		RyskActions.ActionArgs[] memory _ryskArgs = new RyskActions.ActionArgs[](arr);
		for (uint256 i = 0; i < arr; i++) {
			_ryskArgs[i] = (
				RyskActions.ActionArgs({
					actionType: RyskActions.ActionType(_args[i].action),
					secondAddress: _args[i].secondAddress,
					asset: _args[i].asset,
					vaultId: _args[i].vaultId,
					amount: _args[i].amount,
					optionSeries: _args[i].optionSeries,
					data: _args[i].data
				})
			);
		}
		return _ryskArgs;
	}
}
