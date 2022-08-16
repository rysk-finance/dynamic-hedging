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

export const VaultContent = () => {
  const {
    state: { userDHVBalance: userRyskBalance },
  } = useVaultContext();

  return (
    <>
      <div className="w-full flex justify-between bg-black text-white items-center p-4 col-start-1 col-end-17 mb-16">
        <h4>
          DHV Balance:{" "}
          <RequiresWalletConnection className="bg-white h-8 w-[100px]">
            <BigNumberDisplay currency={Currency.RYSK}>
              {userRyskBalance}
            </BigNumberDisplay>
          </RequiresWalletConnection>
        </h4>
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
