import type { HTMLAttributes } from "react";

export const Main = ({ children }: HTMLAttributes<"main">) => (
  <main className="col-start-2 col-end-16 mt-16">{children}</main>
);
