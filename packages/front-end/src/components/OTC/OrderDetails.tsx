
import React, { useEffect, useState } from "react";
import { BIG_NUMBER_DECIMALS } from "../../config/constants";
import { Currency, Order } from "../../types";
import { parseTimestamp } from "../../utils/parseTimestamp";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { AddressDisplay } from "../shared/AddressDisplay";
import { OptionSeriesInfo } from "../shared/OptionSeriesInfo";

type OrderDetailsProps = {
  order: Order | null;
};

export const OrderDetails: React.FC<OrderDetailsProps> = ({ order }) => {

  const [countDown, setCountDown] = useState(
    (Number(order?.orderExpiry) ) - Math.floor(Date.now() / 1000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCountDown( (Number(order?.orderExpiry) * 1000 ) - Math.floor(Date.now()) );
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);


  const getReturnValues = (countDown: number) => {
    // const days = Math.floor(countDown / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (countDown % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((countDown % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((countDown % (1000 * 60)) / 1000);

    return `${hours}hr ${minutes}m ${seconds}s`
  };

  return (
    <div className="w-full">
      {order && (
        <>
          <OptionSeriesInfo option={order.optionSeries} />
          <hr className="my-2 border-black" />
          <p className="pt-2">
            Buyer Address: <AddressDisplay>{order.buyer}</AddressDisplay>
          </p>
          <p className="pt-2">
            Order Expiry: { parseTimestamp(Number(order.orderExpiry) * 1000) } { " "}
            {/* ({ secondsToExpiry <= 0 ? 'expired' : secondsToExpiry}) */}
            <b>{ countDown > 0 ? `EXPIRING IN: ${getReturnValues(countDown)}` : 'EXPIRED' }</b>
          </p>
          <p className="pt-2">
            Size:{" "}
            <BigNumberDisplay currency={Currency.RYSK}>
              {order.amount}
            </BigNumberDisplay>
          </p>
          <p className="pt-2">
            Price per option:{" "}
            <BigNumberDisplay currency={Currency.RYSK} suffix="USDC">
              {order.price}
            </BigNumberDisplay>
          </p>
        </>
      )}
    </div>
  );
};