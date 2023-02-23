import { useState, useEffect } from "react";
import { useAccount, useContractWrite, usePrepareContractWrite } from "wagmi";
import { readContract } from "@wagmi/core";
import { erc20ABI } from "../../abis/erc20_ABI";
import { BigNumber } from "ethers";
import { getContractAddress } from "../../utils/helpers";
import { ZERO_ADDRESS } from "../../config/constants";
import { captureException } from "@sentry/react";

/**
 * @author Yassine
 * @title Hook: Approve Transfer
 * @notice  Retrieves allowance and allows to update it
 * @dev Instead of readContract it would be better to use useContractRead
 */
const useApproveTransfer = (): [
  ((overrideConfig?: undefined) => void) | undefined,
  BigNumber | null,
  (value: BigNumber) => void,
  boolean
] => {
  // Global state
  const { address } = useAccount();

  const addressOrDefault = address || ZERO_ADDRESS;

  // Addresses
  const controllerAddress = getContractAddress("OpynController");
  const exchangeAddress = getContractAddress("optionExchange");
  const usdcAddress = getContractAddress("USDC");
  const collateral = usdcAddress;

  // Internal state
  const [allowance, setAllowance] = useState<BigNumber>(BigNumber.from("0"));
  const [amount, setAmount] = useState<BigNumber>(BigNumber.from("0"));

  // Setters
  const updateAmount = (amount: BigNumber) => {
    setAmount(amount);
  };

  // Contract read - read allowance
  useEffect(() => {
    const readAllowance = async () => {
      const current = await readContract({
        address: collateral,
        abi: erc20ABI,
        functionName: "allowance",
        args: [addressOrDefault, exchangeAddress],
      });

      setAllowance(current);
    };

    readAllowance().catch((e: any) => {
      console.log(e);
      captureException(e);
    });
    // note - only address can change here, the rest not because we don't allow network change
  }, [address, exchangeAddress, controllerAddress, collateral]);

  // Contract write - approve
  const { config } = usePrepareContractWrite({
    address: collateral,
    abi: erc20ABI,
    functionName: "approve",
    args: [exchangeAddress, amount],
    enabled: amount?.gt("0"),
  });

  const { write } = useContractWrite(config);

  // Utils
  const isApproved = allowance.gte(amount);

  console.log("Allowance: ", allowance.toString());

  // Interface
  return [
    write, // approve exchange address to transfer from user
    allowance, // currently approved amount
    updateAmount, // update amount requested to approve on write
    isApproved, // whether user has already approved enough
  ];
};

export default useApproveTransfer;
