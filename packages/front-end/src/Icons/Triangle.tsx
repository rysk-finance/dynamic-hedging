import type { SVGProps } from "react";

export const Triangle = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 100 100"
    strokeWidth={1.5}
    stroke="none"
    className="w-6 h-6"
    {...props}
  >
    <polygon points="50 15, 100 100, 0 100" />
  </svg>
);

{
  /* <svg id="triangle" xmlns="http://www.w3.org/2000/svg" 
    xmlns:xlink="http://www.w3.org/1999/xlink" width="30%" height="30%" viewBox="0 0 100 100">
                	<polygon points="50 15, 100 100, 0 100"/>
 </svg> */
}
