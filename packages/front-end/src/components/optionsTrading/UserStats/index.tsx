import { AnimatePresence, motion } from "framer-motion";

import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { useGlobalContext } from "src/state/GlobalContext";
import { Card } from "./components/Card";
import { useUserStats } from "./hooks/useUserStats";

export const UserStats = () => {
  const {
    state: {
      options: { data },
      userStats: { activePnL, delta, historicalPnL },
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
            explainer="Total P/L for all unexpired positions."
            hasData={Boolean(activePnL)}
            title="P/L (active)"
          >
            <RyskCountUp prefix="$" value={activePnL} />
          </Card>
          <Card
            explainer="Total P/L for all open and closed positions."
            hasData={Boolean(historicalPnL)}
            title="P/L (historical)"
          >
            <RyskCountUp prefix="$" value={historicalPnL} />
          </Card>
          <Card
            explainer="Total delta for all open positions."
            hasData={Boolean(delta)}
            title="Delta"
          >
            <RyskCountUp prefix="Δ" value={delta} />
          </Card>
          <Card
            disabled
            explainer="Total gamma for all open positions."
            hasData={false}
            title="Gamma"
          >
            <RyskCountUp prefix="Γ" value={0} />
          </Card>
          <Card
            disabled
            explainer="Total theta for all open positions."
            hasData={false}
            title="Theta"
          >
            <RyskCountUp prefix="θ" value={0} />
          </Card>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};
