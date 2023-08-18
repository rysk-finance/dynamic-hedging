import type { HeadProps } from "./types";

import dayjs from "dayjs";

import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { DHV_ARTICLE, IV_ARTICLE, OPTIONS_101 } from "src/config/links";
import { useGlobalContext } from "src/state/GlobalContext";
import { useShowColumn } from "../hooks/useShowColumn";

export const Head = ({ expiry }: HeadProps) => {
  const {
    state: {
      options: { activeExpiry },
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const [colSize, sideSize, showCol] = useShowColumn();

  const columns = [
    {
      label: "IV (Sell)",
      tutorial: (
        <div>
          {`The figures in this column represent the sell side implied volatility of the series. `}
          <a
            className="text-cyan-dark-compliant underline"
            href={IV_ARTICLE}
            rel="noopener noreferrer"
            target="_blank"
          >
            {`Learn more about IV.`}
          </a>
        </div>
      ),
      visible: showCol("iv sell"),
    },
    {
      label: "Sell",
      tutorial:
        "The prices in this column represent the amount of premium you will receive for selling one contract of the series. To begin the sale process, you can click on the price.",
      visible: true,
    },
    {
      label: "Buy",
      tutorial:
        "The prices in this column represent the price you will pay to purchase one contract of the series. To begin the buying process, you can click on the price.",
      visible: true,
    },
    {
      label: "IV (Buy)",
      tutorial: (
        <div>
          {`The figures in this column represent the buy side implied volatility of the series. `}
          <a
            className="text-cyan-dark-compliant underline"
            href={IV_ARTICLE}
            rel="noopener noreferrer"
            target="_blank"
          >
            {`Learn more about IV.`}
          </a>
        </div>
      ),
      visible: showCol("iv buy"),
    },
    {
      label: "Delta",
      tutorial: (
        <div>
          {`The figures in this column represent the delta of the series. `}
          <a
            className="text-cyan-dark-compliant underline"
            href={DHV_ARTICLE}
            rel="noopener noreferrer"
            target="_blank"
          >
            {`Learn more about delta.`}
          </a>
        </div>
      ),
      visible: showCol("delta"),
    },
    {
      label: "Position",
      tutorial:
        "The figures in this column show your current net position for the series. A positive value means that you are long and a negative value means that you are short.",
      visible: showCol("pos"),
    },
    {
      label: "DHV",
      tutorial:
        "The figures in this column represent the total exposure of the DHV for the series. A positive value means that the DHV is long and a negative value means that the DHV is short.",
      visible: showCol("exposure"),
    },
  ];

  return (
    <thead className="block w-[150%] lg:w-full border-t-2 border-black">
      <tr
        className="grid bg-bone-dark [&_th]:text-sm [&_th]:py-3 [&_th]:px-0"
        style={{ gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))` }}
      >
        <RyskTooltip
          content={
            <div>
              {`The information on this side of the chain is for call options. `}
              <a
                className="text-cyan-dark-compliant underline"
                href={OPTIONS_101}
                rel="noopener noreferrer"
                target="_blank"
              >
                {`Learn more about calls.`}
              </a>
            </div>
          }
          disabled={!tutorialMode}
          placement="bottom"
        >
          <th style={{ gridColumn: `span ${sideSize} / span ${sideSize}` }}>
            {`CALLS`}
          </th>
        </RyskTooltip>

        <RyskTooltip
          content="The information below is specific to this expiry date."
          disabled={!tutorialMode}
          placement="bottom"
        >
          <th className="col-span-1">
            {activeExpiry &&
              dayjs.unix(Number(expiry || activeExpiry)).format("DD MMM YY")}
          </th>
        </RyskTooltip>

        <RyskTooltip
          content={
            <div>
              {`The information on this side of the chain is for put options. `}
              <a
                className="text-cyan-dark-compliant underline"
                href={OPTIONS_101}
                rel="noopener noreferrer"
                target="_blank"
              >
                {`Learn more about puts.`}
              </a>
            </div>
          }
          disabled={!tutorialMode}
          placement="bottom"
        >
          <th style={{ gridColumn: `span ${sideSize} / span ${sideSize}` }}>
            {`PUTS`}
          </th>
        </RyskTooltip>
      </tr>

      <tr
        className="grid [&_th]:col-span-1 [&_th]:text-xs [&_th]:lg:text-sm [&_th]:xl:text-base [&_th]:py-3"
        style={{ gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))` }}
      >
        {columns.map(
          ({ label, tutorial, visible }) =>
            visible && (
              <RyskTooltip
                content={tutorial}
                disabled={!tutorialMode}
                key={`${label}-call`}
                placement="bottom"
              >
                <th>{label}</th>
              </RyskTooltip>
            )
        )}

        <RyskTooltip
          content="The prices in this column represent the strike price of each option series."
          disabled={!tutorialMode}
        >
          <th className="bg-bone-dark">{`Strike`}</th>
        </RyskTooltip>

        {columns.map(
          ({ label, tutorial, visible }) =>
            visible && (
              <RyskTooltip
                content={tutorial}
                disabled={!tutorialMode}
                key={`${label}-put`}
                placement="bottom"
              >
                <th>{label}</th>
              </RyskTooltip>
            )
        )}
      </tr>
    </thead>
  );
};
