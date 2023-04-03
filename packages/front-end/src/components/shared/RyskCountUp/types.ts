type Format = "ETH" | "Integer" | "IV" | "USD" | "USDC";

export interface RyskCountUpProps {
  value: number;
  fallback?: string | number;
  format?: Format;
}
