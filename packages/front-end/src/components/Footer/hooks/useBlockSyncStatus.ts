import type { BlockState, SubgraphStatusResponse } from "../types";

import { useEffect, useState } from "react";
import { useBlockNumber } from "wagmi";

import { SUBGRAPH_STATUS } from "src/config/endpoints";
import { logError } from "src/utils/logError";
import { typedFetch } from "src/utils/typedFetch";

const INTERVAL = 1000;
const SUBGRAPH_INTERVAL = 60000;

export const useBlockSyncStatus = () => {
  const [count, setCount] = useState(0);
  const [blockState, setBlockState] = useState<BlockState>({
    offset: 0,
    synced: true,
  });

  const { data: blockHeight } = useBlockNumber({
    watch: true,
  });

  useEffect(() => {
    const interval = setTimeout(() => {
      setCount((count) => count + INTERVAL);
    }, INTERVAL);

    if (!(count % SUBGRAPH_INTERVAL)) {
      try {
        typedFetch<SubgraphStatusResponse>(SUBGRAPH_STATUS).then(
          ({ block, synced }) => {
            const offset = blockHeight ? block - blockHeight : 0;

            setBlockState({
              offset,
              synced,
            });
          }
        );
      } catch (error) {
        logError(error);

        setBlockState({
          offset: 0,
          synced: false,
        });
      }
    }

    return () => {
      clearTimeout(interval);
    };
  }, [count]);

  return [blockHeight, blockState.offset, blockState.synced] as const;
};
