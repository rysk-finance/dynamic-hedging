import { useEffect, useState } from "react";
import { logError } from "src/utils/logError";

export const useVaultRiskStats = () => {
  const [delta, setDelta] = useState("Soon™️");
  const [sharpe, setSharpe] = useState("Soon™️");
  const [maxDrawdown, setMaxDrawdown] = useState("Soon™️");

  const getStats = async () => {
    try {
      const res = await fetch(
        `https://api.rysk.finance/beyond_portfolio_risk_stats`
      );
      const data = await res.json();
      setDelta(data.delta);
      setSharpe(data.sharpe);
      setMaxDrawdown(data.maxDrawdown);
    } catch (e) {
      logError(e);
    }
  };

  useEffect(() => {
    getStats();
  }, []);

  return {
    delta,
    sharpe,
    maxDrawdown,
  };
};
