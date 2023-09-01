import type { HTMLAttributes } from "react";

export const OrderedList = ({ children }: HTMLAttributes<"ol">) => (
  <ol className="list-decimal ml-16">{children}</ol>
);
