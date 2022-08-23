import React, { useEffect } from "react";
import { BigNumberDisplay } from "../../components/BigNumberDisplay";
import { LPStats } from "../../components/LPStats";
import { Card } from "../../components/shared/Card";
import { VaultDeposit } from "./VaultDesposit";
import { VaultPerformance } from "../../components/VaultPerformance";
import { Currency } from "../../types";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { VaultWithdraw } from "./VaultWithdraw";
import { VaultStrategy } from "../VaultStrategy";
import { VaultRisks } from "../VaultRisks";
import { VaultInfo } from "../VaultInfo";
import { DHV_NAME } from "../../config/constants";
import * as Scroll from "react-scroll";

import { useWalletContext } from "../../App";
import { CHAINID } from "../../config/constants";
import { useUserPosition } from "../../hooks/useUserPosition";
import { PositionTooltip } from "./PositionTooltip";

export const VaultContent = () => {
  const { chainId, network, account } = useWalletContext();

  const Link = Scroll.Link;
  const Element = Scroll.Element;

  const envChainID = process.env.REACT_APP_CHAIN_ID;

  const { userPositionValue, updatePosition } = useUserPosition();

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
          <div className="flex items-center">
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

        <p>
          Your Position:{" "}
          <RequiresWalletConnection className="bg-white h-4 w-[100px] translate-y-[-2px]">
            <BigNumberDisplay
              currency={Currency.USDC}
              suffix="USDC"
              loaderProps={{
                className: "invert h-4 w-auto translate-y-[-2px]",
              }}
            >
              {userPositionValue}
            </BigNumberDisplay>
          </RequiresWalletConnection>
          <PositionTooltip />
        </p>
      </div>
      <div className="col-start-1 col-end-8">
        <div className="font-parabole mb-8">
          <h1>{DHV_NAME}</h1>
          <h3 className="pt-4">Dynamic Hedging Vault</h3>
        </div>

        <p className="mt-8">
          {DHV_NAME} generates uncorrelated returns on USDC by running short
          options strategies (such as strangles, straddles, or single legs)
          targeting delta neutrality to reduce the directional risk associated
          with price movements in the underlying asset.
          <br />
          If the portfolio delta moves far away from zero the {DHV_NAME}{" "}
          position will be hedged by trading options, spot or perpetuals.
          <br />
          <Link
            className="underline hover:font-medium cursor-pointer"
            activeClass="active"
            to="overviewScroll"
            spy={true}
            smooth={true}
            offset={-150}
            duration={500}
          >
            Learn more
          </Link>
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
