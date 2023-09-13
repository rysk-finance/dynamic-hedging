import { useEffect, useState } from "react";
import { logError } from "src/utils/logError";
import { typedFetch } from "src/utils/typedFetch";

interface Response {
  delta: string;
  sharpe: string;
  maxDrawdown: string;
}

export const useVaultRiskStats = () => {
  const [delta, setDelta] = useState("Soon™️");
  const [sharpe, setSharpe] = useState("Soon™️");
  const [maxDrawdown, setMaxDrawdown] = useState("Soon™️");

  const getStats = async () => {
    try {
      const data = await typedFetch<Response>(
        "https://api.rysk.finance/beyond_portfolio_risk_stats"
      );
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
