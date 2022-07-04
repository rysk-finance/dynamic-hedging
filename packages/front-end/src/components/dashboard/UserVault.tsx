import { ApolloClient, InMemoryCache, gql } from '@apollo/client'
import { BigNumber } from 'ethers/lib/ethers';
import React, { useCallback, useEffect, useState } from "react";
import NumberFormat from 'react-number-format';
import { useWalletContext } from "../../App";
import { BIG_NUMBER_DECIMALS, SUBGRAPH_URL } from "../../config/constants";
import { useContract } from '../../hooks/useContract';
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import LPABI from "../../abis/LiquidityPool.json";
import { DepositReceipt } from '../../types';


export const UserVault = () => {

  const { account, network } = useWalletContext();
  const SUBGRAPH_URI = network?.id !== undefined ? SUBGRAPH_URL[network?.id] : ""
  const [currentPosition, setCurrentPosition] = useState<BigNumber>(BigNumber.from(0));
  // const [balance, setBalance] = useState<BigNumber | null>(null);
  // const [latestEpoch, setLatestEpoch] = useState<number | null>(null);
  const [pricePerShare, setPricePerShare] = useState<BigNumber | null>(null);
  const [depositBalance, setDepositBalance] = useState<BigNumber>(BigNumber.from(0));

  const [unredeemableCollateral, setUnredeemableCollateral] = useState<BigNumber>(BigNumber.from(0));
  const [unredeemedSharesValue, setUnredeemedSharesValue] = useState<BigNumber>( BigNumber.from(0) );

  const [lpContract] = useContract<{
    EpochExecuted: [];
    Deposit: [BigNumber, BigNumber, BigNumber];
    Redeem: [];
    InitiateWithdraw: [];
    Withdraw: [];
  }>({
    contract: "liquidityPool",
    ABI: LPABI,
    readOnly: true,
  });


  useEffect(() => {

    const getCurrentPosition = async (address: string) => {
      const balance = await lpContract?.balanceOf(address);
      // setBalance(balance);

      const epoch = await lpContract?.epoch();
      // setLatestEpoch(epoch);
      
      // TODO if makes sense to have the latest available epoch as -1
      const pricePerShareAtEpoch = await lpContract?.epochPricePerShare(epoch - 1); 
      setPricePerShare(pricePerShareAtEpoch);

      // converting to 1e6 - usdc for easy comparison
      const positionValue = balance.gt(0) && pricePerShareAtEpoch?.gt(0) 
                            ? balance.mul(pricePerShareAtEpoch).div(BigNumber.from(10).pow(30))
                            : BigNumber.from(0)

      setCurrentPosition(positionValue)
      console.log(positionValue.toString())


      const depositReceipt: DepositReceipt = await lpContract?.depositReceipts(
        account
      );
      const currentEpoch: BigNumber = await lpContract?.epoch();
      const previousUnredeemedShares = depositReceipt.unredeemedShares;
      const unredeemedShares = BigNumber.from(0)
      // If true, the share price for the most recent deposit hasn't been calculated
      // so we can only show the collateral balance, not the equivalent number of shares.
      if (currentEpoch._hex === depositReceipt.epoch._hex) {
        unredeemedShares.add(previousUnredeemedShares);
        if (depositReceipt.amount.toNumber() !== 0) {
          setUnredeemableCollateral(depositReceipt.amount);
        }
      } else {
        // setUnredeemableCollateral(null);
        const pricePerShareAtEpoch: BigNumber =
          await lpContract?.epochPricePerShare(depositReceipt.epoch);
        // TODO(HC): Price oracle is returning 1*10^18 for price so having to adjust price
        // whilst building out to avoid share numbers being too small. Once price oracle is returning
        // more accurate
        const newUnredeemedShares = depositReceipt.amount
          .div(BIG_NUMBER_DECIMALS.USDC)
          .mul(BIG_NUMBER_DECIMALS.RYSK)
          .div(pricePerShareAtEpoch)
          .mul(BIG_NUMBER_DECIMALS.RYSK);
        const sharesToRedeem =
          previousUnredeemedShares.add(newUnredeemedShares);
        unredeemedShares.add(sharesToRedeem);
        
        const unredeemedSharesValue = sharesToRedeem.mul(pricePerShareAtEpoch).div(BigNumber.from(10).pow(30))

        setUnredeemedSharesValue(unredeemedSharesValue)
      }


    };

    const fetchDepositBalance = async () => {

      const positionsQuery = `
        query($account: String) {
          lpbalances(first: 1000, where: { id: "${account}" }) {
            id
            balance
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

            const balance = data.data.lpbalances[0] ? data.data.lpbalances[0].balance : 0
            
            setDepositBalance(balance)
            
        })
        .catch((err) => {
          // TODO add fallback
          console.log('Error fetching data: ', err)
        })

    }

    (async () => {
      if (account && lpContract) {
        await getCurrentPosition(account);
        fetchDepositBalance()
        .catch(console.error);
      }
    })();    

  }, [account, lpContract]);

    return (
      <div>
        {/* <h2 className="mb-4">Vaults</h2> */}
        <div className="mb-24">
          <Card tabPunchColor="black" headerContent="RYSK.DynamicHedging">
            <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
              <div className="flex h-full w-full lg:w-[70%] justify-around">
                <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
                  <h3 className="mb-2">
                     <NumberFormat
                        value={Number(
                          currentPosition?.add(unredeemableCollateral)
                          .add(unredeemedSharesValue)
                          .toNumber() / 1e6 
                        )} 
                        displayType={"text"} 
                        decimalScale={2} 
                        prefix="$" />
                  </h3>
                  <h4 className="mb-2">Position</h4>
                  <a href="#" className="underline">
                    Learn more
                  </a>
                </div>
                <div className="flex flex-col items-center justify-center h-full">
                  <h3 className="mb-2">
                  {/* TODO make sure if there is an error with subgraph this will not load */}         
                    <NumberFormat 
                      value={ Number(currentPosition?.add(unredeemableCollateral).sub(depositBalance).toNumber() / 1e6 ) }
                      displayType={"text"} 
                      decimalScale={2} 
                      prefix="$" />
                    
                  </h3>
                  <h4 className="mb-2">PNL</h4>
                  <a href="#" className="underline">
                    Learn more
                  </a>
                </div>
                { unredeemableCollateral.gt(0) &&
                  <div className="flex flex-col items-center justify-center h-full">
                    <h3 className="mb-2">
                     <NumberFormat
                        value={Number(
                          unredeemableCollateral
                          .toNumber() / 1e6 
                        )} 
                        displayType={"text"} 
                        decimalScale={2} 
                        prefix="$" />
                    </h3>
                    <h4 className="mb-2">Queed Collateral</h4>
                    <a href="#" className="underline">
                      Learn more
                    </a>
                  </div>
                }
                { unredeemedSharesValue.gt(0) &&
                  <div className="flex flex-col items-center justify-center h-full">
                    <h3 className="mb-2">
                       <NumberFormat
                        value={Number(
                          unredeemedSharesValue
                          .toNumber() / 1e6 
                        )} 
                        displayType={"text"} 
                        decimalScale={2} 
                        prefix="$" />
                    </h3>
                    <h4 className="mb-2">Shares to be reedemed</h4>
                    <a href="#" className="underline">
                      Learn more
                    </a>
                  </div>
                }
              </div>
              <div className="flex flex-col w-full lg:w-[30%] h-full justify-around items-center">
                <Button className="w-full mb-8">Deposit</Button>
                <Button className="w-full">Withdraw</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
}