import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

export const ArrowButton = (
  props: DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
) => (
  <button
    {...props}
    className="flex justify-center py-3 enabled:hover:bg-bone-dark ease-in-out duration-100 disabled:opacity-40"
  />
);
