import React from "react";

export const VaultStrategy = () => {
  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-3">

        <div>
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
        </div>

        <div>
          <h4>Deposit</h4>
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
        </div>

        <div>
          <h4>Withdraw</h4>
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

      </div>
    </div>
  );
};
