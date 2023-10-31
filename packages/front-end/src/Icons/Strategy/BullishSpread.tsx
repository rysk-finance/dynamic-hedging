import type { SVGProps } from "react";

import { BaseIcon } from "./BaseIcon";

export const BullishSpread = (props: SVGProps<SVGSVGElement>) => {
  return (
    <BaseIcon {...props}>
      <path
        className="fill-black group-hover/strategy-icon:fill-green-1100"
        d="M28 8H21L16 16H28V8Z"
      />
      <path
        className="fill-black group-hover/strategy-icon:fill-red-900"
        d="M16 16H4V24H11L16 16Z"
      />
    </BaseIcon>
  );
};
