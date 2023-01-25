import { useEffect, useMemo } from "react";
import { useAccount, useNetwork } from "wagmi";

import { useLocation } from "react-router-dom";
import { VaultPerformance } from "src/components/VaultPerformance/VaultPerformance";
import { LPStats } from "../../components/LPStats";
import { Card } from "../../components/shared/Card";
import { VaultTrades } from "../../components/VaultTrades";
import { CHAINID, DHV_NAME } from "../../config/constants";
import { DISCORD_LINK } from "../../config/links";
import addresses from "../../contracts.json";
import { useUserPosition } from "../../hooks/useUserPosition";
import { VaultMechanism } from "../VaultMechanism";
import { VaultRisks } from "../VaultRisks";
import { VaultStrategy } from "../VaultStrategy";
import { VaultDeposit } from "./VaultDeposit";
import { VaultWithdraw } from "./VaultWithdraw";

export const VaultContent = () => {
  const { address } = useAccount();
  const { chain } = useNetwork();
  const { updatePosition } = useUserPosition();
  const { search } = useLocation();

  const envChainID = process.env.REACT_APP_CHAIN_ID;

  const initialTabIndex = useMemo(() => {
    if (search) {
      const params = new URLSearchParams(search);
      if (params.get("type") === "withdraw") {
        return 1;
      }
      return 0;
    }
  }, [search]);

  useEffect(() => {
    if (address) {
      (() => {
        updatePosition(address);
      })();
    }
  }, [address, updatePosition]);

  return (
    <>
      <div className="w-full flex justify-between bg-black text-white items-center p-4 col-start-1 col-end-17 -mt-12 mb-16">
        {envChainID && (
          <div className="flex items-center w-[240px]">
            <p>
              {Number(envChainID) === CHAINID.ARBITRUM_MAINNET
                ? "Arbitrum"
                : Number(envChainID) === CHAINID.ARBITRUM_GOERLI
                ? "Arbitrum Testnet"
                : chain?.name}
            </p>
            {<img src="/arbitrum_logo.svg" className="h-6 w-auto ml-2" />}
          </div>
        )}

        <p className="text-sm">
          Rysk is in Mainnet Alpha. Use with caution and{" "}
          <a href={DISCORD_LINK} target="blank" className="underline">
            send us any feedback
          </a>
        </p>

        <a
          href={`${process.env.REACT_APP_SCAN_URL}/address/${addresses.arbitrum.liquidityPool}`}
          target="_blank"
          rel="noreferrer"
          className="min-w-[240px] flex justify-end items-center"
        >
          <p className="mr-2">Contract</p>{" "}
          <img src="/icons/link_cyan.svg" className="" />
        </a>
      </div>
      <div className="col-start-1 col-end-8">
        <div className="font-parabole mb-8">
          <h4 className="pb-4">Dynamic Hedging Vault</h4>
          <h1>{DHV_NAME}</h1>
        </div>

        <p className="mt-8">
          {DHV_NAME} generates uncorrelated returns on USDC by market making ETH
          options strategies.
        </p>
        <p className="py-4">
          The {DHV_NAME} exposure is dynamically hedged to target market
          neutrality in order reduce the directional risk associated with ETH
          price movements.
        </p>

        <LPStats />
      </div>

      <div className="col-start-9 col-end-17">
        <Card
          tabs={[
            {
              label: "Deposit",
              content: <VaultDeposit />,
            },
            { label: "Withdraw", content: <VaultWithdraw /> },
          ]}
          initialTabIndex={initialTabIndex}
        ></Card>
      </div>

      <section className="col-start-1 col-end-17 mt-16">
        <Card
          tabs={[
            {
              label: "Overview",
              content: <VaultStrategy />,
            },
            {
              label: "How it works",
              content: <VaultMechanism />,
            },
            {
              label: "Performance",
              content: <VaultPerformance />,
            },
            {
              label: "Risks",
              content: <VaultRisks />,
            },
            {
              label: "Trades",
              content: <VaultTrades />,
            },
          ]}
        />
      </section>
    </>
  );
};
