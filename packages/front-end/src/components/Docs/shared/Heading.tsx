import type { HTMLAttributes } from "react";

export const Heading1 = ({ children, className }: HTMLAttributes<"h1">) => (
  <h1 className={`mb-5 text-2xl font-dm-mono font-medium ${className}`}>
    {children}
  </h1>
);

export const Heading2 = ({ children, className }: HTMLAttributes<"h2">) => (
  <h2 className={`mb-5 text-xl font-dm-mono font-medium ${className}`}>
    {children}
  </h2>
);

export const Heading3 = ({ children, className }: HTMLAttributes<"h3">) => (
  <h3 className={`mb-5 text-xl font-dm-mono font-medium ${className}`}>
    {children}
  </h3>
);
