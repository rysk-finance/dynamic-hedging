import { AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";

import { Card } from "src/components/shared/Card";
import LoadingOrError from "src/components/shared/LoadingOrError";
import Disconnected from "./components/Disconnected";
import NoneFound from "./components/NoneFound";
import Table from "./components/Table";
import { usePositions, useRedeem, useSettle } from "./hooks";
import { useSearchParams } from "react-router-dom";

export const UserOptions = () => {
  const { isConnected, isDisconnected } = useAccount();

  const [, setSearchParams] = useSearchParams();

  const [positions, loading, error] = usePositions();
  const [completeRedeem] = useRedeem();
  const [completeSettle] = useSettle();

  const adjustCollateral = (vaultId: string) => {
    setSearchParams({
      ref: "adjust-collateral",
      vault: vaultId,
    });
  };

  return (
    <Card
      wrapperClasses="mb-24"
      tabWidth={280}
      tabs={[
        {
          label: loading && !positions ? "Loading..." : "RYSK.Options",
          content: (
            <>
              <AnimatePresence initial={false} mode="wait">
                {(loading || error) && (
                  <LoadingOrError
                    key="loading-or-error"
                    error={error}
                    extraStrings={["Processing options..."]}
                  />
                )}

                {isConnected && positions && (
                  <>
                    {positions.length ? (
                      <Table
                        positions={positions}
                        completeRedeem={completeRedeem}
                        adjustCollateral={adjustCollateral}
                        completeSettle={completeSettle}
                      />
                    ) : (
                      <NoneFound />
                    )}
                  </>
                )}

                {isDisconnected && <Disconnected />}
              </AnimatePresence>
            </>
          ),
        },
      ]}
    />
  );
};
