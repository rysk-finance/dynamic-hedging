import Joyride from "react-joyride";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { useTutorial } from "../Hooks/useTutorial";
import { styles } from "../Styles";

export const SellModalTutorial = () => {
  const {
    state: { sellTutorialIndex },
  } = useGlobalContext();

  const [handleCallback] = useTutorial(
    ActionType.SET_SELL_TUTORIAL_INDEX,
    sellTutorialIndex
  );

  return (
    <Joyride
      callback={handleCallback}
      continuous
      disableScrolling={true}
      run={sellTutorialIndex !== undefined}
      showProgress
      showSkipButton
      spotlightPadding={8}
      stepIndex={sellTutorialIndex}
      steps={[
        {
          disableBeacon: true,
          target: "#sell-symbol",
          content: `Here you can see the asset you have selected to buy. This is represented as "underlying asset - expiry date - strike price - option flavor".`,
        },
        {
          target: "#sell-collateral",
          content:
            "These filters allow you to specify the type of collateral you wish to use and how much you will add.",
        },
        {
          target: "#sell-price-per-option",
          content:
            "These prices represent the cost per option. The premium and fees are displayed separately for transparency, and you can also see how the price is impacted based on order size.",
        },
        {
          target: "#sell-collateral-required",
          content:
            "This price represents the total amount of collateral you must provide to complete the transaction.",
        },
        {
          target: "#sell-total-price",
          content:
            "This price represents the total amount in USDC you will receive after fees.",
        },
        {
          target: "#sell-balances",
          content:
            "These prices represent the estimated remaining balance of the USDC and WETH in your wallet after the transaction.",
        },
        {
          target: "#sell-input",
          content:
            "You can use this input to specify how many contracts you wish to sell. We allow denominations as small as 0.01.",
        },
        {
          target: "#sell-button",
          content:
            "You can click here to approve your spending and complete your purchase. If you do not already have your wallet connected, this button can handle that. Transactions will require two confirmations to be considered complete, and the interface will automatically close once your transaction is complete.",
        },
        {
          target: "#quick-switch",
          content:
            "This handy button will allow you to quickly toggle between buying and selling for the specified strike price and option flavor.",
        },
      ]}
      styles={styles}
    />
  );
};
