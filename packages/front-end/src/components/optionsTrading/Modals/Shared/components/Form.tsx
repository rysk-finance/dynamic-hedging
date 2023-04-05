import type { HTMLProps } from "react";

import type { ButtonProps } from "src/components/shared/Button";

import { AnimatePresence } from "framer-motion";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { Button as ConnectButton } from "src/components/shared/Button";

export const Wrapper = ({ children }: HTMLProps<HTMLDivElement>) => (
  <div className="flex h-12 border-black border-y-2">{children}</div>
);

export const Label = ({ children, ...props }: HTMLProps<HTMLLabelElement>) => (
  <label className="grow" {...props}>
    {children}
  </label>
);

export const Input = ({ ...props }: HTMLProps<HTMLInputElement>) => (
  <input
    className="text-center w-full h-full number-input-hide-arrows border-r-2 border-black"
    inputMode="numeric"
    step={0.01}
    type="number"
    {...props}
  />
);

export const Button = ({ ...props }: ButtonProps) => (
  <AnimatePresence mode="wait">
    <ConnectButton
      className="w-1/3 !border-0"
      requiresConnection
      {...FadeInOutQuick}
      {...props}
    />
  </AnimatePresence>
);
