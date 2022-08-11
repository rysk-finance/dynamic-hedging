import { BigNumber } from "ethers";
import React from "react";
import { useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import { useWalletContext } from "../App";
import LPABI from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import { BigNumberDisplay } from "../components/BigNumberDisplay";
import { LPStats } from "../components/LPStats";
import { Card } from "../components/shared/Card";
import { VaultChart } from "../components/VaultChart";
import { VaultDeposit } from "../components/VaultDesposit";
import { VaultStats } from "../components/VaultStats";
import { useContract } from "../hooks/useContract";
import { VaultActionType } from "../state/types";
import { useVaultContext, VaultProvider } from "../state/VaultContext";
import { Currency } from "../types";

const VaultStateManagment = () => {
  const { account } = useWalletContext();
  const { dispatch } = useVaultContext();

  const [lpContract] = useContract<{
    EpochExecuted: [];
  }>({
    contract: "liquidityPool",
    ABI: LPABI.abi,
    readOnly: true,
    events: {
      EpochExecuted: () => {
        toast("✅ The epoch was advanced");
        getEpochData();
      },
    },
    isListening: {
      EpochExecuted: true,
    },
  });

  const getEpochData = useCallback(async () => {
    if (lpContract) {
      const currentEpoch: BigNumber = await lpContract.epoch();
      const latestSharePrice: BigNumber = await lpContract.epochPricePerShare(
        currentEpoch.sub(1)
      );
      return { currentEpoch, latestSharePrice };
    }
  }, [lpContract]);

  const getUserRyskBalance = useCallback(async () => {
    if (lpContract && account) {
      const balance: BigNumber = await lpContract.balanceOf(account);
      return balance;
    }
  }, [lpContract, account]);

  useEffect(() => {
    const getInfo = async () => {
      const epochData = await getEpochData();
      const balance = await getUserRyskBalance();
      if (epochData || balance) {
        dispatch({
          type: VaultActionType.SET,
          data: {
            currentEpoch: epochData?.currentEpoch,
            currentPricePerShare: epochData?.latestSharePrice,
            userRyskBalance: balance,
          },
        });
      }
    };

    getInfo();
  }, [dispatch, getEpochData, getUserRyskBalance]);

  return null;
};

const VaultContent = () => {
  const {
    state: { currentEpoch, currentPricePerShare, userRyskBalance },
  } = useVaultContext();

  console.log(currentPricePerShare);
  return (
    <>
      <div className="w-full flex justify-between bg-black text-white items-center p-4 col-start-1 col-end-17 mb-16">
        <h4>
          RYSK Balance:{" "}
          <BigNumberDisplay currency={Currency.RYSK}>
            {userRyskBalance}
          </BigNumberDisplay>
        </h4>
        <h4>Epoch: {currentEpoch?.toString()}</h4>
        <h4>
          Epoch Price Per Share:{" "}
          <BigNumberDisplay
            currency={Currency.RYSK}
            numberFormatProps={{ decimalScale: 18 }}
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
            { label: "Withdraw", content: <div>ello</div> },
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

export const Vault = () => {
  return (
    <VaultProvider>
      <VaultStateManagment />
      <VaultContent />
    </VaultProvider>
  );
};
