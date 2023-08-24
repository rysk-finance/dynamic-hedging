import type { InfoProps } from "../types";

import { Link } from "src/Icons";
import { STRATEGY_LINKS } from "src/config/links";
import { Symbol } from "../../Shared/components/Symbol";
import { OptionChainModalActions } from "src/state/types";

export const Info = ({ positionData, strategy }: InfoProps) => {
  const link =
    strategy === OptionChainModalActions.LONG_STRADDLE
      ? STRATEGY_LINKS.LONG_STRADDLE
      : STRATEGY_LINKS.LONG_STRANGLE;

  return (
    <Symbol
      {...positionData}
      className="w-4/5 border-r-2"
      strategyName={strategy}
    >
      <p className="flex text-center text-xs xl:text-sm justify-center">
        {`Outlook: Neutral | Profit: Unlimited | Risk: Defined`}
      </p>

      <p className="flex text-center text-sm justify-center">
        <a
          className="flex !text-cyan-dark-compliant py-3"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Link className="w-4 h-4 mr-2 my-0.5" />
          {`Learn more about ${strategy.toLowerCase()}s.`}
        </a>
      </p>
    </Symbol>
  );
};
