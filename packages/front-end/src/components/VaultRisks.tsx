import React from "react";
import { DHV_NAME } from "../config/constants";
import { AlphaBanner } from "./shared/AlphaBanner";
import { Card } from "./shared/Card";
import { VaultRisksStats } from "./VaultRisksStats";

export const VaultRisks = () => {
  return (
    <div>
      <div className="px-8 mt-8">
        <AlphaBanner />
      </div>

      <VaultRisksStats />

      <hr />

      <div className="pb-8 py-12 px-8">
        <div className="grid grid-cols-2">
          <div>
            <h4>Financial Risks</h4>
            <p className="pt-4">
              <ul className="list-disc px-8">
                <li className="pb-2">
                  {DHV_NAME} could sell options that expire in-the-money,
                  meaning that the counterparty can exercise and redeem part of
                  the collateral, generating a loss for the {DHV_NAME}.
                </li>
                <li className="pb-2">
                  {DHV_NAME} targets a delta of zero to achieve market
                  neutrality, but the delta can deviate far from 0, meaning that
                  the {DHV_NAME} could have directional exposure. <br />
                  In this case, however, {DHV_NAME} can dynamically hedge,
                  trading other instruments to reduce the directionality,
                  mitigating the risk.
                </li>
              </ul>
              <a
                href="https://docs.rysk.finance/protocol/risks#financial-risks"
                className="underline ml-8 mt-4"
              >
                {`Learn more about Rysk's Financial risks`}
              </a>
            </p>
          </div>

          <div>
            <h4>Smart Contract Risks</h4>
            <p className="pt-4">
              <ul className="list-disc px-8">
                <li className="pb-2">
                  <b>Rysk prioritises security.</b> Our {DHV_NAME} smart
                  contracts have been audited by Dedaub and Akira, however,
                  smart contracts are an experimental technology and we
                  encourage caution, only risking funds you can afford to lose.{" "}
                </li>
                <li className="pb-2">
                  {DHV_NAME} interacts with multiple protocols with a focus on
                  security, however {DHV_NAME} is exposed to other smart
                  contract&apos;s security standards as well.
                </li>
              </ul>
              <a
                href="https://docs.rysk.finance/protocol/risks#smart-contract-risks"
                className="underline ml-8 mt-4"
              >
                {`Learn more about Rysk's Smart Contract risks`}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
