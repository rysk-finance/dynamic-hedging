import { usePrepareContractWrite, useContractWrite, useAccount } from "wagmi";
import { gql, useQuery } from "@apollo/client";
import { EMPTY_SERIES, ZERO_ADDRESS } from "../../config/constants";
import { OptionSeries } from "../../types";
import { OptionExchangeABI } from "../../abis/OptionExchange_ABI";
import { AbiCoder } from "ethers/lib/utils";
import { useState } from "react";
import { BigNumber } from "ethers";
import { getContractAddress } from "../../utils/helpers";
import { QueryData } from "./types";
import { toast } from "react-toastify";
import useTenderlySimulator from "../useTenderlySimulator";

const abiCode = new AbiCoder();

/**
 * @author Yassine
 * @title Hook: Sell Operate
 * @notice It allows to send actions for selling option to the OptionExchange
 * @dev This is the flow that mints the oToken instead of selling one the user owns
 */
const useSellOperate = (): [
  ((overrideConfig?: undefined) => void) | undefined,
  (value: BigNumber) => void,
  (value: BigNumber) => void,
  (value: Pick<OptionSeries, "expiration" | "strike" | "isPut">) => void,
  (value: HexString) => void
] => {
  // Global state
  const { address } = useAccount();

  const addressOrDefault = address || ZERO_ADDRESS;

  // Hooks
  const [simulateOperation] = useTenderlySimulator({
    to: getContractAddress("optionExchange"),
  });

  // Addresses
  const exchangeAddress = getContractAddress("optionExchange");
  const usdcAddress = getContractAddress("USDC");
  const wethAddress = getContractAddress("WETH");
  const collateral = usdcAddress;
  const strike = usdcAddress;
  const underlying = wethAddress;

  // Internal state
  // note - set by user, and it's the collateral they want to put down
  const [margin, setMargin] = useState<BigNumber>(BigNumber.from("0"));
  // note - amount of otokens to be minted
  const [amount, setAmount] = useState<BigNumber>(BigNumber.from("0"));
  // note - partial option series as assets are hardcoded above
  const [optionSeries, setOptionSeries] = useState<
    Pick<OptionSeries, "expiration" | "strike" | "isPut">
  >({
    expiration: BigNumber.from(1),
    strike: BigNumber.from(1),
    isPut: true,
  });
  // note - callStatic.createOtoken, could be derived from data above
  const [oToken, setOToken] = useState<HexString>(ZERO_ADDRESS);

  const { data } = useQuery<QueryData>(
    gql`
      query Account($account: String!) {
        account(id: $account) {
          id
          vaultCount
        }
      }
    `,
    {
      variables: { account: address?.toLowerCase() },
    }
  );

  const nextVaultId = BigNumber.from(Number(data?.account.vaultCount) + 1 || 0);

  // Setters
  const updateMargin = (amount: BigNumber) => {
    setMargin(amount);
  };
  const updateAmount = (amount: BigNumber) => {
    setAmount(amount);
  };
  const updateOptionSeries = (
    optionSeries: Pick<OptionSeries, "expiration" | "strike" | "isPut">
  ) => {
    setOptionSeries(optionSeries);
  };
  const updateOToken = (address: HexString) => {
    setOToken(address);
  };

  // Contract write
  const { config, data: prepareWriteData } = usePrepareContractWrite({
    address: exchangeAddress,
    abi: OptionExchangeABI,
    functionName: "operate",
    args: [
      [
        {
          operation: 0, // 0 means Opyn operation
          operationQueue: [
            {
              actionType: BigNumber.from(0), // 0 on an Opyn operation means Open Vault which is represented by a vaultId
              owner: addressOrDefault,
              secondAddress: addressOrDefault,
              asset: ZERO_ADDRESS,
              vaultId: nextVaultId, // TODO vaultId, each different short position the user holds will be held in a unique vaultId, for now putting it in new vaults
              amount: BigNumber.from("0"),
              optionSeries: EMPTY_SERIES,
              index: BigNumber.from(0),
              data: abiCode.encode(["uint256"], [0]) as `0x${string}`, // 1 here represents partially collateralized, 0 represents fully collateralized
            },
            {
              actionType: BigNumber.from(5), // 5 represents a Deposit Collateral action
              owner: addressOrDefault,
              secondAddress: exchangeAddress, // this can be set as the senderAddress or exchange address, if set to the exchange address then the user approval goes to the exchange, if set to the sender address then the user approval goes to the Opyn margin pool
              asset: collateral, // TODO proposedSeries.collateral
              vaultId: nextVaultId,
              amount: margin,
              optionSeries: EMPTY_SERIES,
              index: BigNumber.from(0),
              data: ZERO_ADDRESS,
            },
            {
              actionType: BigNumber.from(1), // 1 represents a mint otoken operation (minting an option contract, this only works if there is enough collateral)
              owner: addressOrDefault,
              secondAddress: exchangeAddress, // most of the time this should be set to exchange address, this helps avoid an extra approval from the user on the otoken when selling to the dhv
              asset: oToken,
              vaultId: nextVaultId,
              amount: amount, // amount needs to be in e8 decimals
              optionSeries: EMPTY_SERIES,
              index: BigNumber.from(0),
              data: ZERO_ADDRESS,
            },
          ],
        },
        {
          operation: 1, // indicates a rysk operation
          operationQueue: [
            {
              actionType: BigNumber.from(2), // this is a sell action
              owner: ZERO_ADDRESS,
              secondAddress: addressOrDefault,
              asset: ZERO_ADDRESS,
              vaultId: BigNumber.from(0), // I guess all dhv options are in this vault
              amount: amount.mul(BigNumber.from("10000000000")), // amount needs to be in e18 decimals
              optionSeries: {
                strikeAsset: strike,
                collateral,
                underlying,
                ...optionSeries,
              },
              index: BigNumber.from(0),
              data: "0x",
            },
          ],
        },
      ],
    ],
    enabled:
      optionSeries &&
      amount.gt("0") &&
      margin.gt("0") &&
      Boolean(data?.account.vaultCount),
    overrides: {
      gasLimit: BigNumber.from("3000000"),
    },
  });

  const { write } = useContractWrite(config);

  const simulateAndWrite = async () => {
    const requestData = prepareWriteData?.request?.data;
    if (requestData && write) {
      const response = await simulateOperation(requestData, 0, 0, 0);

      if (response?.simulation.status === true) {
        write();
      } else {
        toast("❌ Transaction would fail, reach out to the team.");
      }
    }
  };

  return [
    simulateAndWrite, // send operate to mint and sell oToken
    updateMargin, // user defined collateral for oToken
    updateAmount, // amount of options to be minted
    updateOptionSeries, // option series to be sold
    updateOToken, // oToken to be sold
  ];
};

export default useSellOperate;
