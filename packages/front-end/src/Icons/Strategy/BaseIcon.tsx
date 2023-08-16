import type { SVGProps, PropsWithChildren } from "react";

export const BaseIcon = (props: PropsWithChildren<SVGProps<SVGSVGElement>>) => {
  const { children, className, ...rest } = props;

  const classes = `group/icon [&_path]:ease-in-out [&_path]:duration-150 ${
    className || "w-6 h-6"
  }`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 32 32"
      className={classes}
      {...rest}
    >
      {children}
    </svg>
  );
};
