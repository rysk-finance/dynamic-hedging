import React, { useEffect, useState } from "react";
import { Card } from "../shared/Card";
import { Option } from "../../types";
import { ApolloClient, InMemoryCache, gql } from '@apollo/client'
import { SUBGRAPH_URL } from "../../config/constants";
import { RadioButtonSlider } from "../shared/RadioButtonSlider";
import { Button } from "../shared/Button";
import { useWalletContext } from "../../App";
import { renameOtoken } from "../../utils/conversion-helper";
import { BigNumber } from "ethers";
import NumberFormat from "react-number-format";
import { BuyBack } from "./BuyBack";

export const UserOptionsList = () => {

  const { account, network } = useWalletContext();
  const SUBGRAPH_URI = network?.id !== undefined ? SUBGRAPH_URL[network?.id] : ""

  enum OptionState {
    OPEN = "Open",
    EXPIRED = "Expired",
  }

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

  interface Position {
    id: string;
    expired: boolean;
    symbol: string,
    amount: number,
    entryPrice: number,
    otokenId: string
  }

   // Local state
  const [positions, setPositions] = useState<Position[]>([]);
  const [listedOptionState, setListedOptionState] = useState(OptionState.OPEN);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {

    const fetchPositions = async () => {

      const positionsQuery = `
        query($account: String) {
          positions(first: 1000, where: { account_contains: "${account?.toLowerCase()}" }) {
            id
            amount
            oToken {
              id
              symbol
              expiryTimestamp
            }
            writeOptionsTransactions {
              id
              amount
              premium
              timestamp
            }
          }
        }
      `

      const client = new ApolloClient({
        uri: SUBGRAPH_URI,
        cache: new InMemoryCache(),
      })

      client
        .query({
          query: gql(positionsQuery),
        })
        .then((data) => {

            const positions: Position[] = []
            const timeNow = Date.now() / 1000

            data.data.positions.map( (position: any) => {
              const expired = timeNow > position.oToken.expiryTimestamp;

              
              // 1e18
              const totBought = position.writeOptionsTransactions.length > 0 
                                ? position.writeOptionsTransactions.map(
                                  ( pos: any) => pos.amount).reduce((prev: BigNumber, next: BigNumber) => Number(prev) + Number(next)
                                ) 
                                : 0

              // 1e8
              const totPremium = position.writeOptionsTransactions.length > 0
                                  ? position.writeOptionsTransactions.map(
                                    ( pos: any) => pos.premium).reduce((prev: BigNumber, next: BigNumber) => Number(prev) + Number(next)
                                  )
                                  : 0

              // premium converted to 1e18 
              const entryPrice = totBought > 0 && totPremium > 0 ? (totPremium * 1e10 ) / totBought : 0

              // TODO add current price and PNL
              
              positions.push({
                id: position.id,
                expired: expired,
                symbol: position.oToken.symbol,
                amount: position.amount / 1e18,
                entryPrice: entryPrice,
                otokenId: position.oToken.id
              })
            })

            setPositions(positions)
            
        })
        .catch((err) => {
          // TODO add fallback
          console.log('Error fetching data: ', err)
        })

    }

    if (account) {
      fetchPositions()
      .catch(console.error);
    }

  }, [account]);

  return (
    <div className="w-full">
      <Card headerContent="RYSK.Options">
        <div className="border-y-2 border-black p-4 rounded-tr-lg mt-[-1px]">
          <RadioButtonSlider
            options={OPTIONS_BUTTONS}
            selected={listedOptionState}
            setSelected={setListedOptionState}
          />
        </div>
        { listedOptionState === OptionState.OPEN &&
          <div className="p-4">
            <div className="w-full">
              <div className="grid grid-cols-12 text-left text-lg pb-4">
                  <div className="col-span-3">Option</div>
                  <div className="col-span-1">Size</div>
                  <div className="col-span-2">Avg. Price</div>
                  <div className="col-span-2">Mark Price</div>
                  <div className="col-span-2">PNL</div>
                  <div className="col-span-2">Actions</div>
              </div>
              <div>
                {/* {DUMMY_OPTIONS[listedOptionState].map((option) => (
                  <tr className={`h-12`} key={option.option}>
                    <td className="pl-4">{option.option}</td>
                    <td>{option.size}</td>
                    <td>${option.entryPrice}</td>
                    <td className="pr-4">${option.markPrice}</td>
                    <td className="pr-4">
                      {option.pnl >= 0 ? "+" : "-"}${option.pnl}
                    </td>
                    <td>
                      {listedOptionState === OptionState.OPEN ? (
                        <Button>Close</Button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))} */}
                  
                { positions.filter(position => !position.expired).map((position) => ( 
                  <div key={position.id} className="w-full">
                    <div className="grid grid-cols-12">
                      <div className="col-span-3">{renameOtoken(position.symbol)}</div>
                      <div className="col-span-1">
                        <NumberFormat value={position.amount} displayType={"text"} decimalScale={2} />
                      </div>
                      <div className="col-span-2">
                        <NumberFormat value={position.entryPrice} displayType={"text"} decimalScale={2} />
                      </div>
                      <div className="col-span-2">$</div>
                      <div className="col-span-2">
                        -
                      </div>
                      <div className="col-span-2">
                        <Button onClick={() => setSelectedOption(position.otokenId)} className="w-full">
                          Sell
                        </Button>
                      </div>
                    </div>
                    { selectedOption !== null && 
                      <div className="pt-6 grid grid-cols-12">
                        <div className="col-start-4 col-span-6">
                          <h4 className="mb-4 text-center">Sell Option</h4>
                          <BuyBack selectedOption={selectedOption} />
                        </div> 
                      </div>
                    }
                  </div>

                ))}

              </div>
            </div>
          </div>
        }

        { listedOptionState === OptionState.EXPIRED &&
          <div className="p-4">
            <table className="w-full">
              <thead className="text-left text-lg">
                <tr>
                  <th className="pl-4">Option</th>
                  <th>Size</th>
                  <th>Entry. Price</th>
                  <th className="pr-4">Mark Price</th>
                  <th className="pr-4">PNL</th>
                  <th className="pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* {DUMMY_OPTIONS[listedOptionState].map((option) => (
                  <tr className={`h-12`} key={option.option}>
                    <td className="pl-4">{option.option}</td>
                    <td>{option.size}</td>
                    <td>${option.entryPrice}</td>
                    <td className="pr-4">${option.markPrice}</td>
                    <td className="pr-4">
                      {option.pnl >= 0 ? "+" : "-"}${option.pnl}
                    </td>
                    <td>
                      {listedOptionState === OptionState.OPEN ? (
                        <Button>Close</Button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))} */}
                  
                { positions.filter(position => position.expired).map((position) => ( 
                  <tr className={`h-12`} key={position.id}>
                    <td className="pl-4">{renameOtoken(position.symbol)}</td>
                    <td className="pl-4">
                      <NumberFormat value={position.amount} displayType={"text"} decimalScale={2} />
                    </td>
                    <td className="pl-4">
                      <NumberFormat 
                        value={position.entryPrice > 0 ? position.entryPrice : '-' } 
                        displayType={"text"} 
                        decimalScale={2} />
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        }

      </Card>
    </div>
  )

}