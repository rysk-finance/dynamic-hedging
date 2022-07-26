import React from "react";
import { OptionsTradingContent } from "../components/optionsTrading/OptionsTradingContent";
import { SetOptionParams } from "../components/optionsTrading/SetOptionParams";
import { WIPPopup } from "../components/optionsTrading/WIPPopup";
import { OptionsTradingProvider } from "../state/OptionsTradingContext";

export const OptionsTrading = () => {
  return (
    <OptionsTradingProvider>
      <WIPPopup />
      <SetOptionParams />
      <OptionsTradingContent />
    </OptionsTradingProvider>
  );
};
