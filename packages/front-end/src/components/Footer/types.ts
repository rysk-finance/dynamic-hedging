export interface BlockState {
  block: number;
  synced: boolean;
}

export interface SubgraphStatusResponse {
  block: string;
  synced: boolean;
}
