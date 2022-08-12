import React from "react";
import { BigNumberDisplay } from "../../components/BigNumberDisplay";
import { LPStats } from "../../components/LPStats";
import { Card } from "../../components/shared/Card";
import { VaultChart } from "../../components/VaultChart";
import { VaultDeposit } from "./VaultDesposit";
import { VaultStats } from "../../components/VaultStats";
import { useVaultContext } from "../../state/VaultContext";
import { Currency } from "../../types";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { VaultWithdraw } from "./VaultWithdraw";

export const VaultContent = () => {
  const {
    state: { currentEpoch, currentPricePerShare, userRyskBalance },
  } = useVaultContext();

  return (
    <>
      <div className="w-full flex justify-between bg-black text-white items-center p-4 col-start-1 col-end-17 mb-16">
        <h4>
          RYSK Balance:{" "}
          <RequiresWalletConnection className="bg-white h-8 w-[100px]">
            <BigNumberDisplay currency={Currency.RYSK}>
              {userRyskBalance}
            </BigNumberDisplay>
          </RequiresWalletConnection>
        </h4>
        <h4>Epoch: {currentEpoch?.toString()}</h4>
        <h4>
          RYSK Price:{" "}
          <BigNumberDisplay
            currency={Currency.RYSK}
            numberFormatProps={{ decimalScale: 18 }}
            suffix="USDC"
          >
            {currentPricePerShare}
          </BigNumberDisplay>
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
        {/* TODO add dynamic stast from Subgraph */}
        <VaultStats />
      </div>

      <div className="col-start-1 col-end-17 mt-16">
        {/* TODO add dynamic stast from Subgraph */}
        <VaultChart />
      </div>

      <div className="col-start-1 col-end-8 mt-16">
        <Card
          tabs={[
            {
              label: "DHV.description",
              content: (
                <div className="pb-8 py-12 px-8">
                  <h4>DHV Strategy</h4>
                  <p className="pt-4">
                    <ul className="list-disc px-8">
                      <li>
                        DHV trades options aiming to reduce the directional risk
                        associated with price movements in the underlying asset.
                      </li>
                      <li>
                        By selling options, trading spot and perps, or trading
                        any derivatives the DHV manages the hedge and is able to
                        generate yield whilst targeting market neutrality.
                      </li>
                    </ul>
                  </p>
                  <h4 className="pt-8">Deposit</h4>
                  <p className="pt-4">
                    <ul className="list-decimal px-8">
                      <li>Deposit USDC into DHV vault.</li>
                      <li>
                        Your USDC deposit will be queued till the next epoch. At
                        this stage you can also deposit additional USDC.
                      </li>
                      <li>
                        Once the new epoch starts your deposit will be converted
                        to shares which can then be redeemed.
                      </li>
                      <li>
                        Your shares will appreciate over-time as the DHV
                        generates returns.
                      </li>
                    </ul>
                  </p>
                  <h4 className="pt-8">Withdraw</h4>
                  <p className="pt-4">
                    <ul className="list-decimal px-8">
                      <li>
                        You can withdraw all of part of your shares. You can
                        initiate a withdrawal at any time.
                      </li>
                      <li>Your withdraw will be queued till the next epoch.</li>
                      <li>
                        Once the new epoch starts you can complete your withdraw
                        and redeem your USDC.
                      </li>
                    </ul>
                  </p>
                </div>
              ),
            },
          ]}
        ></Card>
      </div>

      <div className="col-start-9 col-end-17 mt-16">
        <Card
          tabs={[
            {
              label: "DHV.risks",
              content: (
                <div className="pb-8 py-12 px-8">
                  <h4>Financial Risk</h4>
                  <p className="pt-4">
                    <ul className="list-disc px-8">
                      <li>
                        DHV sells options and they can expire in-the-money,
                        meaning that the counterparty can exercise and redeem
                        part of collateral generating a loss for the DHV
                      </li>
                      <li>
                        DHV targets a delta zero to achieve market neutrality
                        but delta can deviate far from 0, meaning that the DHV
                        could have a directional exposure. <br />
                        In this case the DHV could hedge trading other
                        instruments (such as perpetuals, spots, options)
                        reducing the directionality
                      </li>
                    </ul>
                  </p>
                  <h4 className="pt-8">Smart Contract Risk</h4>
                  <p className="pt-4">
                    <ul className="list-disc px-8">
                      <li>
                        Rysk prioritises security. Our DHV smart contracts have
                        been audited, however, smart contracts are an
                        experimental technology and we encourage caution only
                        risking funds you can afford to lose.{" "}
                      </li>
                      <li>
                        DHV interacts with multiple protocols with a focus on
                        security, however DHV is exposed to other smart contract
                        security as well.
                      </li>
                      <a href="#" className="underline">
                        Learn more on Rysk security
                      </a>
                    </ul>
                  </p>
                </div>
              ),
            },
          ]}
        ></Card>
      </div>
    </>
  );
};
