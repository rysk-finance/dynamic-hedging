import React from "react";
import { DHV_NAME } from "../config/constants";
import { Card } from "./shared/Card";

export const VaultRisks = () => {
  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-2">

        <div>
          <h4>Financial Risk</h4>
          <p className="pt-4">
            <ul className="list-disc px-8">
              <li>
                {DHV_NAME} sells options and they can expire in-the-money,
                meaning that the counterparty can exercise and redeem
                part of collateral generating a loss for the {DHV_NAME}
              </li>
              <li>
                {DHV_NAME} targets a delta zero to achieve market neutrality
                but delta can deviate far from 0, meaning that the {DHV_NAME}
                could have a directional exposure. <br />
                In this case the {DHV_NAME} could hedge trading other
                instruments (such as perpetuals, spots, options)
                reducing the directionality
              </li>
            </ul>
          </p>
        </div>

        <div>
          <h4>Smart Contract Risk</h4>
          <p className="pt-4">
            <ul className="list-disc px-8">
              <li>
                Rysk prioritises security. Our {DHV_NAME} smart contracts have
                been audited, however, smart contracts are an
                experimental technology and we encourage caution only
                risking funds you can afford to lose.{" "}
              </li>
              <li>
                {DHV_NAME} interacts with multiple protocols with a focus on
                security, however {DHV_NAME} is exposed to other smart contract
                security as well.
              </li>
              <a href="#" className="underline">
                Learn more on Rysk security
              </a>
            </ul>
          </p>
        </div>

      </div>
      

    </div>     
  );
};
