import React from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../components/shared/Card";
import { VaultDepositWithdraw } from "../components/VaultDepositWithdraw";
import { VaultStats } from "../components/VaultStats";
import ProgressBar from "@ramonak/react-progress-bar";
import { VaultChart } from "../components/VaultChart";


export const Vault = () => {

  return (
    <>
      <div className="col-start-1 col-end-8">
        <h2 className="mb-8">Earn Uncorrelated Returns</h2>
        <p>
          Rysk DHV (Dynamic Hedging Vault) generates uncorrealted returns by trading options. <br />  
          The DHV targets market neutrality aiming to reduce the directional risk associated with price movements in the underlying asset. < br/>
        </p>
        {/* TODO read from LP contract */}
        <div className="mt-12">
            <div className="flex justify-between mb-4">
              <div>
                <h4>60k USDC</h4>
                <p>Deposited</p>
              </div>
              <div className="text-right">
                <h4>100k USDC</h4>
                <p>Max Capacity</p>
              </div>
            </div>
            <ProgressBar 
              completed={60} 
              bgColor={"#000"}
              height={"30px"}
              baseBgColor={"#ebebeb"}
              animateOnRender={true}
              borderRadius={"10px"}
              className={"border-2 border-2 rounded-xl border-black"}
            />
          
        </div>
      </div>
      <div className="col-start-9 col-end-17">
        <Card headerContent="DHV.actions">
          <VaultDepositWithdraw />
        </Card>
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
         <Card headerContent="DHV.description">
          <div className="pb-8 py-12 px-8">
            <h4>DHV Strategy</h4>
            <p className="pt-4">
              <ul className="list-disc px-8">
                <li>DHV trades options aiming to reduce the directional risk associated with price movements in the underlying asset;</li>
                <li>By selling options, trading spot and perps, or trade any derivatives the DHV manages the hedge and is able to generate yield whilst targeting market neutrality.</li>
              </ul>
            </p>
            <h4 className="pt-8">Deposit</h4>
            <p className="pt-4">
              <ul className="list-decimal px-8">
                <li>Deposit USDC into DHV vault;</li>
                <li>Your USDC deposit will be queed till the next epoch. At this stage you can also deposit additional USDC;</li>
                <li>Once the new epoch starts you can redeem your deposit will be converted to shares and you can redeem them. You can reedemed you shares at anytime in the future;</li>
                <li>Your shares will appreciate over-time as the DHV generated returns.</li>
              </ul>
            </p>
            <h4 className="pt-8">Withdraw</h4>
            <p className="pt-4">
              <ul className="list-decimal px-8">
                <li>You can withdraw all of part of your shares. You can initiate a withdraw at any time;</li>
                <li>Your withdraw will be queed till the next epoch;</li>
                <li>Once the new epoch starts you can complete your withdraw and redeem your USDC.</li>
              </ul>
            </p>
          </div>
         </Card>
      </div>

      <div className="col-start-9 col-end-17 mt-16">
         <Card headerContent="DHV.risks">
           <div className="pb-8 py-12 px-8">
              <h4>Financial Risk</h4>
              <p className="pt-4">
                <ul className="list-disc px-8">
                    <li>DHV sells options and they can expire In The Money, meaning that the counterparty can exercise and redeem part of collateral generating a loss for the DHV</li>
                    <li>
                      DHV targets a delta zero to achieve market neutrality but delta can deviate far from 0, meaning that the DHV have a directional exposure. <br />
                      In this case the DHV could hedge trading other instruments (such as perpetuals, spots, options) reducing the directionality
                    </li>
                </ul>
              </p>
              <h4 className="pt-8">Smart Contract Risk</h4>
              <p className="pt-4">
                <ul className="list-disc px-8">
                    <li>DHV smart contracts have been audited and Rysk takes security as a priortiy, however, smart contracts are an experimental technology and we encourage caution only risking funds you can afford to lose. </li>
                    <li>DHV interacts with multiple protocols with a focus on security, however DHV is exposed to other smart contract security as well.</li>
                    <a href="#" className="underline">Learn more on Rysk security</a>
                </ul>
              </p>
           </div>
           
         </Card>
      </div>
    </>
  );
};
