import { useState } from "react";
import { useAccount } from "wagmi";
import { captureException } from "@sentry/react";
import { SimulationResponse, UseTenderlySimulatorConfig } from "./types";

const TENDERLY_API = "https://api.tenderly.co/api/v1/account";
const TENDERLY_USER = process.env.REACT_APP_TENDERLY_USER;
const TENDERLY_PROJECT = process.env.REACT_APP_TENDERLY_PROJECT;
const TENDERLY_ACCESS_KEY = process.env.REACT_APP_TENDERLY_ACCESS_KEY;

const useTenderlySimulator = ({ to }: UseTenderlySimulatorConfig) => {
  // global state
  const { address } = useAccount();

  // local state
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const simulate = async (
    data: string,
    gas: number,
    gasPrice: number,
    value: number
  ): Promise<SimulationResponse | void> => {
    setLoading(true);
    try {
      const response = await fetch(
        `${TENDERLY_API}/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate`,
        {
          method: "POST",
          body: JSON.stringify({
            /* Simulation Configuration */
            save: true, // if true simulation is saved and shows up in the dashboard
            save_if_fails: true, // if true, reverting simulations show up in the dashboard
            simulation_type: "full", // full or quick (full is default)
            network_id: process.env.REACT_APP_CHAIN_ID, // network to simulate on
            /* Standard EVM Transaction object */
            from: address,
            to: to,
            input: data,
            gas: gas,
            gas_price: gasPrice,
            value: value,
          }),
          headers: {
            "X-Access-Key": TENDERLY_ACCESS_KEY as string,
          },
        }
      );

      return await response.json();
    } catch (e: any) {
      captureException(e);
      setError(e.message);
    }
    setLoading(false);
  };

  return [simulate, error, loading] as const;
};

export default useTenderlySimulator;
