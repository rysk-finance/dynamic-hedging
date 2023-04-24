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

  const [activePositions, inactivePositions, loading, error] = usePositions();
  const [completeRedeem] = useRedeem();
  const [completeSettle] = useSettle();

  const adjustCollateral = () => {
    setSearchParams({
      ref: "adjust-collateral",
    });
  };

  return (
    <Card
      wrapperClasses="mb-24"
      tabWidth={280}
      tabs={[
        {
          label: loading && !activePositions ? "Loading Open..." : "RYSK.Open",
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

                {isConnected && activePositions && (
                  <>
                    {activePositions.length ? (
                      <Table
                        positions={activePositions}
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
        {
          label:
            loading && !inactivePositions ? "Loading Closed..." : "RYSK.Closed",
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

                {isConnected && inactivePositions && (
                  <>
                    {inactivePositions.length ? (
                      <Table
                        positions={inactivePositions}
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
