import { DHV_NAME } from "src/config/constants";
import { DISCORD_LINK } from "src/config/links";

export const Disclaimer = () => (
  <small className="pb-8 px-8 block w-400">
    {`This chart shows the ${DHV_NAME} share price change since the third epoch (Alpha public launch). Data before this is the result of testing and is excluded. If you have any questions, feel free to `}
    <a href={DISCORD_LINK} target="_blank" rel="noopener noreferrer">
      {`reach out to us via our Discord.`}
    </a>
  </small>
);
