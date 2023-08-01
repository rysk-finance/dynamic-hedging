import { useVaultRiskStats } from "src/hooks/useVaultRiskStats";

export const VaultRisksStats = () => {
  const { delta, sharpe, maxDrawdown } = useVaultRiskStats();
  return (
    <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
      <div className="flex h-full w-full justify-around">
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">Current Delta: {delta}</p>
        </div>
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">Sharpe Ratio: {sharpe}</p>
        </div>
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">Max Drawdown: {maxDrawdown}</p>
        </div>
      </div>
    </div>
  );
};
