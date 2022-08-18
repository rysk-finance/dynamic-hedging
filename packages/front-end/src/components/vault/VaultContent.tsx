import React from "react";
import { BigNumberDisplay } from "../../components/BigNumberDisplay";
import { LPStats } from "../../components/LPStats";
import { Card } from "../../components/shared/Card";
import { VaultDeposit } from "./VaultDesposit";
import { VaultPerformance } from "../../components/VaultPerformance";
import { useVaultContext } from "../../state/VaultContext";
import { Currency } from "../../types";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { VaultWithdraw } from "./VaultWithdraw";
import { VaultStrategy } from "../VaultStrategy";
import { VaultRisks } from "../VaultRisks";
import { VaultInfo } from "../VaultInfo";
import { useWalletContext } from "../../App";
import { CHAINID } from "../../config/constants";

export const VaultContent = () => {
  const { chainId, network } = useWalletContext();

  const {
    state: { userDHVBalance: userRyskBalance },
  } = useVaultContext();

  return (
    <>
      <div className="w-full flex justify-between bg-black text-white items-center p-4 col-start-1 col-end-17 mb-16">
        <h4>
          Your Balance:{" "}
          <RequiresWalletConnection className="bg-white h-8 w-[100px]">
            <BigNumberDisplay currency={Currency.RYSK} suffix="DHV">
              {userRyskBalance}
            </BigNumberDisplay>
          </RequiresWalletConnection>
        </h4>
        {Number(chainId) === CHAINID.ARBITRUM_MAINNET ||
          (Number(chainId) === CHAINID.ARBITRUM_RINKEBY && (
            <div className="flex items-center">
              <h4>
                Network:{" "}
                {Number(chainId) === CHAINID.ARBITRUM_MAINNET
                  ? "Arbitrum"
                  : Number(chainId) === CHAINID.ARBITRUM_RINKEBY
                  ? "Arbitrum Testnet"
                  : network?.name}{" "}
              </h4>
              {<img src="/arbitrum_logo.svg" className="h-6 w-auto ml-2" />}
            </div>
          ))}
      </div>
      <div className="col-start-1 col-end-8">
        <h2 className="mb-8">Earn Uncorrelated Returns</h2>
        <p>
          Rysk DHV (Dynamic Hedging Vault) generates uncorrelated returns by
          trading options. <br />
          The DHV targets market neutrality aiming to reduce the directional
          risk associated with price movements in the underlying asset. <br />
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

      <div className="col-start-1 col-end-17 mt-16">
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
      </div>
    </>
  );
};
