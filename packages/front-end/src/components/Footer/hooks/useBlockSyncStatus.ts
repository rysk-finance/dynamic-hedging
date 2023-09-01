import type { BlockState, SubgraphStatusResponse } from "../types";

import { useEffect, useState } from "react";
import { useBlockNumber } from "wagmi";

import { SUBGRAPH_STATUS } from "src/config/endpoints";
import { typedFetch } from "src/utils/typedFetch";

const INTERVAL = 1000;
const BLOCK_HEIGHT_UPDATE_INTERVAL = 5000;
const SUBGRAPH_INTERVAL = 60000;

export const useBlockSyncStatus = () => {
  const [count, setCount] = useState(0);
  const [blockState, setBlockState] = useState<BlockState>({
    offset: 0,
    synced: false,
  });

  const { data: blockHeight } = useBlockNumber({
    watch: blockState.synced && !(count % BLOCK_HEIGHT_UPDATE_INTERVAL),
  });

  useEffect(() => {
    const interval = setTimeout(() => {
      setCount((count) => count + INTERVAL);
    }, INTERVAL);

    if (!(count % SUBGRAPH_INTERVAL)) {
      typedFetch<SubgraphStatusResponse>(SUBGRAPH_STATUS).then(
        ({ block, synced }) => {
          const offset = block - (blockHeight || 0);

          setBlockState({
            offset,
            synced,
          });
        }
      );
    }

    return () => {
      clearTimeout(interval);
    };
  }, [count]);

  return [blockHeight, blockState.offset, blockState.synced] as const;
};
