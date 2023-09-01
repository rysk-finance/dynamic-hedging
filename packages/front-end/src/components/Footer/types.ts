export interface BlockState {
  offset: number;
  synced: boolean;
}

export interface SubgraphStatusResponse {
  block: number;
  synced: boolean;
}
