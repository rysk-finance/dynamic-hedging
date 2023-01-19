import { gql, useQuery } from "@apollo/client";
import { BigNumber } from "ethers/lib/ethers";
import { useEffect, useState } from "react";
import NumberFormat from "react-number-format";
import { Link } from "react-router-dom";
import { useAccount, useNetwork } from "wagmi";

import ReactTooltip from "react-tooltip";
import LPABI from "../../abis/LiquidityPool.json";
import { AppPaths } from "../../config/appPaths";
import {
  BIG_NUMBER_DECIMALS,
  DHV_NAME,
  SUBGRAPH_URL,
} from "../../config/constants";
import { useContract } from "../../hooks/useContract";
import { useUserPosition } from "../../hooks/useUserPosition";
import { Currency, DepositReceipt } from "../../types";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { RyskTooltip } from "../RyskTooltip";
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import { PositionTooltip } from "../vault/PositionTooltip";

export const UserVault = () => {
  const { address } = useAccount();
  const { chain } = useNetwork();
  const { userPositionValue, updatePosition } = useUserPosition();

  const SUBGRAPH_URI = chain?.id !== undefined ? SUBGRAPH_URL[chain?.id] : "";

  const [depositBalance, setDepositBalance] = useState<BigNumber>(
    BigNumber.from(0)
  );
  const [unredeemableCollateral, setUnredeemableCollateral] =
    useState<BigNumber>(BigNumber.from(0));
  const [unredeemedSharesValue, setUnredeemedSharesValue] = useState<BigNumber>(
    BigNumber.from(0)
  );

  const [lpContract] = useContract({
    contract: "liquidityPool",
    ABI: LPABI,
    readOnly: true,
  });

  useEffect(() => {
    if (address) {
      (() => {
        updatePosition(address);
      })();
    }
  }, [address, updatePosition]);

  useQuery(
    gql`
      query($account: String) {
        lpbalances(first: 1000, where: { id: "${address}" }) {
          id
          balance
        }
      }
    `,
    {
      onCompleted: (data) => {
        const balance = data?.lpbalances[0] ? data.lpbalances[0].balance : 0;

        balance && setDepositBalance(balance);
      },
    }
  );

  useEffect(() => {
    const getCurrentPosition = async (address: string) => {
      const depositReceipt: DepositReceipt = await lpContract?.depositReceipts(
        address
      );
      const previousUnredeemedShares = depositReceipt.unredeemedShares;
      const unredeemedShares = BigNumber.from(0);

      const pricePerShareAtEpoch: BigNumber =
        await lpContract?.depositEpochPricePerShare(depositReceipt.epoch);
      // TODO(HC): Price oracle is returning 1*10^18 for price so having to adjust price
      // whilst building out to avoid share numbers being too small. Once price oracle is returning
      // more accurate
      const newUnredeemedShares = depositReceipt.amount
        .div(BIG_NUMBER_DECIMALS.USDC)
        .mul(BIG_NUMBER_DECIMALS.RYSK)
        .div(pricePerShareAtEpoch)
        .mul(BIG_NUMBER_DECIMALS.RYSK);
      const sharesToRedeem = previousUnredeemedShares.add(newUnredeemedShares);
      unredeemedShares.add(sharesToRedeem);

      const unredeemedSharesValue = sharesToRedeem
        .mul(pricePerShareAtEpoch)
        .div(BigNumber.from(10).pow(30));

      setUnredeemedSharesValue(unredeemedSharesValue);
    };

    (async () => {
      if (address && lpContract) {
        await getCurrentPosition(address);
      }
    })();
  }, [address, lpContract, SUBGRAPH_URI]);

  return (
    <div>
      <div className="mb-24">
        <Card
          tabWidth={280}
          tabs={[
            {
              label: "RYSK.dynamicHedgingVault",
              content: (
                <div className="py-12 px-8 flex flex-col lg:flex-row h-full">
                  <div className="flex h-full w-full lg:w-[70%] justify-around">
                    <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
                      <h4 className="mb-4">
                        <RequiresWalletConnection className="w-[60px] h-[16px] mr-2 translate-y-[-2px]">
                          <BigNumberDisplay
                            currency={Currency.USDC}
                            suffix="USDC"
                            loaderProps={{
                              className: "h-4 w-auto translate-y-[-2px]",
                            }}
                          >
                            {userPositionValue}
                          </BigNumberDisplay>
                        </RequiresWalletConnection>
                      </h4>
                      <h4 className="mb-2">
                        Your Position
                        <PositionTooltip />
                      </h4>
                    </div>
                    <div className="flex flex-col items-center justify-center h-full">
                      <h4 className="mb-4">
                        {/* TODO make sure if there is an error with subgraph this will not load */}
                        <RequiresWalletConnection className="w-[60px] h-[16px] mr-2 translate-y-[-2px]">
                          {depositBalance !== undefined &&
                          depositBalance.toString() !== "0" &&
                          userPositionValue !== null ? (
                            <NumberFormat
                              value={Number(
                                userPositionValue
                                  .sub(depositBalance)
                                  .toNumber() / 1e6
                              ).toFixed(2)}
                              displayType={"text"}
                              decimalScale={2}
                              suffix=" USDC"
                            />
                          ) : (
                            <NumberFormat
                              value={(0).toFixed(2)}
                              displayType={"text"}
                              decimalScale={2}
                              suffix=" USDC"
                            />
                          )}
                        </RequiresWalletConnection>
                      </h4>
                      <h4 className="mb-2">
                        PnL
                        <RyskTooltip
                          message={`Profit or Losses based on your current ${DHV_NAME} position in USDC net of deposits and withdraws`}
                          color="white"
                          id="pnlTip"
                        />
                      </h4>
                    </div>
                    {unredeemableCollateral.gt(0) && (
                      <div className="flex flex-col items-center justify-center h-full">
                        <h3 className="mb-2">
                          <NumberFormat
                            value={Number(
                              unredeemableCollateral.toNumber() / 1e6
                            )}
                            displayType={"text"}
                            decimalScale={2}
                            suffix=" USDC"
                          />
                        </h3>
                        <h4 className="mb-2">Queued Deposit</h4>
                        <button
                          data-tip
                          data-for="queuedTip"
                          className="cursor-help pl-2"
                        >
                          <img src="/icons/info.svg" />
                        </button>
                        {/* TODO  update with epoch time */}
                        <ReactTooltip
                          id="queuedTip"
                          place="bottom"
                          multiline={true}
                          backgroundColor="#EDE9DD"
                          textColor="black"
                          border={true}
                          borderColor="black"
                        >
                          Your USDC will be available to redeem as shares every
                          Friday
                        </ReactTooltip>
                      </div>
                    )}

                    {unredeemedSharesValue.gt(0) && (
                      <div className="flex flex-col items-center justify-center h-full">
                        <h3 className="mb-2">
                          <NumberFormat
                            value={Number(
                              unredeemedSharesValue.toNumber() / 1e6
                            )}
                            displayType={"text"}
                            decimalScale={2}
                          />
                        </h3>
                        <h4 className="mb-2">Shares to be reedemed</h4>
                        <a href="#" className="underline">
                          Learn more
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col w-full lg:w-[30%] h-full justify-around items-center">
                    <Link
                      className="w-full"
                      to={{ pathname: AppPaths.VAULT, search: "?type=deposit" }}
                    >
                      <Button className="w-full mb-4">Deposit</Button>
                    </Link>

                    <Link
                      className="w-full"
                      to={{
                        pathname: AppPaths.VAULT,
                        search: "?type=withdraw",
                      }}
                    >
                      <Button className="w-full">Withdraw</Button>
                    </Link>
                  </div>
                </div>
              ),
            },
          ]}
        ></Card>
      </div>
    </div>
  );
};
