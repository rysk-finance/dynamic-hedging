import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useMemo } from "react";
import { useAccount } from "wagmi";

import { DownChevron, UpChevron } from "src/Icons";
import { NewControllerABI } from "src/abis/NewController_ABI";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import Resize from "src/animation/Resize";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { GAS_MULTIPLIER, ZERO_ADDRESS } from "src/config/constants";
import { OpynActionType } from "src/enums/OpynActionType";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActivePositionSort } from "src/state/constants";
import { ActionType, ClosingOption } from "src/state/types";
import { toOpyn } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { PositionAction } from "../../../enums";

const opynControllerAddress = getContractAddress("OpynController");

export const Body = () => {
  const { address } = useAccount();

  const {
    dispatch,
    state: {
      options: { refresh },
      userStats: {
        activePositions,
        activePositionsFilters: { compact, hideExpired, isAscending, sort },
      },
    },
  } = useGlobalContext();

  const sortedActivePositions = useMemo(() => {
    return activePositions
      .sort((first, second) => {
        if (sort === ActivePositionSort.Size) {
          return isAscending
            ? first.amount - second.amount
            : second.amount - first.amount;
        } else if (sort === ActivePositionSort.Delta) {
          return isAscending
            ? first.delta - second.delta
            : second.delta - first.delta;
        } else if (sort === ActivePositionSort.PnL) {
          return isAscending
            ? first.profitLoss - second.profitLoss
            : second.profitLoss - first.profitLoss;
        } else {
          return isAscending
            ? first.expiryTimestamp.localeCompare(second.expiryTimestamp)
            : second.expiryTimestamp.localeCompare(first.expiryTimestamp);
        }
      })
      .filter((position) => (hideExpired ? position.isOpen : position));
  }, [activePositions, hideExpired, isAscending, sort]);

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

            const config = await prepareWriteContract({
              address: opynControllerAddress,
              abi: NewControllerABI,
              functionName: "operate",
              args: [
                [
                  {
                    actionType: OpynActionType.Redeem,
                    owner: ZERO_ADDRESS,
                    secondAddress: address as HexString,
                    asset: option.address,
                    vaultId: BigNumber.from(0),
                    amount: toOpyn(option.amount.toString()),
                    index: BigNumber.from(0),
                    data: ZERO_ADDRESS,
                  },
                ],
              ],
            });
            config.request.gasLimit = config.request.gasLimit
              .mul(GAS_MULTIPLIER * 100)
              .div(100);

            if (config.request.data) {
              const { hash } = await writeContract(config);

              await waitForTransactionOrTimer(hash);

              refresh();
            }

            break;
          } catch (error) {
            dispatch({ type: ActionType.SET_USER_STATS, loading: false });
            logError(error);
            break;
          }

        case PositionAction.SETTLE:
          try {
            dispatch({ type: ActionType.SET_USER_STATS, loading: true });

            const config = await prepareWriteContract({
              address: opynControllerAddress,
              abi: NewControllerABI,
              functionName: "operate",
              args: [
                [
                  {
                    actionType: OpynActionType.SettleVault,
                    owner: address as HexString,
                    secondAddress: address as HexString,
                    asset: ZERO_ADDRESS,
                    vaultId: BigNumber.from(option.vault?.vaultId),
                    amount: BigNumber.from(0),
                    index: BigNumber.from(0),
                    data: ZERO_ADDRESS,
                  },
                ],
              ],
            });
            config.request.gasLimit = config.request.gasLimit
              .mul(GAS_MULTIPLIER * 100)
              .div(100);

            if (config.request.data) {
              const { hash } = await writeContract(config);

              await waitForTransactionOrTimer(hash);

              refresh();
            }

            break;
          } catch (error) {
            dispatch({ type: ActionType.SET_USER_STATS, loading: false });
            logError(error);
            break;
          }

        default:
          break;
      }
    };

  return (
    <LayoutGroup>
      <motion.tbody
        className="block border-b-2 border-black border-dashed overflow-y-scroll"
        {...Resize(compact ? "auto" : 220, compact ? 220 : "auto")}
      >
        <AnimatePresence>
          {sortedActivePositions.map(
            (
              {
                action,
                amount,
                breakEven,
                collateral,
                delta,
                disabled,
                entry,
                expiryTimestamp,
                id,
                isPut,
                isShort,
                mark,
                profitLoss,
                series,
                strike,
              },
              index
            ) => (
              <motion.tr
                className="grid grid-cols-12 text-center capitalize [&_td]:border-l-2 first:[&_td]:border-0 [&_td]:border-gray-500 [&_td]:border-dashed [&_td]:py-2.5"
                key={`${id}-${isShort ? "SHORT" : "LONG"}`}
                layout="position"
                {...FadeInUpDelayed(Math.min(index * 0.1, 2))}
              >
                <td
                  className={`col-span-2 flex ${
                    isShort ? "text-red-900" : "text-green-1100"
                  }`}
                >
                  {isShort ? (
                    <DownChevron
                      aria-hidden={true}
                      className="min-w-6 h-6 mx-3 stroke-red-900"
                      strokeWidth={2}
                    />
                  ) : (
                    <UpChevron
                      aria-hidden={true}
                      className="min-w-6 h-6 mx-3 stroke-green 1100"
                      strokeWidth={2}
                    />
                  )}
                  {series}
                </td>
                <td className="font-dm-mono">
                  {<RyskCountUp value={Math.abs(amount)} />}
                </td>
                <td className="font-dm-mono">
                  <RyskCountUp value={delta} />
                </td>
                <td
                  className={`font-dm-mono ${
                    profitLoss < 0 ? "text-red-900" : "text-green-1100"
                  }`}
                >
                  <RyskCountUp value={profitLoss} />
                </td>
                <td className="font-dm-mono">
                  <RyskCountUp value={entry} />
                </td>
                <td className="font-dm-mono">
                  <RyskCountUp value={mark} />
                </td>
                {collateral.amount ? (
                  <td className="col-span-2 decoration-dotted underline cursor-pointer font-dm-mono text-sm">
                    <RyskCountUp
                      prefix="$"
                      value={collateral.liquidationPrice}
                    />
                    {` (`}
                    <RyskCountUp
                      prefix={collateral.asset === "USDC" ? "$" : "Ξ"}
                      value={collateral.amount}
                    />
                    {`)`}
                  </td>
                ) : (
                  <td className="col-span-2 font-dm-mono text-sm">{`N/A`}</td>
                )}
                <td className="font-dm-mono">
                  <RyskCountUp value={breakEven} />
                </td>
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
              </motion.tr>
            )
          )}
        </AnimatePresence>
      </motion.tbody>
    </LayoutGroup>
  );
};
