import dayjs from "dayjs";
import { Link as RouterLink } from "react-router-dom";

import { Link } from "src/Icons";

const rewardPrograms = [
  {
    dates: {
      start: dayjs.unix(1698998400),
      end: dayjs.unix(1707465600),
    },
    info: (
      <>
        {`The Arbitrum short term incentive program will provide `}
        <b>{`35.6k ARB`}</b>
        {` per week, split evenly between liquidity providers and traders. Anyone with a deposit in the DHV when the weekly epoch is executed will be eligible for rewards. Equally, every contract traded during the epoch will be eligible to earn a share of the weekly rewards based on different trading params. To find out more about eligibility and distribution, deposit into the vault, or make a trade, please follow the link below.`}
      </>
    ),
    links: [
      {
        external: true,
        href: "https://medium.rysk.finance/arbitrum-stip-rewards-for-rysk-6929609e85d7",
        label: "Learn more about the rewards.",
      },
      {
        external: false,
        href: "/vault",
        label: "Deposit now to earn rewards.",
      },
      {
        external: false,
        href: "/",
        label: "Trade options now to earn rewards.",
      },
    ],
    title: "Arbitrum STIP",
  },
];

export const Active = () => (
  <section>
    <h2 className="text-2xl mb-4 pb-4 border-b border-gray-500">{`Active reward programs`}</h2>

    {rewardPrograms.map(({ dates, info, title, links }) => (
      <div className="mb-4 pb-4 border-b border-gray-500" key={title}>
        <h3 className="text-xl mr-4 mb-2 font-bold">
          {title}
          <span className="text-xs ml-4">
            <time dateTime={dates.start.format("YYYY-MM-DD")}>
              {dates.start.format("DD MMM YY")}
            </time>
            {` - `}
            <time dateTime={dates.end.format("YYYY-MM-DD")}>
              {dates.end.format("DD MMM YY")}
            </time>
          </span>
        </h3>

        <p className="mb-2">{info}</p>

        {links.map(({ external, href, label }) => {
          return external ? (
            <a
              className="flex text-sm py-3"
              href={href}
              key={label}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Link className="w-4 h-4 mr-2 my-0.5" />
              {label}
            </a>
          ) : (
            <RouterLink className="flex text-sm py-3" to={href} key={label}>
              <Link className="w-4 h-4 mr-2 my-0.5" />
              {label}
            </RouterLink>
          );
        })}
      </div>
    ))}
  </section>
);
