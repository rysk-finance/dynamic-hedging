import { readContract } from "@wagmi/core";
import { parseUnits } from "ethers/lib/utils.js";
import { useEffect, useState } from "react";
import { LiquidityPoolABI } from "src/abis/LiquidityPool_ABI";
import { getContractAddress } from "src/utils/helpers";

export const useVaultRiskStats = () => {
  const [delta, setDelta] = useState("Soon™️");
  const [sharpe, setSharpe] = useState("Soon™️");
  const [maxDrawdown, setMaxDrawdown] = useState("Soon™️");

  const getDelta = async () => {
    const portfolioDelta = await readContract({
      address: getContractAddress("liquidityPool"),
      abi: LiquidityPoolABI,
      functionName: "getPortfolioDelta",
    });
    setDelta(parseUnits(portfolioDelta.toString(), 18).toString());
  };

  useEffect(() => {
    getDelta();
  }, []);

  return {
    delta,
    sharpe,
    maxDrawdown,
  };
};
