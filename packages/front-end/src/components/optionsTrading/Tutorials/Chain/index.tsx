import Joyride from "react-joyride";
import { useNetwork } from "wagmi";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { kebabToCapital } from "src/utils/caseConvert";
import { useTutorial } from "../Hooks/useTutorial";
import { styles } from "../Styles";

export const OptionChainTutorial = () => {
  const {
    state: { chainTutorialIndex },
  } = useGlobalContext();

  const { chain } = useNetwork();

  const network = chain?.name || kebabToCapital(process.env.REACT_APP_NETWORK);

  const [handleCallback] = useTutorial(
    ActionType.SET_CHAIN_TUTORIAL_INDEX,
    chainTutorialIndex
  );

  return (
    <Joyride
      callback={handleCallback}
      continuous
      disableScrolling={true}
      run={chainTutorialIndex !== undefined}
      showProgress
      showSkipButton
      spotlightPadding={8}
      stepIndex={chainTutorialIndex}
      steps={[
        {
          disableBeacon: true,
          target: "#connect-wallet",
          content: `If you haven't already, you can begin by clicking here to connect your wallet to ${network}.`,
        },
        {
          target: "#chain-price-info",
          content:
            "Here you can see the current underlying spot price and the 24-hour price change. This data will be refreshed automatically, or you can manually update it every 30 seconds by clicking this area.",
        },
        {
          target: "#expiry-data-picker",
          content:
            "In this section, you can select the expiry date of the options that you are interested in. You may use the arrows to see other available dates.",
        },
        {
          target: "#filter-checkboxes",
          content:
            "These filters are used to adjust the visible columns in the option chain.",
        },
        {
          target: "#filter-strike-range",
          content:
            "These inputs are used to filter the options chain by strike price. You can enter both an upper and lower strike price.",
        },
        {
          target: "#filter-reset",
          content:
            "Click this reset button to return all filters to their default values.",
        },
        {
          target: "#options-chain",
          content:
            "This is the options chain. To trade an option, you can click on the price in the buy or sell columns. Once you do so, you can approve and complete your trade. You can also click on any active long positions you have to close all or part of them.",
        },
        {
          target: "#header-dashboard",
          content:
            "To further manage your positions and view more information on your transactions with Rysk, you can visit the dashboard by clicking here.",
        },
      ]}
      styles={styles}
    />
  );
};
