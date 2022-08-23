import React from "react";
import { DHV_NAME } from "../config/constants";

export const VaultOverview = () => {

  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-2">
        <div>
          <h4>Deposit</h4>
          <p className="pt-4">
            <ul className="list-decimal px-8">
              <li>Deposit USDC into {DHV_NAME} vault.</li>
              <li>
                Your USDC deposit will be queued till the next epoch start. At
                this stage you can also deposit additional USDC
              </li>
              <li>
                Once the new epoch starts your deposit will be converted to
                shares which can then be redeemed
              </li>
              <li>
                The deposited USDC are used as collateral to run short options strategies and generates returns
              </li>
              <li>
                Your shares value could appreciate over-time as the {DHV_NAME} {" "}
                generates returns
              </li>
            </ul>
          </p>
        </div>
        <div>

        <div className="rounded-lg mt-8 mr-8">

          <div className="rounded-t-lg bg-black text-white flex justify-center py-2 mt-16 md:mt-0">
            <p>
              epoch.png
            </p>
          </div>
          <div>
            <div className="border-black border-2 rounded-b-lg p-8 overflow-hidden bg-bone">
              <div className="flex justify-around items-center">
                <img
                  src="/images/epoch.png"
                  className="mr-8 h-[150px]"
                />
                <p>
                  An epoch is a period of time in which the funds are used to run options strategies. 
                  Deposits and Withdraw will be deployed at the end of each epoch 
                  and the new capital will be used as collateral to run the strategies.
                </p>
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="pt-8">
          <h4>Withdraw</h4>
          <p className="pt-4">
            <ul className="list-decimal px-8">
              <li>
                You can withdraw all of part of your shares. You can initiate a
                withdrawal at any time
              </li>
              <li>Your withdraw will be queued till the next epoch</li>
              <li>
                Once the new epoch starts you can complete your withdraw and
                redeem your USDC
              </li>
            </ul>
          </p>
        </div>
      </div>

    </div>
  );
};
