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
              <li className="pb-2">
                Deposit USDC into {DHV_NAME} vault
              </li>
              <li className="pb-2">
                Your USDC deposit will be queued till the next epoch start. 
                At this stage, you can continue to deposit additional USDC for this epoch.
              </li>
              <li className="pb-2">
                Once the new epoch starts your deposit will be converted to
                shares which can then be redeemed. 
                After have redeemed, you have full control of your {DHV_NAME} shares 
                and you will be able to see them in your wallet as ERC20 token.
              </li>
              <li className="pb-2">
                The deposited funds are used to fund ETH options strategies
              </li>
              <li className="pb-2">
                Your shares value could appreciate over time as the {DHV_NAME} {" "}
                generates returns
              </li>
            </ul>
          </p>

          <h4 className="pt-8">Withdraw</h4>
          <p className="pt-4">
            <ul className="list-decimal px-8">
              <li className="pb-2">
                You can withdraw all or part of your shares. 
                You can initiate a withdrawal at any time
              </li>
              <li className="pb-2">
                Your withdrawal will be queued till the next epoch
              </li>
              <li className="pb-2">
                Once the new epoch starts you can complete your withdrawal and
                redeem your USDC
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
                {/* <p>
                  An epoch is a period of time in which the funds are used 
                  to run ETH options strategies. 
                  <br />
                  Deposits and withdraws will be deployed at the end of each epoch 
                  and the new capital will be used to fund ETH option strategies.
                </p> */}
                <p>
                  You can deposit and withdraw at any time.  
                  <br />
                  Deposits and withdrawals will be on hold until the current epoch ends.
                  <br />
                  At the start of the new epoch, the deposits will be deployed into the {DHV_NAME} vault 
                  and the withdrawals could be redeemed for USDC.
                  <br />
                  Currently, the epoch lasts <b>7 days</b>. 
                </p>
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>

    </div>
  );
};
