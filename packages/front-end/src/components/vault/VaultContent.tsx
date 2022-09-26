import React, { useEffect, useMemo } from "react";
import { BigNumberDisplay } from "../../components/BigNumberDisplay";
import { LPStats } from "../../components/LPStats";
import { Card } from "../../components/shared/Card";
import { VaultDeposit } from "./VaultDeposit";
import { VaultPerformance } from "../../components/VaultPerformance";
import { Currency } from "../../types";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { VaultWithdraw } from "./VaultWithdraw";
import { VaultStrategy } from "../VaultStrategy";
import { VaultRisks } from "../VaultRisks";
import { VaultInfo } from "../VaultInfo";
import { DHV_NAME, SCAN_URL } from "../../config/constants";
import * as Scroll from "react-scroll";

import { useWalletContext } from "../../App";
import { CHAINID } from "../../config/constants";
import { useUserPosition } from "../../hooks/useUserPosition";
import { PositionTooltip } from "./PositionTooltip";
import { VaultMechanism } from "../VaultMechanism";
import { useLocation } from "react-router-dom";
import addresses from "../../contracts.json";
import { DISCORD_LINK } from "../../config/links";

export const VaultContent = () => {
  const { chainId, network, account } = useWalletContext();

  const Link = Scroll.Link;
  const Element = Scroll.Element;

  const envChainID = process.env.REACT_APP_CHAIN_ID;

  const { userPositionValue, updatePosition } = useUserPosition();

  const { search } = useLocation();

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
    if (account) {
      (() => {
        updatePosition(account);
      })();
    }
  }, [account, updatePosition]);

  return (
    <>
      <div className="w-full flex justify-between bg-black text-white items-center p-4 col-start-1 col-end-17 mb-16">
        {envChainID && (
          <div className="flex items-center w-[240px]">
            <p>
              {Number(envChainID) === CHAINID.ARBITRUM_MAINNET
                ? "Arbitrum"
                : Number(envChainID) === CHAINID.ARBITRUM_RINKEBY
                ? "Arbitrum Testnet"
                : network?.name}{" "}
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
          href={`${SCAN_URL[CHAINID.ARBITRUM_MAINNET]}/address/${
            addresses.arbitrum.liquidityPool
          }`}
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
          <h1>{DHV_NAME}</h1>
          <h3 className="pt-4">Dynamic Hedging Vault</h3>
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
        <Link
          className="underline hover:font-medium cursor-pointer text-cyan-dark"
          activeClass="active"
          to="overviewScroll"
          spy={true}
          smooth={true}
          offset={-150}
          duration={500}
        >
          Learn more
        </Link>

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

      <Element name="overviewScroll" className="col-start-1 col-end-17 mt-16">
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
              label: "Info",
              content: <VaultInfo />,
            },
          ]}
        ></Card>
      </Element>
    </>
  );
};
