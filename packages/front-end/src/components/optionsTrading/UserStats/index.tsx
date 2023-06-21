import { AnimatePresence, motion } from "framer-motion";

import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { useGlobalContext } from "src/state/GlobalContext";
import { useUserStats } from "./hooks/useUserStats";
import { Card } from "./components/Card";

export const UserStats = () => {
  const {
    state: {
      options: { data },
      userStats: { allTimePnL, delta },
    },
  } = useGlobalContext();

  useUserStats();

  return (
    <AnimatePresence mode="wait">
      {Object.values(data).length ? (
        <motion.section
          className="grid grid-cols-4 col-start-1 col-end-17 gap-8 mt-8"
          key="user-stats"
          {...FadeInUpDelayed(0.3)}
        >
          <Card
            explainer="Total P/L for all open and closed positions."
            symbol="$"
            title="P/L"
            value={allTimePnL}
          />
          <Card
            explainer="Total delta for all open positions."
            symbol="Δ"
            title="Delta"
            value={delta}
          />
          <Card
            disabled
            explainer="Total gamma for all open positions."
            symbol="Γ"
            title="Gamma"
            value={0}
          />
          <Card
            disabled
            explainer="Total theta for all open positions."
            symbol="θ"
            title="Theta"
            value={0}
          />
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};
