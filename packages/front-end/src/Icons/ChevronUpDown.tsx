import type { SVGProps } from "react";

interface ChevronUpDownProps extends SVGProps<SVGSVGElement> {
  isAscending?: boolean;
}

export const ChevronUpDown = (props: ChevronUpDownProps) => {
  const { isAscending, ...rest } = props;
  const active = isAscending !== undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-6 h-6"
      {...rest}
    >
      <path
        className={`${
          isAscending && active ? "currentColor" : "text-gray-600"
        }`}
        d="M15.75 15m-7.5-6L12 5.25 15.75 9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className={`${
          !isAscending && active ? "currentColor" : "text-gray-600"
        }`}
        d="M8.25 15L12 18.75 15.75 15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
