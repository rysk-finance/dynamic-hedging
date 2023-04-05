import { OptionsTradingContent } from "../components/optionsTrading";
import { OptionsTradingProvider } from "../state/OptionsTradingContext";

export const OptionsTrading = () => {
  return (
    <OptionsTradingProvider>
      <OptionsTradingContent />
    </OptionsTradingProvider>
  );
};
