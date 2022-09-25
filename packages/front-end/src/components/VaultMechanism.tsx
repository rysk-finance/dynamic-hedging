import React from "react";
import { DHV_NAME } from "../config/constants";

export const VaultMechanism = () => {
  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-2">
        <div>
          <h4>Deposit</h4>
          <p className="pt-4">
            <ul className="list-decimal px-8">
              <li className="pb-2">Deposit USDC into the {DHV_NAME} vault.</li>
              <li className="pb-2">
                Your deposit will be deployed within the vault on Friday at 11am
                UTC.
              </li>
              <li className="pb-2">
                The deployed funds are used to fund ETH options strategies.
              </li>
              <li className="pb-2">
                Your funds could appreciate over time as the {DHV_NAME}{" "}
                generates returns.
              </li>
            </ul>
          </p>

          <h4 className="pt-8">Withdraw</h4>
          <p className="pt-4">
            <ul className="list-decimal px-8">
              <li className="pb-2">
                You can withdraw all or part of your funds. You can initiate a
                withdrawal at any time.
              </li>
              <li className="pb-2">
                Your withdrawal will be on hold until Friday 11am UTC, at which
                point your funds will be released from the vault.
              </li>
              <li className="pb-2">
                At this point you can complete your withdrawal to recieve your
                returns.
              </li>
            </ul>
          </p>
        </div>
        <div>
          <div className="rounded-lg mr-8">
            <div className="rounded-t-lg bg-black text-white flex justify-center py-2 mt-16 md:mt-0">
              <p>epoch.png</p>
            </div>
            <div>
              <div className="border-black border-2 rounded-b-lg p-8 overflow-hidden bg-bone">
                <div className="flex flex-col justify-around items-center">
                  <img
                    src="/images/epoch.png"
                    className="mr-8 h-[130px] pb-8"
                  />
                  {/* <p>
                  An epoch is a period of time in which the funds are used 
                  to run ETH options strategies. 
                  <br />
                  Deposits and withdraws will be deployed at the end of each epoch 
                  and the new capital will be used to fund ETH option strategies.
                </p> */}
                  <ul className="list-disc list-outside px-4">
                    <li>
                      You can deposit and initiate a withdrawal at any time.
                    </li>
                    <li>
                      Deposits and withdrawals will be on hold until the start
                      of the next epoch.
                    </li>
                    <li>
                      An epoch marks a period of trading within the {DHV_NAME}{" "}
                      vault, at the end of which the position of the vault is
                      calculated and funds are deployed and released.
                    </li>
                    <li>
                      Currently, the epoch lasts <b>7 days</b> and is executed
                      on <b>Friday 11am UTC</b>.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
