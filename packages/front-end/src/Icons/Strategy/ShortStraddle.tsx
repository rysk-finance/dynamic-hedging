import type { SVGProps } from "react";

import { BaseIcon } from "./BaseIcon";

export const ShortStraddle = (props: SVGProps<SVGSVGElement>) => {
  return (
    <BaseIcon {...props}>
      <path
        className="fill-black group-hover/icon:fill-red-900"
        d="M4 24L10.019 16H4V24Z"
      />
      <path
        className="fill-black group-hover/icon:fill-green-1100"
        d="M16.0395 8L10.0195 16H22.0195L16.0395 8Z"
      />
      <path
        className="fill-black group-hover/icon:fill-red-900"
        d="M28.0005 16H22.0195L28.0005 24V16Z"
      />
    </BaseIcon>
  );
};
