import { useEffect, useState } from "react";
import { useContractEvent } from "wagmi";
import { readContract } from "@wagmi/core";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { getContractAddress } from "src/utils/helpers";

const exchangeAddress = getContractAddress("optionExchange");

export const usePaused = () => {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    readContract({
      address: exchangeAddress,
      abi: OptionExchangeABI,
      functionName: "paused",
    }).then(setPaused);
  }, []);

  useContractEvent({
    address: exchangeAddress,
    abi: OptionExchangeABI,
    eventName: "Paused",
    listener: () => setPaused(true),
  });

  useContractEvent({
    address: exchangeAddress,
    abi: OptionExchangeABI,
    eventName: "Unpaused",
    listener: () => setPaused(false),
  });

  return [paused];
};
