import type { StrikeOptions } from "src/state/types";

export interface BodyProps {
  chainRows: StrikeOptions[];
  expiry?: string;
}

export interface HeadProps {
  expiry?: string;
}
