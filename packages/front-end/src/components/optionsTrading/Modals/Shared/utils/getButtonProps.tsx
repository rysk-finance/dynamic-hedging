import { Loading } from "src/Icons";
import { capitalise } from "src/utils/caseConvert";

/**
 * Switch function to get the modal button props.
 *
 * @param action - Action for the modal. One of "buy" or "sell".
 * @param transactionPending - Boolean value to determine if the transaction or a fetch is pending.
 * @param isApproved - Boolean value(s) to determine if the transaction is approved.
 * @param handleApprove - Function to handle approval for the transaction.
 * @param handleTransaction - Function to handle the transaction - optional.
 */
export const getButtonProps = (
  action: "buy" | "close" | "deposit" | "open" | "sell" | "set" | "withdraw",
  transactionPending: boolean,
  isApproved: boolean | [boolean, boolean],
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

    case action === "set":
      return {
        children: capitalise(action),
        key: action,
        onClick: handleApprove,
        title: `Click to ${action}.`,
      };

    case Array.isArray(isApproved) && !isApproved[0] && Boolean(handleApprove):
      return {
        children: "Approve (0/2)",
        key: "approve-first",
        onClick: handleApprove,
        title: "Click to approve.",
      };

    case Array.isArray(isApproved) && !isApproved[1] && Boolean(handleApprove):
      return {
        children: "Approve (1/2)",
        key: "approve-second",
        onClick: handleApprove,
        title: "Click to approve.",
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
        children: "Approve (0/1)",
        key: "approve",
        onClick: handleApprove,
        title: "Click to approve.",
      };
  }
};
