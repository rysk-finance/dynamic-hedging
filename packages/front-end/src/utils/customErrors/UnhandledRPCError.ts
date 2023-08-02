export class UnhandledRPCError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnhandledRPCError";
  }
}
