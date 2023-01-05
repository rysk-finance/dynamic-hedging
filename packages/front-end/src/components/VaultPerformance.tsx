import { VaultStats } from "./VaultStats";
import { VaultChart } from "./VaultChart";

export const VaultPerformance = () => {
  return (
    <div>
      <VaultStats />
      <VaultChart />
    </div>
  );
};
