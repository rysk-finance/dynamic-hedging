import React, { useCallback, useEffect } from "react";
import { gql, useQuery } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useState } from "react";
import NumberFormat from "react-number-format";
import { useWalletContext } from "../../App";
import { Option } from "../../types";
import { renameOtoken } from "../../utils/conversion-helper";
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import { RadioButtonSlider } from "../shared/RadioButtonSlider";
import { BuyBack } from "./BuyBack";
import { useContract } from "../../hooks/useContract";
import OpynController from "../../abis/OpynController.json";
import { toast } from "react-toastify";
import {
  BIG_NUMBER_DECIMALS,
  DECIMALS,
  ZERO_ADDRESS,
} from "../../config/constants";
import { useExpiryPriceData } from "../../hooks/useExpiryPriceData";

enum OptionState {
  OPEN = "Open",
  EXPIRED = "Expired",
}

interface Position {
  id: string;
  expiryTimestamp: string;
  strikePrice: string;
  isPut: boolean;
  expired: boolean;
  symbol: string;
  amount: string;
  entryPrice: string;
  otokenId: string;
  expiryPrice: string;
  underlyingAsset: string;
  isRedeemable: boolean
}

export const UserOptionsList = () => {
  const { account } = useWalletContext();

  const { allOracleAssets } = useExpiryPriceData()

  const OPTIONS_BUTTONS: Option<OptionState>[] = [
    {
      key: OptionState.OPEN,
      label: OptionState.OPEN,
      value: OptionState.OPEN,
    },
    {
      key: OptionState.EXPIRED,
      label: OptionState.EXPIRED,
      value: OptionState.EXPIRED,
    },
  ];

  // Local state
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [listedOptionState, setListedOptionState] = useState(OptionState.OPEN);

  const parsePositions = (data: any) => {
    const timeNow = Date.now() / 1000;

    // TODO: Add typings here
    const parsedPositions = data?.positions.map((position: any) => {
      const expired = timeNow > position.oToken.expiryTimestamp;

      const otokenBalance = position.account.balances.filter(
        (item: any) => item.token.id === position.oToken.id
      )[0]
        ? position.account.balances.filter(
            (item: any) => item.token.id === position.oToken.id
          )[0].balance
        : 0;
      // 1e8
      const totPremium =
        position.writeOptionsTransactions.length > 0
          ? position.writeOptionsTransactions
              .map((pos: any) => pos.premium)
              .reduce(
                (prev: BigNumber, next: BigNumber) =>
                  Number(prev) + Number(next)
              )
          : 0;

      // premium converted to 1e18
      const entryPrice =
        otokenBalance > 0 && totPremium > 0
          ? (totPremium * 10 ** (DECIMALS.OPYN - DECIMALS.USDC)) / otokenBalance
          : 0;

      // TODO add current price and PNL

      return {
        id: position.id,
        expiryTimestamp: position.oToken.expiryTimestamp,
        strikePrice: position.oToken.strikePrice,
        expired: expired,
        isPut: position.oToken.isPut,
        symbol: position.oToken.symbol,
        amount: otokenBalance,
        entryPrice: Number(entryPrice).toFixed(2),
        otokenId: position.oToken.id,
        underlyingAsset: position.oToken.underlyingAsset.id
      };
    });

    setPositions(parsedPositions);
  };

  // TODO: Add typings here
  useQuery(
    gql`
    query($account: String) {
      positions(first: 1000, where: { account_contains: "${account?.toLowerCase()}" }) {
        id
        amount
        oToken {
          id
          symbol
          expiryTimestamp
          strikePrice
          isPut
          underlyingAsset {
            id
          }
        }
        writeOptionsTransactions {
          id
          amount
          premium
          timestamp
        }
        account {
          balances {
            balance
            token {
              id
            }
          }
        }
      }
    }
  `,
    {
      onCompleted: parsePositions,
      onError: (err) => {
        console.log(err);
      },
    }
  );

  useEffect(() => {

    const updatePositions = () => {
      const expiredPositions = positions?.filter( position => position.expired)

      expiredPositions?.map( position => {
        // get oracle prices for expired
        const asset = allOracleAssets?.find(a => a.asset.id === position.underlyingAsset)

        const expiryPrice = asset.prices.find( 
          (item: { expiry: string; }) => {
            return item.expiry === position.expiryTimestamp
          }
        )?.price 

        position.expiryPrice = expiryPrice

        position.isRedeemable = position.isPut 
                                ? Number(expiryPrice) <= Number(position.strikePrice) 
                                : Number(expiryPrice) >= Number(position.strikePrice)

      }) 
    };


    if (allOracleAssets && positions) {
      (() => {
        updatePositions();
      })();
    }
  }, [allOracleAssets, positions]);

  const [opynControllerContract, opynControllerContractCall] = useContract({
    contract: "OpynController",
    ABI: OpynController,
    readOnly: false,
  });

  enum ActionType {
    OpenVault,
    MintShortOption,
    BurnShortOption,
    DepositLongOption,
    WithdrawLongOption,
    DepositCollateral,
    WithdrawCollateral,
    SettleVault,
    Redeem,
    Call,
    Liquidate,
    InvalidAction,
  }

  const completeRedeem = useCallback(
    async (otokenId: string, amount: string) => {
      const args = {
        actionType: ActionType.Redeem,
        owner: ZERO_ADDRESS,
        secondAddress: account,
        asset: otokenId,
        vaultId: "0",
        amount: amount,
        index: "0",
        data: ZERO_ADDRESS,
      };

      await opynControllerContractCall({
        method: opynControllerContract?.operate,
        args: [[args]],
        onSubmit: () => {
          // TODO add loader
        },
        onComplete: () => {
          toast("✅ Order complete");
        },
      });
    },
    [ActionType.Redeem, account, opynControllerContract, opynControllerContractCall]
  );

  return (
    positions && (
      <div className="w-full">
        <Card
          tabs={[
            {
              label: "RYSK.Options",
              content: (
                <>
                  <div className="border-y-2 border-black p-4 rounded-tr-lg mt-[-1px]">
                    <RadioButtonSlider
                      options={OPTIONS_BUTTONS}
                      selected={listedOptionState}
                      setSelected={setListedOptionState}
                    />
                  </div>
                  {listedOptionState === OptionState.OPEN && (
                    <div className="p-4">
                      <div className="w-full">
                        <div className="grid grid-cols-12 text-lg pb-4">
                          <div className="col-span-1">Side</div>
                          <div className="col-span-4">Option</div>
                          <div className="col-span-2 text-right">Size</div>
                          <div className="col-span-2 text-right">
                            Entry Price
                          </div>
                          <div className="col-span-3 text-center">Actions</div>
                        </div>

                        <div>
                          {positions &&
                            positions
                              .filter((position) => !position.expired)
                              .sort(
                                (a, b) =>
                                  a.strikePrice.localeCompare(b.strikePrice) ||
                                  Number(b.strikePrice) - Number(a.strikePrice)
                              )
                              .sort(
                                (a, b) =>
                                  a.expiryTimestamp.localeCompare(
                                    b.expiryTimestamp
                                  ) ||
                                  Number(b.expiryTimestamp) -
                                    Number(a.expiryTimestamp)
                              )
                              .map((position) => (
                                <div key={position.id} className="w-full">
                                  <div className="grid grid-cols-12 py-2">
                                    <div className="col-span-1 text-green-700">
                                      LONG
                                    </div>
                                    <div className="col-span-4">
                                      {renameOtoken(position.symbol)}
                                    </div>
                                    <div className="col-span-2 text-right">
                                      <NumberFormat
                                        value={Number(
                                          utils.formatUnits(
                                            BigNumber.from(position.amount),
                                            DECIMALS.OPYN
                                          )
                                        ).toFixed(2)}
                                        displayType={"text"}
                                        decimalScale={2}
                                      />
                                    </div>
                                    <div className="col-span-2 text-right">
                                      <NumberFormat
                                        value={position.entryPrice}
                                        displayType={"text"}
                                        prefix="$"
                                        decimalScale={2}
                                      />
                                    </div>
                                    <div className="col-span-3 text-center">
                                      <p className="text-sm">Contact team to close position</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {listedOptionState === OptionState.EXPIRED && (
                    <div className="p-4">
                      <div className="grid grid-cols-12 text-left text-lg pb-4">
                        <div className="col-span-1">Side</div>
                        <div className="col-span-3">Option</div>
                        <div className="col-span-2 text-right">Size</div>
                        <div className="col-span-2 text-right">Entry Price</div>
                        <div className="col-span-2 text-right">Settlement Price</div>
                        <div className="col-span-2 text-center">Actions</div>
                      </div>
                      <div>
                        {positions &&
                          positions
                            .filter((position) => position.expired)
                            .sort(
                              (a, b) =>
                                a.strikePrice.localeCompare(b.strikePrice) ||
                                Number(b.strikePrice) - Number(a.strikePrice)
                            )
                            .sort(
                              (a, b) =>
                                a.expiryTimestamp.localeCompare(
                                  b.expiryTimestamp
                                ) ||
                                Number(a.expiryTimestamp) -
                                  Number(b.expiryTimestamp)
                            )
                            .map((position) => (
                              <div key={position.id} className="w-full">
                                <div className="grid grid-cols-12 py-2">
                                  <div className="col-span-1 text-green-700">
                                    LONG
                                  </div>
                                  <div className="col-span-3">
                                    {renameOtoken(position.symbol)}
                                  </div>
                                  <div className="col-span-2 text-right">
                                    <NumberFormat
                                      value={(
                                        Number(position.amount) /
                                        10 ** DECIMALS.OPYN
                                      ).toFixed(2)}
                                      displayType={"text"}
                                      decimalScale={2}
                                    />
                                  </div>
                                  <div className="col-span-2 text-right">
                                    <NumberFormat
                                      value={position.entryPrice}
                                      displayType={"text"}
                                      prefix="$"
                                      decimalScale={2}
                                    />
                                  </div>
                                  <div className="col-span-2 text-right">
                                    <NumberFormat
                                      value={( 
                                        Number(position.expiryPrice) /
                                        10 ** DECIMALS.OPYN
                                      ).toFixed(2)}
                                      displayType={"text"}
                                      prefix="$"
                                      decimalScale={2}
                                    />
                                  </div>
                                  <div className="col-span-2 text-center">
                                    { position.isRedeemable && <Button
                                      onClick={() =>
                                        completeRedeem(
                                          position.otokenId,
                                          position.amount
                                        )
                                      }
                                      className="min-w-[50%]"
                                    >
                                      Redeem
                                    </Button>
                                    }
                                  
                                  </div>
                                </div>
                              </div>
                            ))}
                      </div>
                    </div>
                  )}
                </>
              ),
            },
          ]}
        ></Card>
      </div>
    )
  );
};
