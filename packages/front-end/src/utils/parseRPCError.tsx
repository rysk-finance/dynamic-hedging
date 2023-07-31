import { toast } from "react-toastify";

import { DISCORD_SUPPORT_DESK } from "src/config/links";
import { OPYN_ERRORS } from "../config/errors/opynErrors";
import { RYSK_ERRORS } from "../config/errors/ryskErrors";
import { logError } from "./logError";

export enum ErrorCode {
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
      data: string;
      message: string;
    };
  };
};

export const isRPCError = (err: any): err is RPCError => {
  const stringifiedError = `${err}`;
  return (
    stringifiedError.includes("Internal JSON-RPC error.") ||
    stringifiedError.includes("call revert exception")
  );
};

export const DEFAULT_ERROR =
  "Sorry, but there was a problem completing your transaction.\n The team has been informed and will be looking into it.";

export const parseError = (error: any): string | undefined => {
  // Early return if the user manually rejected the tx.
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === ErrorCode.RPC_USER_DENIED
  ) {
    return;
  }

  logError(error);

  if (isRPCError(error)) {
    const message = error.error?.data.message;

    if (message) {
      const opynCodes = Object.keys(OPYN_ERRORS) as Array<
        keyof typeof OPYN_ERRORS
      >;
      const opynError = opynCodes.find((code) => message.includes(code));

      if (opynError) {
        return OPYN_ERRORS[opynError];
      }
    } else {
      try {
        const name = error.message
          .match(/errorName="[a-zA-Z]+"/)?.[0]
          .split(/"/)?.[1];
        const msg = RYSK_ERRORS[name as keyof typeof RYSK_ERRORS];

        if (msg) {
          return msg;
        } else {
          throw new Error(`No key ${name} in RYSK_ERRORS`);
        }
      } catch (e) {
        logError(e);
      }
    }
  }

  return DEFAULT_ERROR;
};

export const errorToast = (error: any) => {
  const message = parseError(error);

  if (message) {
    toast(
      <>
        <em className="font-bold not-italic">{message}</em>
        <p>
          {`For more help on this issue, please raise a .`}
          <a
            className="text-cyan-dark-compliant underline"
            href={DISCORD_SUPPORT_DESK}
            rel="noopener noreferrer"
            target="_blank"
          >
            {`support ticket via our Discord server.`}
          </a>
        </p>
      </>,
      {
        className:
          "bg-bone rounded-none border-2 border-red-900 font-dm-sans text-black max-w-xl w-fit",
      }
    );
  }
};
