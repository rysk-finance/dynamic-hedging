import { OptionsTradingContent } from "../components/optionsTrading/OptionsTradingContent";
import { OptionsTradingProvider } from "../state/OptionsTradingContext";

export const OptionsTrading = () => {
  return (
    <OptionsTradingProvider>
      <OptionsTradingContent />
    </OptionsTradingProvider>
  );
};
