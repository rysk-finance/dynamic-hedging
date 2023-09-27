import type { BlockState, SubgraphStatusResponse } from "../types";

import { useEffect, useState } from "react";

import { SUBGRAPH_STATUS } from "src/config/endpoints";
import { logError } from "src/utils/logError";
import { typedFetch } from "src/utils/typedFetch";

const INTERVAL = 1000;
const SUBGRAPH_INTERVAL = 30000;

export const useBlockSyncStatus = () => {
  const [count, setCount] = useState(0);
  const [blockState, setBlockState] = useState<BlockState>({
    block: 0,
    synced: true,
  });

  useEffect(() => {
    const interval = setTimeout(() => {
      setCount((count) => count + INTERVAL);
    }, INTERVAL);

    if (!(count % SUBGRAPH_INTERVAL)) {
      typedFetch<SubgraphStatusResponse>(SUBGRAPH_STATUS)
        .then(({ block, synced }) => {
          setBlockState({
            block,
            synced,
          });
        })
        .catch((error) => {
          logError(error);

          setBlockState({
            block: 0,
            synced: false,
          });
        });
    }

    return () => {
      clearTimeout(interval);
    };
  }, [count]);

  return [blockState.block, blockState.synced] as const;
};
