import { DHV_NAME } from "src/config/constants";
import { DISCORD_LINK } from "src/config/links";

export const Disclaimer = () => (
  <small className="block mt-auto pl-8 pb-16 text-justify text-2xs xl:text-sm">
    {`This chart shows the ${DHV_NAME} share price change since the fourth epoch (public launch). Data before this is the result of testing and is excluded. If you have any questions, feel free to `}
    <a
      className="!text-cyan-dark-compliant underline"
      href={DISCORD_LINK}
      target="_blank"
      rel="noopener noreferrer"
    >
      {`reach out to us via our Discord.`}
    </a>
  </small>
);
