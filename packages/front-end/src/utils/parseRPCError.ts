export enum ErrorCode {
  RPC_PARSE = -32603,
  RPC_USER_DENIED = 4001,
  CALL_EXCEPTION = "CALL_EXCEPTION",
}

type RPCError = { code: ErrorCode; message: string };

export const isRPCError = (err: any): err is RPCError => {
  return "code" in err && Object.values(ErrorCode).includes(err.code);
};

const RPCErrorMap: Record<ErrorCode, string> = {
  [ErrorCode.RPC_PARSE]:
    "There was an error submitting your transaction. Please try again later.",
  [ErrorCode.RPC_USER_DENIED]: "You rejected the transaction",
  [ErrorCode.CALL_EXCEPTION]:
    "There was an error making your transaction. Please try again later.",
};

export const parseError = (err: any) => {
  if (isRPCError(err)) {
    return RPCErrorMap[err.code];
  }
  return err;
};

export const DEFAULT_ERROR =
  "There was an error making your transaction. Please try again later or get in contact with the team if it persists.";
