import type { SVGProps } from "react";

import { BaseIcon } from "./BaseIcon";

export const BearishSpread = (props: SVGProps<SVGSVGElement>) => {
  return (
    <BaseIcon {...props}>
      <path
        className="fill-black group-hover/strategy-icon:fill-green-1100"
        d="M4 8H11L16 16H4V8Z"
      />
      <path
        className="fill-black group-hover/strategy-icon:fill-red-900"
        d="M16 16H28V24H21L16 16Z"
      />
    </BaseIcon>
  );
};
