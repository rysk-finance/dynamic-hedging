import { readContract } from "@wagmi/core";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { getContractAddress } from "src/utils/helpers";

dayjs.extend(utc);

export const getExpiries = async (): Promise<string[]> => {
  const expiries = await readContract({
    address: getContractAddress("DHVLens"),
    abi: DHVLensMK1ABI,
    functionName: "getExpirations",
  });

  return expiries.map((expiry) => expiry.toString()).sort();
};
