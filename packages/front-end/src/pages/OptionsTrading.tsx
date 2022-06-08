import React from "react";
import { OptionsTradingContent } from "../components/optionsTrading/OptionsTradingContent";
import { SetOptionParams } from "../components/optionsTrading/SetOptionParams";
import { OptionsTradingProvider } from "../state/OptionsTradingContext";

export const OptionsTrading = () => {
  return (
    <OptionsTradingProvider>
      <SetOptionParams />
      <OptionsTradingContent />
    </OptionsTradingProvider>
  );
};
