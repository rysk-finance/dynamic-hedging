import type { ClosingOption } from "src/state/types";
import type { ActionProps } from "./types";

import { useAccount } from "wagmi";

import { PositionAction } from "src/components/optionsTrading/UserStats/enums";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { redeemOrBurn } from "src/components/shared/utils/transactions/redeemOrBurn";
import { settle } from "src/components/shared/utils/transactions/settle";
import { toOpyn } from "src/utils/conversion-helper";
import { useNotifications } from "src/components/optionsTrading/hooks/useNotifications";

export const Action = ({
  action,
  amount,
  collateral,
  disabled,
  expiryTimestamp,
  id,
  isPut,
  isShort,
  series,
  strike,
}: ActionProps) => {
  const { address } = useAccount();

  const {
    dispatch,
    state: {
      options: { refresh },
    },
  } = useGlobalContext();

  const [, handleTransactionSuccess, notifyFailure] = useNotifications();

  const handleActionClick =
    (action: string, expiry: string, option: ClosingOption) => async () => {
      switch (action) {
        case PositionAction.CLOSE:
          dispatch({
            type: ActionType.SET_CLOSING_OPTION,
            expiry,
            option,
          });
          break;

        case PositionAction.REDEEM:
        case PositionAction.BURN:
          try {
            dispatch({ type: ActionType.SET_USER_STATS, loading: true });

            const hash = await redeemOrBurn(
              toOpyn(option.amount.toString()),
              address as HexString,
              option.address,
              refresh
            );

            if (hash) {
              handleTransactionSuccess(hash, action);
            }

            break;
          } catch (error) {
            dispatch({ type: ActionType.SET_USER_STATS, loading: false });
            notifyFailure(error);

            break;
          }

        case PositionAction.SETTLE:
          try {
            dispatch({ type: ActionType.SET_USER_STATS, loading: true });

            const hash = await settle(
              address as HexString,
              refresh,
              option.vault?.vaultId
            );

            if (hash) {
              handleTransactionSuccess(hash, action);
            }

            break;
          } catch (error) {
            dispatch({ type: ActionType.SET_USER_STATS, loading: false });
            notifyFailure(error);

            break;
          }

        default:
          break;
      }
    };

  return (
    <td className="col-span-2 cursor-pointer !py-0">
      <button
        className="w-full h-full decoration-dotted underline"
        disabled={disabled}
        onClick={handleActionClick(action, expiryTimestamp, {
          address: id,
          amount,
          isPut,
          isShort,
          series,
          strike,
          vault: collateral.vault,
        })}
      >
        {action}
      </button>
    </td>
  );
};
