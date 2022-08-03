enum ErrorCode {
  RPC_PARSE = -32603,
}

type RPCError = { code: ErrorCode; message: string };

export const isRPCError = (err: any): err is RPCError => {
  return (
    "code" in err &&
    "message" in err &&
    Object.values(ErrorCode).includes(err.code)
  );
};

const RPCErrorMap: Record<ErrorCode, string> = {
  [ErrorCode.RPC_PARSE]:
    "There was an error submitting your transaction. Please try again later.",
};

export const parseError = (err: any) => {
  if (isRPCError(err)) {
    return RPCErrorMap[err.code];
  }
  return err;
};
