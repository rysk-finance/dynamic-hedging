import { AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";

import { Card } from "src/components/shared/Card";
import LoadingOrError from "src/components/shared/LoadingOrError";
import Disconnected from "./components/Disconnected";
import NoneFound from "./components/NoneFound";
import Table from "./components/Table";
import { usePositions, useRedeem } from "./hooks";

export const UserOptions = () => {
  const { isConnected, isDisconnected } = useAccount();

  const [positions, loading, error] = usePositions();
  const [completeRedeem] = useRedeem();

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
