import type { HTMLAttributes } from "react";

export const MainSection = ({ children }: HTMLAttributes<"section">) => (
  <section className="text-justify mb-8 last:mb-0 pt-8 [&_p]:mb-2 [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-lg [&_address]:mb-2 [&_li]:mb-1 [&_ul]:list-disc [&_ul]:ml-8 [&_small]:block">
    {children}
  </section>
);
