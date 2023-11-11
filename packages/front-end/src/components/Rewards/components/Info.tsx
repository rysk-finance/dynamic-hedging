import type { RecipientsProps } from "../types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { ARB } from "src/Icons";

export const Info = ({ recipients, tokens, value }: RecipientsProps) => (
  <section className="grid grid-cols-3 bg-[url('./assets/white-ascii-50.png')] bg-fixed mb-16 py-16 border-2 border-black rounded-lg">
    <span className="text-center border-r-2 border-black">
      <p className="text-2xl mb-2 font-dm-mono">
        <RyskCountUp format="Integer" value={recipients} />
      </p>
      <p className="text-xl">{`Reward recipients`}</p>
    </span>

    <span className="text-center border-r-2 border-black">
      <p className="items-center justify-center flex text-2xl mb-2 font-dm-mono">
        <ARB className="w-8 h-8 mr-4" />
        <RyskCountUp value={tokens} />
      </p>
      <p className="text-xl">{`Distributed`}</p>
    </span>

    <span className="text-center">
      <p className="text-2xl mb-2 font-dm-mono">
        <RyskCountUp prefix="$ " value={value} />
      </p>
      <p className="text-xl">{`Total value*`}</p>
    </span>
  </section>
);
