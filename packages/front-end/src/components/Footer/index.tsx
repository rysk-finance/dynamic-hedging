import { Link } from "react-router-dom";

import { RyskCountUp } from "../shared/RyskCountUp";
import { copyright, footerData, missionStatement, socials } from "./footerData";
import { RyskTooltip } from "../shared/RyskToolTip";
import { useBlockSyncStatus } from "./hooks/useBlockSyncStatus";

// T&Cs page

export const Footer = () => {
  const [height, offset, synced] = useBlockSyncStatus();

  return (
    <footer className="grid grid-cols-12 bg-black text-white py-16">
      <div className="col-span-3 col-start-2 mb-8">
        <img
          alt="Rysk logo"
          className="h-20 lg:h-24 invert"
          src={"/logo.png"}
          title="Rysk: Uncorrelated Returns"
        />
        <p className="text-justify mt-8 xl:mt-16 text-sm xl:text-base">
          {missionStatement}
        </p>
      </div>

      <div className="col-start-5 border-l border-cyan border-dashed mx-auto mt-8"></div>

      {footerData.map((section) => (
        <div
          className={`font-dm-mono mb-8 mx-px col-span-2 ${section.colStart}`}
          key={section.heading}
        >
          <p className="text-sm lg:text-lg mb-1.5 lg:mb-0.5 pb-3 border-b border-cyan border-dashed">
            {section.heading}
          </p>
          <ul className="col-span-2 pr-8 text-xs lg:text-sm">
            {section.links.map(({ href, label }) => (
              <li key={label}>
                <Link
                  className="block py-3.5 lg:py-2.5 hover:text-bone-dark ease-in-out duration-200"
                  to={href}
                  rel="noopener noreferrer"
                  target={href.includes("http") ? "_blank" : "_self"}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="grid items-center grid-cols-12 col-span-12 col-start-2 col-end-12 border-t border-cyan border-dashed pt-8 font-dm-mono">
        <p className="col-span-12 xl:col-span-4 mx-auto order-3 xl:order-1">
          {copyright}
        </p>

        <div className="col-span-12 xl:col-span-4 flex justify-evenly px-0 xl:px-20 mb-4 xl:mb-0 order-2">
          {socials.map(({ Icon, href }) => (
            <a
              className="block p-1.5"
              href={href}
              key={href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon className="w-8 h-8 ease-in-out duration-200 hover:fill-bone-dark hover:stroke-bone-dark" />
            </a>
          ))}
        </div>

        <RyskTooltip
          content={
            synced
              ? "Subgraph operational and synchronised!"
              : "Subgraph status is currently degraded. Updates may not appear immediately."
          }
          placement="top"
          theme="rysk-light"
        >
          <div className="flex items-center col-span-12 xl:col-span-4 mx-auto mb-4 xl:mb-0 xl:ml-auto order-1 xl:order-3">
            <div
              className={`w-3 h-3 rounded-full animate-pulse mr-3 blur-[2px] ${
                synced ? "bg-green-1100" : "bg-red-900"
              }`}
            />
            <span>
              {`Subgraph block sync: `}
              <RyskCountUp
                format="Integer"
                value={height ? height + offset : 0}
              />
            </span>
          </div>
        </RyskTooltip>
      </div>
    </footer>
  );
};
