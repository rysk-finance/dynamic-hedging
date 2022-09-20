import * as Fathom from "fathom-client";
import { ErrorCode } from "./parseRPCError";

const FATHOM_ERROR_CODES: Record<ErrorCode, string> = {
  [ErrorCode.RPC_PARSE]: "ERHH7J5R",
  [ErrorCode.RPC_USER_DENIED]: "QOI9HK44",
  [ErrorCode.CALL_EXCEPTION]: "ERHH7J5R",
};

const UNTRACKED_ERROR_CODE = "SPKIPC4H";
const UNKNOWN_ERROR_CODE = "DO3ZXMQO";

export const trackRPCError = (rpcErrorCode: ErrorCode | number | null) => {
  const errorCode = rpcErrorCode
    ? Object.values(ErrorCode).includes(rpcErrorCode)
      ? FATHOM_ERROR_CODES[rpcErrorCode as ErrorCode]
      : UNTRACKED_ERROR_CODE
    : UNKNOWN_ERROR_CODE;
  console.log(`tracking error : ${errorCode}`);
  return Fathom.trackGoal(
    errorCode,
    // This argument doesn't seem to be tracked by fathom so just setting to 0
    0
  );
};
