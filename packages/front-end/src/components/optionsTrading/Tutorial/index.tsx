import Joyride, { ACTIONS, STATUS } from "react-joyride";

import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";

export const Tutorial = () => {
  const {
    dispatch,
    state: { tutorialIndex },
  } = useOptionsTradingContext();

  const handleCallback = (data: any) => {
    if (
      data.status === STATUS.FINISHED ||
      data.status === STATUS.SKIPPED ||
      data.action === ACTIONS.CLOSE
    ) {
      dispatch({
        type: OptionsTradingActionType.SET_TUTORIAL_INDEX,
        index: undefined,
      });
    }
  };

  return (
    <Joyride
      callback={handleCallback}
      continuous
      disableScrolling={true}
      run={tutorialIndex !== undefined}
      showProgress
      showSkipButton
      spotlightPadding={8}
      stepIndex={tutorialIndex}
      steps={[
        {
          disableBeacon: true,
          target: "#connect-wallet",
          content:
            "If you haven't already, you can begin by clicking here to connect your wallet.",
        },
        {
          target: "#chain-price-info",
          content:
            "Here you can see the current asset price and the 24-hour price change. This data will be refreshed automatically every 120 seconds, or you can manually update it every 30 seconds by clicking this area.",
        },
        {
          target: "#expiry-data-picker",
          content:
            "In this section, you can select the expiry date that you are interested in. You may use the arrows to see other available dates.",
        },
        {
          target: "#filter-checkboxes",
          content:
            "These filters are used to adjust the visible columns in the option chain.",
        },
        {
          target: "#filter-strike-range",
          content:
            "These inputs are used to filter the chain by strike price. You can enter both an upper and lower underlying price.",
        },
        {
          target: "#filter-reset",
          content:
            "Click this reset button to return all filters to their default values.",
        },
        {
          target: "#options-chain",
          content:
            "This is the options chain. To buy an option, you can click on the price in either the bid (sell) or ask (buy) column. Once you do so, you can approve and complete your purchase.",
        },
        {
          target: "#header-dashboard",
          content:
            "To further manage your positions and view more information on your transactions with Rysk, you can visit the dashboard by clicking here.",
        },
      ]}
      styles={{
        options: {
          arrowColor: "#F5F3EC",
          backgroundColor: "#F5F3EC",
          beaconSize: 44,
          primaryColor: "#000",
          textColor: "#000",
        },
      }}
    />
  );
};
