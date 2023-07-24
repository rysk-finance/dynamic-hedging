import { AnimatePresence, motion } from "framer-motion";

import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { useGlobalContext } from "src/state/GlobalContext";
import { Card } from "../../shared/SimpleCard";
import { Filters } from "./components/Filters";
import { Table } from "./components/PositionsTable";
import { useUserStats } from "./hooks/useUserStats";

export const UserStats = () => {
  const {
    state: {
      options: { data, loading },
      userStats: {
        activePnL,
        activePositions,
        delta,
        historicalPnL,
        loading: statsLoading,
      },
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
            explainer="All active user positions. Please check the dashboard area for historical positions."
            hasData={Boolean(activePositions.length)}
            loading={loading || statsLoading}
            span={["col-span-4", "col-span-4"]}
            title="Active Positions"
          >
            <Table />
            <Filters />
          </Card>

          <Card
            explainer="Total P/L for all active positions."
            hasData={Boolean(activePnL)}
            loading={loading || statsLoading}
            title="P/L (active)"
          >
            <p className="text-lg xl:text-2xl mb-2">
              {<RyskCountUp prefix="$" value={activePnL} />}
            </p>
          </Card>
          <Card
            explainer="Total P/L for all open and closed positions."
            hasData={Boolean(historicalPnL)}
            loading={loading || statsLoading}
            title="P/L (historical)"
          >
            <p className="text-lg xl:text-2xl mb-2">
              <RyskCountUp prefix="$" value={historicalPnL} />
            </p>
          </Card>
          <Card
            explainer="Total delta for all open positions."
            hasData={
              Boolean(delta) || (Boolean(activePositions.length) && delta === 0)
            }
            loading={loading || statsLoading}
            title="Delta"
          >
            <p className="text-lg xl:text-2xl mb-2">
              <RyskCountUp prefix="Δ" value={delta} />
            </p>
          </Card>
          <Card
            disabled
            explainer="Total gamma for all open positions."
            hasData={false}
            loading={loading || statsLoading}
            title="Gamma"
          >
            <p className="text-lg xl:text-2xl mb-2">
              <RyskCountUp prefix="Γ" value={0} />
            </p>
          </Card>
          <Card
            disabled
            explainer="Total theta for all open positions."
            hasData={false}
            loading={loading || statsLoading}
            title="Theta"
          >
            <p className="text-lg xl:text-2xl mb-2">
              <RyskCountUp prefix="θ" value={0} />
            </p>
          </Card>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};
