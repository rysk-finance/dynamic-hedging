import { useAccount } from "wagmi";

import { Card } from "src/components/shared/SimpleCard";
import { useGlobalContext } from "src/state/GlobalContext";
import { Filters } from "./components/Filters/Index";
import { Table } from "./components/Table";
import { useUserPositions } from "./hooks/useUserPositions";

export const InactivePositions = () => {
  const { isConnected } = useAccount();

  const {
    state: {
      options: { loading },
      userStats: { inactivePositions },
    },
  } = useGlobalContext();

  useUserPositions();

  return (
    <Card
      explainer="All inactive user positions. Includes expired, liquidated, redeemed and settled."
      hasData={Boolean(inactivePositions.length)}
      loading={loading || (isConnected && !inactivePositions.length)}
      title="Inactive Positions"
    >
      <Table />
      <Filters />
    </Card>
  );
};
