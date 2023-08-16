import type { SVGProps } from "react";

import { BaseIcon } from "./BaseIcon";

export const LongStrangle = (props: SVGProps<SVGSVGElement>) => {
  return (
    <BaseIcon {...props}>
      <path
        className="fill-black group-hover/icon:fill-green-1100"
        d="M3.980469 15.929688 L9.9375 15.929688 L3.980469 7.964844 Z M3.980469 15.929688"
      />
      <path
        className="fill-black group-hover/icon:fill-red-900"
        d="M19.167969 23.964844 L21.769531 16 L9.96875 16 L12.570312 23.964844Z M19.167969 23.964844"
      />
      <path
        className="fill-black group-hover/icon:fill-green-1100"
        d="M27.878906 7.964844 L21.882812 15.929688 L27.878906 15.929688Z M27.878906 7.964844"
      />
    </BaseIcon>
  );
};
