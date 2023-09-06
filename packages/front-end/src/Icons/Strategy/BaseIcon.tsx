import type { SVGProps, PropsWithChildren } from "react";

export const BaseIcon = (props: PropsWithChildren<SVGProps<SVGSVGElement>>) => {
  const { children, className, ...rest } = props;

  const classes = `group/strategy-icon [&_path]:ease-in-out [&_path]:duration-200 ${
    className || "w-6 h-6"
  }`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="3.98 7.96 23.9 16"
      className={classes}
      {...rest}
    >
      {children}
    </svg>
  );
};
