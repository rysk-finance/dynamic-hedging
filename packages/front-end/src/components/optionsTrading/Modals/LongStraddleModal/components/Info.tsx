import type { InfoProps } from "../types";

import { Link } from "src/Icons";
import { STRATEGY_LINKS } from "src/config/links";
import { Symbol } from "../../Shared/components/Symbol";

export const Info = ({ positionData }: InfoProps) => (
  <Symbol
    {...positionData}
    className="w-4/5 border-r-2"
    strategyName="Long Straddle"
  >
    <p className="flex text-center text-sm justify-center">
      {`Outlook: Neutral | Profit: Unlimited | Risk: Defined`}
    </p>

    <p className="flex text-center text-sm justify-center">
      <a
        className="flex !text-cyan-dark-compliant py-3"
        href={STRATEGY_LINKS.LONG_STRADDLE}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Link className="w-4 h-4 mr-2 my-0.5" />
        {`Learn more about long straddles.`}
      </a>
    </p>
  </Symbol>
);
