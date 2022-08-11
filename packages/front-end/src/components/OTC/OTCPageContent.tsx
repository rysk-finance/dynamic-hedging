import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useWalletContext } from "../../App";
import OptionHandler from "../../artifacts/contracts/OptionHandler.sol/OptionHandler.json";
import { ZERO_UINT_256 } from "../../config/constants";
import { useContract } from "../../hooks/useContract";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useGlobalContext } from "../../state/GlobalContext";
import { Currency, Order, StrangleOrder } from "../../types";
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import { ETHPriceIndicator } from "../shared/ETHPriceIndicator";
import { OrderDetails } from "./OrderDetails";
import ERC20ABI from "../../abis/erc20.json";
import { BigNumber } from "ethers";
import { BigNumberDisplay } from "../BigNumberDisplay";

const STRANGLE_REGEX = /^([0-9]+)(-[0-9]+)$/;

export const OTCPageContent = () => {
  const query = useQueryParams();
  const { network, account } = useWalletContext();
  const {
    state: { ethPriceUpdateTime },
  } = useGlobalContext();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const [strangleId, setStrangleId] = useState<string | null>(null);
  const [strangle, setStrangle] = useState<StrangleOrder | null>(null);

  const [isApproved, setIsApproved] = useState(false);
  const [isListeningForApproval, setIsListeningForApproval] = useState(false);

  const [isComplete, setIsComplete] = useState(false);
  const [isListeningForComplete, setIsListeningForComplete] = useState(false);

  const [error, setError] = useState<string | null>(
    "Please connect your wallet"
  );

  const [optionHandlerContract, optionHandlerContractCall] = useContract<{
    OrderExecuted: [BigNumber];
  }>({
    contract: "optionHandler",
    ABI: OptionHandler.abi,
    events: {
      OrderExecuted: (id) => {
        if (orderId && orderId === id.toString()) {
          setIsListeningForComplete(false);
          setIsComplete(true);
          toast("✅ Order complete");
        }
      },
    },
    isListening: { OrderExecuted: isListeningForComplete },
  });

  const [usdcContract, usdcContractCall] = useContract<{
    Approval: [string, string, BigNumber];
  }>({
    contract: "USDC",
    ABI: ERC20ABI,
    readOnly: false,
    events: {
      Approval: () => {
        setIsApproved(true);
        setIsListeningForApproval(false);
        toast("✅ Approval complete");
      },
    },
    isListening: { Approval: isListeningForApproval },
    filters: { Approval: [[account]] },
  });

  useEffect(() => {
    const fetchOrder = async () => {
      if (optionHandlerContract && network && account)
        try {
          const id = query.get("id");

          if (!id) {
            throw new Error("❌ Invalid order ID. Please contact the team.");
          }

          const isStrangle = STRANGLE_REGEX.test(id);

          if (isStrangle) {
            setStrangleId(id);
          } else {
            setOrderId(id);
          }

          if (isStrangle) {
            const [id1, id2] = id
              .split("-")
              .map((numString) => Number(numString));

            const order1 = (await optionHandlerContract.orderStores(
              id1
            )) as Order | null;

            const order2 = (await optionHandlerContract.orderStores(
              id2
            )) as Order | null;

            const orderIsEmpty =
              order1?.price._hex === ZERO_UINT_256 ||
              order2?.price._hex === ZERO_UINT_256;

            if (orderIsEmpty) {
              throw new Error("❌ Invalid order ID. Please contact the team.");
            }

            // Check we have one put and one call
            const orderIsValid =
              order1?.optionSeries.isPut !== order2?.optionSeries.isPut;

            if (order1 && order2 && orderIsValid) {
              setStrangle({
                call: order1.optionSeries.isPut ? order2 : order1,
                put: order1.optionSeries.isPut ? order1 : order2,
              });
              setError(null);
            } else {
              throw new Error("❌ Invalid order ID. Please contact the team.");
            }
          } else {
            const parsedId = Number(id);
            const order = (await optionHandlerContract.orderStores(
              parsedId
            )) as Order | null;

            const orderIsEmpty = order?.price._hex === ZERO_UINT_256;

            if (orderIsEmpty) {
              throw new Error("❌ Invalid order ID. Please contact the team.");
            }

            setOrder(order);
            setError(null);
          }
        } catch (err: any) {
          setError(
            err.message ?? "❌ There was an error. Please contact our team."
          );
          setOrder(null);
        }
    };

    fetchOrder();
  }, [optionHandlerContract, query, account, network]);

  useEffect(() => {
    if (account && order) {
      if (account.toLowerCase() !== order.buyer.toLowerCase()) {
        setError(`❌ Please connect with account ${order.buyer}`);
      }
    }
  }, [account, order]);

  const handleApprove = useCallback(async () => {
    if (usdcContract && optionHandlerContract && (order || strangle)) {
      const isStrangle = !!strangle;
      const price = isStrangle
        ? strangle.call.price.add(strangle.put.price)
        : order
        ? order.price
        : null;
      if (price) {
        usdcContractCall({
          method: usdcContract.approve,
          args: [optionHandlerContract.address, price],
          onComplete: () => {
            setIsListeningForApproval(true);
          },
        });
      } else {
        toast("❌ There was an error. Please contact our team.");
      }
    } else {
      toast("❌ There was an error. Please contact our team.");
    }
  }, [optionHandlerContract, usdcContract, usdcContractCall, order, strangle]);

  const handleComplete = useCallback(async () => {
    if (optionHandlerContract) {
      if (orderId) {
        await optionHandlerContractCall({
          method: optionHandlerContract.executeOrder,
          args: [Number(orderId)],
          onComplete: () => {
            setIsListeningForComplete(true);
          },
        });
      } else if (strangleId) {
        const [id1, id2] = strangleId
          .split("-")
          .map((numString) => Number(numString));
        await optionHandlerContractCall({
          method: optionHandlerContract.executeOrder,
          args: [id1],
          onComplete: () => {
            setIsListeningForComplete(true);
          },
        });
      }
    } else {
      toast("❌ There was an error. Please contact our team.");
    }
  }, [optionHandlerContract, optionHandlerContractCall, orderId, strangleId]);

  useEffect(() => {
    if (!network || !account) {
      setOrder(null);
      setError("Please connect your wallet");
    }
  }, [network, account]);

  const approveDisabled = isListeningForApproval || isApproved;
  const completeDisabled = !isApproved || isListeningForComplete;

  return (
    <Card
      tabs={[
        {
          label: "OTC.optionOrder",
          content: (
            <div className="w-full">
              {isComplete ? (
                <div className="p-4">
                  <p>✅ Order complete</p>
                </div>
              ) : !error ? (
                <>
                  <div className="flex justify-stretch items-stretch ">
                    <div className="px-6 py-4 border-r-2 border-black">
                      <img src="/icons/ethereum.svg" />
                    </div>
                    <div className="flex items-center justify-between grow px-4">
                      <div className="flex flex-col justify-around">
                        <h4>
                          <b>Ether</b>
                        </h4>
                        <p className="text-gray-600 text-xs">
                          Late Update:{" "}
                          {ethPriceUpdateTime?.toLocaleTimeString("en-US")}
                        </p>
                      </div>
                      <ETHPriceIndicator />
                    </div>
                  </div>
                  <div className="w-full">
                    <div className="bg-black p-2 text-white">
                      <p>
                        <b>Details</b>
                      </p>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-col">
                        {order ? (
                          <div>
                            <div className="mb-4">
                              <div className="mb-4">
                                <OrderDetails order={order} />
                              </div>
                              <hr className="border-2 border-black" />
                            </div>
                            <p>
                              <b>
                                Total Price:{" "}
                                <BigNumberDisplay
                                  currency={Currency.RYSK}
                                  suffix="USDC"
                                >
                                  {order.price}
                                </BigNumberDisplay>
                              </b>
                            </p>
                          </div>
                        ) : strangle ? (
                          <>
                            <div className="mb-4">
                              <OrderDetails order={strangle.call} />
                            </div>
                            <hr className="mb-4 border-2 border-black" />
                            <div className="mb-4">
                              <OrderDetails order={strangle.put} />
                            </div>
                            <hr className="mb-4 border-2 border-black" />
                            <p>
                              <b>
                                Total Price:{" "}
                                <BigNumberDisplay
                                  currency={Currency.RYSK}
                                  suffix="USDC"
                                >
                                  {strangle.call.price.add(strangle.put.price)}
                                </BigNumberDisplay>
                              </b>
                            </p>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    <Button
                      className={`w-full border-b-0 border-x-0 !py-4`}
                      onClick={handleApprove}
                      color="black"
                      disabled={approveDisabled}
                    >
                      {isApproved
                        ? "✅ Approved"
                        : isListeningForApproval
                        ? "⏱ Awaiting Approval"
                        : "Approve"}
                    </Button>
                    <Button
                      className={`w-full border-b-0 border-x-0 !py-4 `}
                      color="black"
                      onClick={handleComplete}
                      disabled={completeDisabled}
                    >
                      {isListeningForComplete
                        ? "⏱ Awaiting Completion"
                        : "Complete Purchase"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-4">
                  <p>{error}</p>
                </div>
              )}
            </div>
          ),
        },
      ]}
    ></Card>
  );
};
