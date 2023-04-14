import Joyride from "react-joyride";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { useTutorial } from "../Hooks/useTutorial";
import { styles } from "../Styles";

export const BuyModalTutorial = () => {
  const {
    state: { buyTutorialIndex },
  } = useGlobalContext();

  const [handleCallback] = useTutorial(
    ActionType.SET_BUY_TUTORIAL_INDEX,
    buyTutorialIndex
  );

  return (
    <Joyride
      callback={handleCallback}
      continuous
      disableScrolling={true}
      run={buyTutorialIndex !== undefined}
      showProgress
      showSkipButton
      spotlightPadding={8}
      stepIndex={buyTutorialIndex}
      steps={[
        {
          disableBeacon: true,
          target: "#buy-symbol",
          content: `Here you can see the option you have selected to buy. This is represented as "underlying asset - expiry date - strike price - option type (put or call)".`,
        },
        {
          target: "#buy-price-per-option",
          content:
            "These prices represent the total amount you pay for the option. The premium and fees are displayed separately for transparency, and you can also see how the premium is impacted by slippage based on order size.",
        },
        {
          target: "#buy-total-price",
          content:
            "This price represents the total amount in USDC you are required to pay.",
        },
        {
          target: "#buy-balance",
          content:
            "This price represents the estimated remaining balance of the USDC in your wallet after the transaction.",
        },
        {
          target: "#buy-input",
          content:
            "You can use this input to specify how many contracts you wish to buy. You can buy denominations as small as 0.01.",
        },
        {
          target: "#buy-button",
          content:
            "You can click here to approve your spending and complete your buy trade. If you do not already have your wallet connected, this button can handle that. Transactions will require two confirmations to be considered complete, and the interface will automatically close once your transaction is complete.",
        },
        {
          target: "#quick-switch",
          content:
            "This handy button will allow you to quickly toggle between buying and selling for the selected option.",
        },
      ]}
      styles={styles}
    />
  );
};
