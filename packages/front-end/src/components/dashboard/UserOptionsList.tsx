import React from "react";
import { gql, useQuery } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState } from "react";
import NumberFormat from "react-number-format";
import { useWalletContext } from "../../App";
import { Option } from "../../types";
import { renameOtoken } from "../../utils/conversion-helper";
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import { RadioButtonSlider } from "../shared/RadioButtonSlider";
import { BuyBack } from "./BuyBack";
import { RFQ_FORM } from "../../config/links";

enum OptionState {
  OPEN = "Open",
  EXPIRED = "Expired",
}

interface Position {
  id: string;
  expired: boolean;
  symbol: string;
  amount: string;
  entryPrice: string;
  otokenId: string;
}

export const UserOptionsList = () => {
  const { account } = useWalletContext();

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

  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const parsePositions = (data: any) => {

    const positions: Position[] = [];
    const timeNow = Date.now() / 1000;

    // TODO: Add typings here
    data?.positions.forEach((position: any) => {
      const expired = timeNow > position.oToken.expiryTimestamp;

      // 1e18
      const totBought =
        position.writeOptionsTransactions.length > 0
          ? position.writeOptionsTransactions
              .map((pos: any) => pos.amount)
              .reduce(
                (prev: BigNumber, next: BigNumber) =>
                  Number(prev) + Number(next)
              )
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
        totBought > 0 && totPremium > 0 ? (totPremium * 1e12) / totBought : 0;

      // TODO add current price and PNL

      positions.push({
        id: position.id,
        expired: expired,
        symbol: position.oToken.symbol,
        amount: Number(position.amount / 1e18).toFixed(2),
        entryPrice: Number(entryPrice).toFixed(2),
        otokenId: position.oToken.id,
      });

      setPositions(positions);
    });
  };

  // TODO: Add typings here
  const { loading, error, data } = useQuery(
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
        }
        writeOptionsTransactions {
          id
          amount
          premium
          timestamp
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
                          <div className="col-span-2 text-right">Entry Price</div>
                          <div className="col-span-3 text-center">Actions</div>
                        </div>
                        <p>{positions.length }</p>
                        <div>
                          {positions &&
                            positions
                              .filter((position) => !position.expired)
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
                                        value={position.amount}
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
                                      {/* <Button
                                        onClick={() =>
                                          setSelectedOption(position.otokenId)
                                        }
                                        className=""
                                      >
                                        Sell
                                      </Button> */}
                                      <Button onClick={() => {
                                        window.open(RFQ_FORM, "_blank")
                                      }} >
                                      RFQ to close position  
                                      </Button>
                                    </div>
                                  </div>
                                  {/* {selectedOption !== null && (
                                    <div className="pt-6 grid grid-cols-12">
                                      <div className="col-start-4 col-span-6">
                                        <h4 className="mb-4 text-center">
                                          Sell Option
                                        </h4>
                                        <BuyBack
                                          selectedOption={selectedOption}
                                        />
                                      </div>
                                    </div>
                                  )}*/}
                                </div>
                              ))} 
                        </div>
                      </div>
                    </div>
                  )}

                  {listedOptionState === OptionState.EXPIRED && (
                    <div className="p-4">

                        <div className="grid grid-cols-12 text-left text-lg pb-4">
                          <div className="col-span-4">Option</div>
                          <div className="col-span-2">Size</div>
                          <div className="col-span-2">Entry Price</div>
                          <div className="col-span-4">Actions</div>
                        </div>
                        <div>
                          {positions &&
                            positions
                              .filter((position) => position.expired)
                              .map((position) => (
                                <div key={position.id} className="w-full">
                                  <div className="grid grid-cols-12">
                                    <div className="col-span-4">
                                      {renameOtoken(position.symbol)}
                                    </div>
                                    <div className="col-span-2">
                                      <NumberFormat
                                        value={position.amount}
                                        displayType={"text"}
                                        decimalScale={2}
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <NumberFormat
                                        value={position.entryPrice}
                                        displayType={"text"}
                                        prefix="$"
                                        decimalScale={2}
                                      />
                                    </div>
                                    <div className="col-span-4">
                                      <Button
                                        onClick={() =>
                                          setSelectedOption(position.otokenId)
                                        }
                                        className="w-full"
                                      >
                                        Sell
                                      </Button>
                                    </div>
                                  </div>
                                  {selectedOption !== null && (
                                    <div className="pt-6 grid grid-cols-12">
                                      <div className="col-start-4 col-span-6">
                                        <h4 className="mb-4 text-center">
                                          Sell Option
                                        </h4>
                                        <BuyBack
                                          selectedOption={selectedOption}
                                        />
                                      </div>
                                    </div>
                                  )}
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
