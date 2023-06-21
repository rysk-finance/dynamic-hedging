import type { UserPositionToken, UserPositions } from "src/state/types";

/**
 * Util function to flatten the user positions in state into lists.
 * Index 0 - All active positions.
 * Index 1 - All long positions in all states.
 * Index 2 - All short positions in all states.
 *
 * @param userPositions - UserPositions from global state.
 *
 * @returns [activeTokens[], longTokens[], shortTokens[]]
 */
export const getTokenLists = (userPositions: UserPositions) => {
  return Object.values(userPositions).reduce(
    (tokenLists, { activeTokens, longTokens, shortTokens }) => {
      if (activeTokens.length) {
        tokenLists[0] = [...tokenLists[0], ...activeTokens];
      }

      if (longTokens.length) {
        tokenLists[1] = [...tokenLists[1], ...longTokens];
      }

      if (shortTokens.length) {
        tokenLists[2] = [...tokenLists[2], ...shortTokens];
      }

      return tokenLists;
    },
    [[], [], []] as UserPositionToken[][]
  );
};
