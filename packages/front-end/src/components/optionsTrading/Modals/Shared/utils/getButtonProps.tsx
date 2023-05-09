import { Loading } from "src/Icons";
import { capitalise } from "src/utils/caseConvert";

/**
 * Switch function to get the modal button props.
 *
 * @param action - Action for the modal. One of "buy" or "sell".
 * @param transactionPending - Boolean value to determine if the transaction or a fetch is pending.
 * @param isApproved - Boolean value to determine if the transaction is approved.
 * @param handleApprove - Function to handle approval for the transaction.
 * @param handleTransaction - Function to handle the transaction - optional.
 */
export const getButtonProps = (
  action: "buy" | "sell" | "update" | "close",
  transactionPending: boolean,
  isApproved: boolean,
  handleApprove: () => Promise<void>,
  handleTransaction?: () => Promise<void>
) => {
  switch (true) {
    case transactionPending:
      return {
        children: (
          <Loading className="h-8 mx-auto animate-spin text-gray-600" />
        ),
        key: "pending",
        title: "Transaction pending.",
      };

    case isApproved && Boolean(handleTransaction):
      return {
        children: capitalise(action),
        key: action,
        onClick: handleTransaction as () => Promise<void>,
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
