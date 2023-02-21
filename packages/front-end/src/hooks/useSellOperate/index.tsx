import { usePrepareContractWrite, useContractWrite, useAccount } from "wagmi";
import { EMPTY_SERIES, ZERO_ADDRESS } from "../../config/constants";
import { Address, OptionSeries } from "../../types";
import OptionExchangeABI from "../../abis/OptionExchange.json";
import { AbiCoder } from "ethers/lib/utils";
import { useState } from "react";
import { BigNumber } from "ethers";
import { getContractAddress } from "../../utils/helpers";

const abiCode = new AbiCoder();

const useSellOperate = (): [
  ((overrideConfig?: undefined) => void) | undefined,
  (value: BigNumber) => void,
  (value: BigNumber) => void,
  (value: Partial<OptionSeries>) => void,
  (value: Address) => void
] => {
  // Global state
  const { address } = useAccount();

  // Addresses
  const exchangeAddress = getContractAddress("optionExchange");
  const usdcAddress = getContractAddress("USDC");
  const wethAddress = getContractAddress("WETH");
  const collateral = usdcAddress;
  const strike = usdcAddress;
  const underlying = wethAddress;

  // Internal state
  // note - set by user and it's the collateral they want to put down
  const [margin, setMargin] = useState<BigNumber>(BigNumber.from("0"));
  // note - amount of otokens to be minted
  const [amount, setAmount] = useState<BigNumber>(BigNumber.from("0"));
  // note - partial option series as assets are hardcoded above
  const [optionSeries, setOptionSeries] = useState<Partial<OptionSeries>>();
  // note - callStatic.createOtoken, could be derived from data above
  const [oToken, setOToken] = useState<Address>();

  // Setters
  const updateMargin = (amount: BigNumber) => {
    setMargin(amount);
  };
  const updateAmount = (amount: BigNumber) => {
    setAmount(amount);
  };
  const updateOptionSeries = (optionSeries: Partial<OptionSeries>) => {
    setOptionSeries(optionSeries);
  };
  const updateOToken = (address: Address) => {
    setOToken(address);
  };

  // Contract write
  const { config } = usePrepareContractWrite({
    address: exchangeAddress,
    abi: OptionExchangeABI,
    functionName: "operate",
    args: [
      [
        {
          operation: 0, // 0 means opyn operation
          operationQueue: [
            {
              actionType: 0, // 0 on an opyn operation means Open Vault which is represented by a vaultId
              owner: address,
              secondAddress: address,
              asset: ZERO_ADDRESS,
              vaultId: 1, // vaultId, // TODO vaultId, each short position the user holds will be held in a unique vaultId, we need to find an easy way to retrieve this
              amount: BigNumber.from("0"),
              optionSeries: EMPTY_SERIES,
              index: 0,
              data: abiCode.encode(["uint256"], [1]), // 1 here represents partially collateralised, 0 represents fully collateralised
            },
            {
              actionType: 5, // 5 represents a Deposit Collateral action
              owner: address,
              secondAddress: exchangeAddress, // this can be set as the senderAddress or exchange address, if set to the exchange address then the user approval goes to the exchange, if set to the sender address then the user approval goes to the opyn margin pool
              asset: collateral, // TODO proposedSeries.collateral
              vaultId: 1, // vaultId, // TODO vault id to deposit collateral into
              amount: margin,
              optionSeries: EMPTY_SERIES,
              index: 0,
              data: ZERO_ADDRESS,
            },
            {
              actionType: 1, // 1 represents a mint otoken operation (minting an option contract, this only works if there is enough collateral)
              owner: address,
              secondAddress: exchangeAddress, // most of the time this should be set to exchange address, this helps avoid an extra approval from the user on the otoken when selling to the dhv
              asset: oToken,
              vaultId: 1, // TODO vaultId,
              amount: amount, // amount needs to be in e8 decimals
              optionSeries: EMPTY_SERIES,
              index: 0,
              data: ZERO_ADDRESS,
            },
          ],
        },
        {
          operation: 1, // indicates a rysk operation
          operationQueue: [
            {
              actionType: 2, // this is a sell action
              owner: ZERO_ADDRESS,
              secondAddress: address,
              asset: ZERO_ADDRESS,
              vaultId: 0, // i guess all dhv options are in this vault
              amount: amount.mul(BigNumber.from("10000000000")).toString(), // amount needs to be in e18 decimals
              optionSeries: {
                ...optionSeries,
                strikeAsset: strike,
                collateral,
                underlying,
              },
              index: 0,
              data: "0x",
            },
          ],
        },
      ],
    ],
    enabled: optionSeries && amount.gt("0") && margin.gt("0"),
    overrides: {
      gasLimit: BigNumber.from("2500000"),
    },
  });

  const { write } = useContractWrite(config);

  return [
    write, // send operate to mint and sell oToken
    updateMargin, // user defined collateral for oToken
    updateAmount, // amount of options to be minted
    updateOptionSeries, // option series to be sold
    updateOToken, // oToken to be sold
  ];
};

export default useSellOperate;
