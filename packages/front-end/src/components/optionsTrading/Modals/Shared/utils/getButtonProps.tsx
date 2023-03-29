import { Loading } from "src/Icons";
import { capitalise } from "src/utils/caseConvert";

/**
 * Switch function to get the modal button props.
 *
 * @param action - Action for the modal. One of "buy" or "sell".
 * @param dataPending - Boolean value to determine if the transaction or a fetch is pending.
 * @param isApproved - Boolean value to determine if the transaction is approved.
 * @param handleApprove - Function to handle approval for the transaction.
 * @param handleTransaction - Function to handle the transaction.
 */
export const getButtonProps = (
  action: "buy" | "sell",
  dataPending: boolean,
  isApproved: boolean,
  handleApprove: () => Promise<void>,
  handleTransaction: () => Promise<void>
) => {
  switch (true) {
    case dataPending:
      return {
        children: (
          <Loading className="h-8 mx-auto animate-spin text-gray-600" />
        ),
        key: "pending",
        onClick: () => {},
        title: "Transaction pending.",
      };

    case isApproved:
      return {
        children: capitalise(action),
        key: action,
        onClick: handleTransaction,
        title: `Click to ${action}.`,
      };

    default:
      return {
        children: "Approve",
        key: "approve",
        onClick: handleApprove,
        title: "Click to approve.",
      };
  }
};
