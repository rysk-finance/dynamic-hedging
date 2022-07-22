import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useWalletContext } from "../../App";
import OptionHandler from "../../artifacts/contracts/OptionHandler.sol/OptionHandler.json";
import { ZERO_UINT_256 } from "../../config/constants";
import { useContract } from "../../hooks/useContract";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useGlobalContext } from "../../state/GlobalContext";
import { Order } from "../../types";
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import { ETHPriceIndicator } from "../shared/ETHPriceIndicator";
import { OrderDetails } from "./OrderDetails";
import ERC20ABI from "../../abis/erc20.json";
import { BigNumber } from "ethers";

export const OTCPageContent = () => {
  const query = useQueryParams();
  const { network, account } = useWalletContext();
  const {
    state: { ethPriceUpdateTime },
  } = useGlobalContext();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

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
          const orderId = query.get("id");
          setOrderId(orderId);

          if (!orderId) {
            throw new Error("❌ Invalid order ID. Please contact the team.");
          }

          const order = (await optionHandlerContract.orderStores(
            orderId
          )) as Order | null;

          const orderIsEmpty = order?.price._hex === ZERO_UINT_256;

          if (orderIsEmpty) {
            throw new Error("❌ Invalid order ID. Please contact the team.");
          }

          setOrder(order);
          setError(null);
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
    if (usdcContract && optionHandlerContract && order) {
      usdcContractCall({
        method: usdcContract.approve,
        args: [optionHandlerContract.address, order.amount],
        onComplete: () => {
          setIsListeningForApproval(true);
        },
      });
    } else {
      toast("❌ There was an error. Please contact our team.");
    }
  }, [optionHandlerContract, usdcContract, usdcContractCall, order]);

  const handleComplete = useCallback(async () => {
    if (optionHandlerContract && orderId !== null) {
      await optionHandlerContractCall({
        method: optionHandlerContract.executeOrder,
        args: [Number(orderId)],
        onComplete: () => {
          setIsListeningForComplete(true);
        },
      });
    } else {
      toast("❌ There was an error. Please contact our team.");
    }
  }, [optionHandlerContract, optionHandlerContractCall, orderId]);

  useEffect(() => {
    if (!network || !account) {
      setOrder(null);
      setError("Please connect your wallet");
    }
  }, [network, account]);

  const approveDisabled = isListeningForApproval || isApproved;
  const completeDisabled = !isApproved || isListeningForComplete;

  return (
    <Card headerContent="OTC.optionOrder">
      <div className="w-full">
        {order && isComplete ? (
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
                  <OrderDetails order={order} />
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
                Approve
              </Button>
              <Button
                className={`w-full border-b-0 border-x-0 !py-4 `}
                color="black"
                onClick={handleComplete}
                disabled={completeDisabled}
              >
                Complete Purchase
              </Button>
            </div>
          </>
        ) : (
          <div className="p-4">
            <p>{error}</p>
          </div>
        )}
      </div>
    </Card>
  );
};
