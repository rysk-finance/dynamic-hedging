import type { SVGProps } from "react";

import { BaseIcon } from "./BaseIcon";

export const LongStraddle = (props: SVGProps<SVGSVGElement>) => {
  return (
    <BaseIcon {...props}>
      <path
        className="fill-black group-hover/icon:fill-green-1100"
        d="M4.23775 17.2417L10.2188 17.2417L4.23775 9.2417L4.23775 17.2417Z"
      />
      <path
        className="fill-black group-hover/icon:fill-red-900"
        d="M16.1968 25.2412L22.2168 17.2412L10.2168 17.2412L16.1968 25.2412Z"
      />
      <path
        className="fill-black group-hover/icon:fill-green-1100"
        d="M28.2363 9.24121L22.2173 17.2412L28.2363 17.2412L28.2363 9.24121Z"
      />
    </BaseIcon>
  );
};
