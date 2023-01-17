import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import { useWalletContext } from "../../App";
import OptionHandler from "../../abis/OptionHandler.json";
import OptionRegistry from "../../abis/OptionRegistry.json";
import { BIG_NUMBER_DECIMALS, ZERO_UINT_256 } from "../../config/constants";
import { useContract } from "../../hooks/useContract";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useGlobalContext } from "../../state/GlobalContext";
import { Currency, Order, StrangleOrder } from "../../types";
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import { ETHPriceIndicator } from "../shared/ETHPriceIndicator";
import { OrderDetails } from "./OrderDetails";
import ERC20ABI from "../../abis/erc20.json";
import { BigNumber, ethers } from "ethers";
import { BigNumberDisplay } from "../BigNumberDisplay";

const STRANGLE_REGEX = /^([0-9]+)(-[0-9]+)$/;

export const OTCPageContent = () => {
  const query = useQueryParams();
  const { network, account, signer } = useWalletContext();
  const {
    state: { ethPriceUpdateTime },
  } = useGlobalContext();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isBuyer, setIsBuyer] = useState<boolean>(false);

  const [optionSeriesContract, setOptionContract] =
    useState<ethers.Contract | null>(null);

  const [strangleId, setStrangleId] = useState<string | null>(null);
  const [strangle, setStrangle] = useState<StrangleOrder | null>(null);

  // e6 for regular order, e8 for buyback
  const [approvedAmount, setApprovedAmount] = useState<BigNumber | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isListeningForApproval, setIsListeningForApproval] = useState(false);

  const [isComplete, setIsComplete] = useState(false);
  const [isListeningForComplete, setIsListeningForComplete] = useState(false);

  const [error, setError] = useState<string | null>(
    "Please connect your wallet"
  );

  const [optionHandlerContract, optionHandlerContractCall] = useContract({
    contract: "optionHandler",
    ABI: OptionHandler,
  });

  const [optionRegistryContract, optionRegistryContractCall] = useContract({
    contract: "OpynOptionRegistry",
    ABI: OptionRegistry,
  });

  const [usdcContract, usdcContractCall] = useContract({
    contract: "USDC",
    ABI: ERC20ABI,
    readOnly: false,
  });

  // Parse order query param and fetch order / strangle from chain.
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

            if (order?.isBuyBack && optionRegistryContract && signer) {
              const seriesAddress = await optionRegistryContract.getSeries(
                order.optionSeries
              );
              const seriesContract = new ethers.Contract(
                seriesAddress,
                ERC20ABI,
                signer
              );
              setOptionContract(seriesContract);
            }

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
  }, [
    optionHandlerContract,
    query,
    account,
    network,
    optionRegistryContract,
    signer,
  ]);

  useEffect(() => {
    if (account && (order || strangle)) {
      // NOTE: this presumes buyer of call/put in strangle is same
      const buyerAddress = order?.buyer ?? strangle?.call.buyer;
      setIsBuyer(account.toLowerCase() === buyerAddress?.toLowerCase());
    }
  }, [account, order, strangle]);

  // Regular order handlers
  const handleApprove = useCallback(async () => {
    if (usdcContract && optionHandlerContract && (order || strangle)) {
      const isStrangle = !!strangle;
      const totalPrice = isStrangle
        ? strangle.call.price
            .mul(strangle.call.amount)
            .add(strangle.put.price.mul(strangle.put.amount))
            .div(BIG_NUMBER_DECIMALS.RYSK)
            // 1e12 cause usdc is 1e6 and price is 1e18
            .div(1e12)
        : order
        ? order.price.mul(order.amount).div(BIG_NUMBER_DECIMALS.RYSK).div(1e12)
        : null;

      if (totalPrice) {
        usdcContractCall({
          method: usdcContract.approve,
          args: [optionHandlerContract.address, totalPrice],
          onSubmit: () => {
            setIsListeningForApproval(true);
          },
          onComplete: () => {
            setApprovedAmount(totalPrice);
            setIsListeningForApproval(false);
            toast("✅ Approval complete");
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
          onSubmit: () => {
            setIsListeningForComplete(true);
          },
          onComplete: () => {
            setIsListeningForComplete(false);
            setIsComplete(true);
            toast("✅ Order complete");
          },
        });
      } else if (strangleId) {
        const [id1, id2] = strangleId
          .split("-")
          .map((numString) => Number(numString));

        await optionHandlerContractCall({
          method: optionHandlerContract.executeStrangle,
          args: [Number(id1), Number(id2)],
          onSubmit: () => {
            setIsListeningForComplete(true);
          },
          onComplete: () => {
            setIsListeningForComplete(false);
            setIsComplete(true);
            toast("✅ Order complete");
          },
        });
      }
    } else {
      toast("❌ There was an error. Please contact our team.");
    }
  }, [optionHandlerContract, optionHandlerContractCall, orderId, strangleId]);

  // BuyBack order handlers
  const handleApproveBuyBack = useCallback(async () => {
    if (
      optionHandlerContract &&
      optionRegistryContract &&
      order &&
      orderId &&
      signer
    ) {
      try {
        if (optionSeriesContract) {
          const tx = await optionSeriesContract.approve(
            optionHandlerContract.address,
            // Need to approve in e8. order.amount is e18
            order.amount.div(1e10)
          );
          toast("✅ Approval submitted");
          tx.wait();
          toast("✅ Approval complete");
          setApprovedAmount(order.amount);
        }
      } catch (err) {
        toast("❌ There was an error. Please try again later.");
      }
    }
  }, [
    optionHandlerContract,
    optionSeriesContract,
    optionRegistryContract,
    order,
    orderId,
    signer,
  ]);

  const handleCompleteBuyBack = useCallback(async () => {
    if (optionHandlerContract) {
      await optionHandlerContractCall({
        method: optionHandlerContract.executeBuyBackOrder,
        args: [Number(orderId)],
        onSubmit: () => {
          setIsListeningForComplete(true);
        },
        onComplete: () => {
          setIsListeningForComplete(false);
          setIsComplete(true);
          toast("✅ Order complete");
        },
      });
    }
  }, [optionHandlerContract, optionHandlerContractCall, orderId]);

  const getAllowance = useCallback(async () => {
    if (account && order && optionHandlerContract) {
      // BuyBack order
      if (order.isBuyBack) {
        if (optionSeriesContract) {
          debugger;
          const allowance = await optionSeriesContract.allowance(
            account,
            optionHandlerContract.address
          );
          setApprovedAmount(allowance);
        }
        // Regular order or strangle
      } else {
        const allowance = await usdcContract?.allowance(
          account,
          optionHandlerContract.address
        );
        setApprovedAmount(allowance);
      }
    }
  }, [
    account,
    usdcContract,
    optionHandlerContract,
    order,
    optionSeriesContract,
  ]);

  useEffect(() => {
    getAllowance();
  }, [getAllowance]);

  // Check approved amount against order amount to determine if order has been approved.
  useEffect(() => {
    if (account && approvedAmount) {
      if (order) {
        // Buyback order
        if (order.isBuyBack) {
          // approved amount is e10 for buyback
          if (approvedAmount.gte(order.amount.div(1e10))) {
            setIsApproved(true);
          }
          // Regular order
        } else {
          const totalPrice = order.price
            .mul(order.amount)
            .div(BIG_NUMBER_DECIMALS.RYSK)
            .div(1e12);
          if (approvedAmount.gte(totalPrice)) {
            setIsApproved(true);
          }
        }
        // Strangle order
      } else if (strangle) {
        const callTotalPrice = strangle.call.price
          .mul(strangle.call.amount)
          .div(BIG_NUMBER_DECIMALS.RYSK)
          .div(1e12);

        const putTotalPrice = strangle.put.price
          .mul(strangle.put.amount)
          .div(BIG_NUMBER_DECIMALS.RYSK)
          .div(1e12);

        const totalStranglePrice = callTotalPrice.add(putTotalPrice);
        if (approvedAmount.gte(totalStranglePrice)) {
          setIsApproved(true);
        }
      }
    }
  }, [account, approvedAmount, order, strangle]);

  // useEffect(() => {
  //   // Check if order is approved, doing some decimal scaling on the way.
  //   const getIsOrderApproved = async () => {
  //     {
  //       if (account && (order || strangle)) {
  //         // e6
  //         const allowance: BigNumber | null = await getAllowance();
  //         if (allowance && order) {
  //           // e18
  //           const scaledAllowance = allowance
  //             .mul(BIG_NUMBER_DECIMALS.RYSK)
  //             .div(BIG_NUMBER_DECIMALS.USDC);

  //           // e18
  //           const totalPrice =
  //             order.price ?? strangle?.call.price.add(strangle?.put.price);
  //           if (scaledAllowance.gte(totalPrice)) {
  //             // setIsApproved(true);
  //           }
  //         }
  //       }
  //     }
  //   };

  //   const getIsBuyBackOrderApproved = async () => {
  //     if (account && order) {
  //       debugger;
  //       const allowance: BigNumber | null = await getAllowance();
  //       if (allowance && allowance.gte(order.amount)) {
  //         setIsApproved(true);
  //       }
  //     }
  //   };

  //   if (order) {
  //     order.isBuyBack ? getIsBuyBackOrderApproved() : getIsOrderApproved();
  //   }
  // }, [getAllowance, account, order, strangle]);

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
                          Latest Update:{" "}
                          {ethPriceUpdateTime?.toLocaleTimeString("en-US")}
                        </p>
                      </div>
                      <ETHPriceIndicator />
                    </div>
                  </div>
                  <div className="w-full">
                    <div className="bg-black p-2 text-white">
                      <p>
                        <b>
                          {order && order.isBuyBack ? "Close Position" : "Buy"}
                        </b>
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
                                  {order.price
                                    .mul(order.amount)
                                    .div(BIG_NUMBER_DECIMALS.RYSK)}
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
                                  {strangle.call.price
                                    .mul(strangle.call.amount)
                                    .add(
                                      strangle.put.price.mul(
                                        strangle.put.amount
                                      )
                                    )
                                    .div(BIG_NUMBER_DECIMALS.RYSK)}
                                </BigNumberDisplay>
                              </b>
                            </p>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {isBuyer && (
                    <div className="flex">
                      <Button
                        className={`w-full border-b-0 border-x-0 !py-4`}
                        onClick={
                          order
                            ? order.isBuyBack
                              ? handleApproveBuyBack
                              : handleApprove
                            : strangle
                            ? handleApprove
                            : () => {}
                        }
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
                        onClick={
                          order
                            ? order.isBuyBack
                              ? handleCompleteBuyBack
                              : handleComplete
                            : strangle
                            ? handleComplete
                            : () => {}
                        }
                        disabled={completeDisabled}
                      >
                        {isListeningForComplete
                          ? "⏱ Awaiting Completion"
                          : order?.isBuyBack
                          ? "Complete Sale"
                          : "Complete Purchase"}
                      </Button>
                    </div>
                  )}
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
