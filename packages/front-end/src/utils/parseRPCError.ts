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

export const parseError = (err: any) => {
  if (isRPCError(err)) {
    const message = err.error?.data.message;
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
        const name = err.message
          .match(/errorName="[a-zA-Z]+"/)?.[0]
          .split(`errorName="`)?.[1]
          .replace(`"`, "");
        const msg = RYSK_ERRORS[name as keyof typeof RYSK_ERRORS];
        if (msg) {
          return msg;
        } else {
          throw Error(`No key ${name} in RYSK_ERRORS`);
        }
      } catch (e) {
        logError(e);
      }
    }
    return DEFAULT_ERROR;
  }
  return err;
};
