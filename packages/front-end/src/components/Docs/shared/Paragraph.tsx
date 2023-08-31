import type { HTMLAttributes } from "react";

export const Paragraph = ({ children }: HTMLAttributes<"p">) => (
  <p className="text-justify mb-2">{children}</p>
);
