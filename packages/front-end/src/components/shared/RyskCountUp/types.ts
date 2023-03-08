type Format = "Integer" | "USD" | "USDC";

export interface RyskCountUpProps {
  value: number;
  fallback?: string | number;
  format?: Format;
}
