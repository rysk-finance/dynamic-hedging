import { toast } from "react-toastify";

import { DISCORD_SUPPORT_DESK } from "src/config/links";
import { OPYN_CODES, OPYN_ERRORS } from "../config/errors/opynErrors";
import {
  RYSK_ERRORS,
  RYSK_SIGHASH_ERRORS,
  RYSK_SIGHASH_NO_SUPPORT_ERRORS,
} from "../config/errors/ryskErrors";
import { logError } from "./logError";
import { ERC20_ERRORS, ERC20_KEYS } from "src/config/errors/erc20Errors";
import { UnhandledRPCError } from "./customErrors/UnhandledRPCError";

enum ErrorCode {
  RPC_PARSE = -32603,
  RPC_USER_DENIED = 4001,
  CALL_EXCEPTION = "CALL_EXCEPTION",
}

type RPCError = {
  code: ErrorCode;
  message: string;
  error?: {
    code: number;
    data: {
      code: number;
      data: HexString;
      message: string;
    };
  };
};

const isRPCError = (err: any): err is RPCError => {
  const stringifiedError = `${err}`;
  return (
    stringifiedError.includes("Internal JSON-RPC error.") ||
    stringifiedError.includes("call revert exception")
  );
};

const DEFAULT_ERROR =
  "Sorry, but there was a problem completing your transaction.\n The team has been informed and will be looking into it.";

/**
 * Returns a tuple containing:
 * - A parsed error message from RPC requests or undefined.
 * - A boolean representing whether a support link should be displayed.
 *
 * @param error - The raised network error from an RPC call.
 */
const parseError = (error: any): [string | undefined, boolean] => {
  // Early return if the user manually rejected the tx.
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === ErrorCode.RPC_USER_DENIED
  ) {
    return [undefined, false];
  }

  logError(error);

  if (isRPCError(error)) {
    const errorMessage = error.error?.data.message || error.message;

    if (errorMessage.includes("paused")) {
      return [
        "The system is currently paused. Please try again shortly.",
        false,
      ];
    }

    try {
      const erc20Error = ERC20_KEYS.find((msg) => errorMessage.includes(msg));
      if (erc20Error) {
        return [ERC20_ERRORS[erc20Error], false];
      }

      const opynError = OPYN_CODES.find((code) => errorMessage.includes(code));
      if (opynError) {
        return [OPYN_ERRORS[opynError], true];
      }

      const ryskError = errorMessage
        .match(/errorName="[a-zA-Z]+"/)?.[0]
        .split(/"/)?.[1] as keyof typeof RYSK_ERRORS | undefined;
      if (ryskError) {
        return [RYSK_ERRORS[ryskError], true];
      }

      const errorSigHash = error.error?.data.data;
      if (errorSigHash && errorSigHash in RYSK_SIGHASH_ERRORS) {
        return [RYSK_SIGHASH_ERRORS[errorSigHash], true];
      }

      if (errorSigHash && errorSigHash in RYSK_SIGHASH_NO_SUPPORT_ERRORS) {
        return [RYSK_SIGHASH_NO_SUPPORT_ERRORS[errorSigHash], false];
      }

      throw new UnhandledRPCError(
        `No match for "${errorMessage || errorSigHash}" found in error lists.`
      );
    } catch (error) {
      logError(error);
    }
  }

  return [DEFAULT_ERROR, false];
};

export const errorToast = (error: any) => {
  const [message, showLink] = parseError(error);

  if (message) {
    toast(
      <>
        <em className="font-bold not-italic">{message}</em>
        {showLink && (
          <p>
            {`For more help on this issue, please raise a `}
            <a
              className="text-cyan-dark-compliant underline"
              href={DISCORD_SUPPORT_DESK}
              rel="noopener noreferrer"
              target="_blank"
            >
              {`support ticket via our Discord server.`}
            </a>
          </p>
        )}
      </>,
      {
        className:
          "bg-bone rounded-none border-2 border-red-900 font-dm-sans text-black max-w-xl w-fit",
      }
    );
  }
};
