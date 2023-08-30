import type { SVGProps } from "react";

import { BaseIcon } from "./BaseIcon";

export const ShortStrangle = (props: SVGProps<SVGSVGElement>) => {
  return (
    <BaseIcon {...props}>
      <path
        className="fill-black group-hover/strategy-icon:fill-red-900"
        d="M8 24L9.5 18H4L8 24Z"
      />
      <path
        className="fill-black group-hover/strategy-icon:fill-green-1100"
        d="M20.039 8H12L9.5 18H22.539L20.039 8Z"
      />
      <path
        className="fill-black group-hover/strategy-icon:fill-red-900"
        d="M28.0001 18H22.5391L24.0391 24L28.0001 18Z"
      />
    </BaseIcon>
  );
};
