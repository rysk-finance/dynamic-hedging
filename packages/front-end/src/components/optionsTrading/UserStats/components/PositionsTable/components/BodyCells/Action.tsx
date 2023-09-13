import type { ClosingOption } from "src/state/types";
import type { ActionProps } from "./types";

import { useChainModal } from "@rainbow-me/rainbowkit";
import { useAccount, useNetwork } from "wagmi";

import { PositionAction } from "src/components/optionsTrading/UserStats/enums";
import { useNotifications } from "src/components/optionsTrading/hooks/useNotifications";
import { redeemOrBurn } from "src/components/shared/utils/transactions/redeemOrBurn";
import { settle } from "src/components/shared/utils/transactions/settle";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { Convert } from "src/utils/Convert";

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
  shortUSDCExposure,
  strike,
}: ActionProps) => {
  const { address } = useAccount();
  const { chain } = useNetwork();
  const { openChainModal } = useChainModal();

  const {
    dispatch,
    state: {
      options: { refresh },
    },
  } = useGlobalContext();

  const [, handleTransactionSuccess, notifyFailure] = useNotifications();

  const handleActionClick =
    (
      action: string,
      expiry: string,
      option: ClosingOption,
      wrongNetwork?: boolean
    ) =>
    async () => {
      if (openChainModal && wrongNetwork) return openChainModal();

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
              Convert.fromInt(option.amount).toOpyn(),
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
        onClick={handleActionClick(
          action,
          expiryTimestamp,
          {
            address: id,
            amount,
            isPut,
            isShort,
            series,
            shortUSDCExposure,
            strike,
            vault: collateral.vault,
          },
          chain?.unsupported
        )}
      >
        {action}
      </button>
    </td>
  );
};
