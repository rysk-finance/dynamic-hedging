import React from "react";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";

export const Purchase: React.FC = () => {
  const {
    state: { selectedOption },
  } = useOptionsTradingContext();

  return selectedOption ? (
    <div>
      <h4>Buy: {selectedOption.type}</h4>
      <p>Strike: {selectedOption.strike}</p>
      <p>IV: {selectedOption.IV}</p>
      <p>Delta: {selectedOption.delta}</p>
      <p>Price: {selectedOption.price}</p>
    </div>
  ) : null;
};
