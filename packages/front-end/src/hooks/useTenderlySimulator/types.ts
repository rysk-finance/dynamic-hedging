export interface UseTenderlySimulatorConfig {
  to: string;
}

// note - only adding relevant fields
export interface SimulationResponse {
  generated_access_list: Array<string>;
  contracts: object;
  transaction: object;
  simulation: {
    status: boolean;
    error_message: string;
    from: string;
    gas: number;
    gas_price: string;
    gas_used: number;
    method: string;
    network_id: string;
    nonce: number;
    created_at: string;
    value: string;
    input: string;
    block_number: number;
  };
}
